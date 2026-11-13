"""Auth endpoints: register, login, refresh (rotating), logout."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import RefreshToken, User
from app.schemas import LoginIn, RefreshIn, RegisterIn, TokenPair
from app.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(db: Session, user: User) -> TokenPair:
    access, expires_in = create_access_token(user.id)
    raw, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=get_settings().refresh_token_days),
        )
    )
    db.commit()
    return TokenPair(access_token=access, refresh_token=raw, expires_in=expires_in)


@router.post("/register", response_model=TokenPair, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "email_taken", "An account with this email already exists")
    return _issue_tokens(db, user)


@router.post("/login", response_model=TokenPair)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else None)
    if not user or not ok or user.status != "active":
        raise AppError(401, "invalid_credentials", "Incorrect email or password")
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(body.refresh_token)))
    now = datetime.now(timezone.utc)
    if token is None:
        raise AppError(401, "invalid_refresh_token", "Invalid refresh token")
    if token.revoked_at is not None:
        # A rotated token was presented again: assume theft and end every session.
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == token.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        db.commit()
        raise AppError(401, "refresh_token_reused", "Session expired, please sign in again")
    if token.expires_at <= now:
        raise AppError(401, "invalid_refresh_token", "Refresh token expired")
    user = db.get(User, token.user_id)
    if user is None or user.status != "active":
        raise AppError(401, "invalid_refresh_token", "Invalid refresh token")
    token.revoked_at = now
    return _issue_tokens(db, user)  # commits the revocation and the new token together


@router.post("/logout", status_code=204)
def logout(body: RefreshIn, db: Session = Depends(get_db)):
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(body.refresh_token)))
    if token and token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return Response(status_code=204)

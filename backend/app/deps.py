"""Shared FastAPI dependencies."""

import uuid

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import User
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = AppError(401, "unauthorized", "Authentication required")
    if creds is None:
        raise unauthorized
    try:
        user_id: uuid.UUID = decode_access_token(creds.credentials)
    except (jwt.PyJWTError, ValueError):
        raise AppError(401, "invalid_token", "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None or user.status != "active":
        raise unauthorized
    return user

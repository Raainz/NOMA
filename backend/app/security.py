"""Password hashing and token helpers."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings

_hasher = PasswordHasher()
# Used to keep login timing similar when the email is unknown.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    s = get_settings()
    expires = timedelta(minutes=s.access_token_minutes)
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": str(user_id), "type": "access", "iat": now, "exp": now + expires},
        s.jwt_secret,
        algorithm="HS256",
    )
    return token, int(expires.total_seconds())


def decode_access_token(token: str) -> uuid.UUID:
    """Raises jwt.PyJWTError / ValueError when the token is invalid or expired."""
    payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    if payload.get("type") != "access":
        raise ValueError("wrong token type")
    return uuid.UUID(payload["sub"])


def new_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash). Only the hash is stored."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

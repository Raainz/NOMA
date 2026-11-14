"""SQLAlchemy models (portable types: run on PostgreSQL and SQLite for tests)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on every backend (SQLite drops tzinfo)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime not allowed")
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(80))
    preferred_units: Mapped[str] = mapped_column(String(10), default="metric")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    locale: Mapped[str] = mapped_column(String(16), default="fr")
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)

    # Social profile (M2). Private by default: nothing is visible until `is_public` is set.
    handle: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    city: Mapped[str | None] = mapped_column(String(80))
    level: Mapped[str | None] = mapped_column(String(16))  # debutant / intermediaire / confirme
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)


class Follow(Base):
    """`follower_id` follows `followed_id`. Immediate (no approval) at the MVP stage."""

    __tablename__ = "follows"
    __table_args__ = (
        CheckConstraint("follower_id != followed_id", name="ck_follow_not_self"),
        Index("ix_follows_followed", "followed_id"),
    )

    follower_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    followed_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)


class RefreshToken(Base):
    """Opaque rotating refresh tokens; only the SHA-256 hash is stored."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint("user_id", "client_activity_id", name="uq_activity_user_client_id"),
        Index("ix_activity_user_started", "user_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_activity_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="finished")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime] = mapped_column(UTCDateTime)

    # Server-computed metrics (see app/services/metrics.py).
    duration_s: Mapped[float] = mapped_column(Float)
    moving_time_s: Mapped[float] = mapped_column(Float)
    distance_m: Mapped[float] = mapped_column(Float)
    elevation_gain_m: Mapped[float] = mapped_column(Float)
    avg_pace_s_per_km: Mapped[float | None] = mapped_column(Float)
    avg_speed_kmh: Mapped[float] = mapped_column(Float)
    algorithm_version: Mapped[str] = mapped_column(String(32))
    quality: Mapped[dict] = mapped_column(JSON)

    # What the phone computed, kept for diagnostics only.
    client_metrics: Mapped[dict | None] = mapped_column(JSON)
    input_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(32), default="mobile")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)
    # private (owner only) / followers / public. Always private until the owner decides otherwise.
    visibility: Mapped[str] = mapped_column(String(16), default="private", server_default="private")

    points: Mapped[list["ActivityPoint"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan", order_by="ActivityPoint.seq"
    )


class ActivityPoint(Base):
    __tablename__ = "activity_points"
    __table_args__ = (UniqueConstraint("activity_id", "seq", name="uq_point_activity_seq"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    ts_ms: Mapped[int] = mapped_column(BigInteger)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    altitude: Mapped[float | None] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float)
    speed: Mapped[float | None] = mapped_column(Float)

    activity: Mapped[Activity] = relationship(back_populates="points")

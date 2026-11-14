"""Request / response models (Pydantic)."""

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# ---- auth / profile -------------------------------------------------------


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    preferred_units: str
    timezone: str
    locale: str
    created_at: datetime
    handle: str | None
    city: str | None
    level: str | None
    bio: str | None
    avatar_url: str | None
    is_public: bool


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    preferred_units: Literal["metric", "imperial"] | None = None
    timezone: str | None = Field(default=None, max_length=64)
    locale: str | None = Field(default=None, max_length=16)


# ---- social profile -------------------------------------------------------

Level = Literal["debutant", "intermediaire", "confirme"]
Visibility = Literal["private", "followers", "public"]

_HANDLE = re.compile(r"^[a-z0-9_]{3,30}$")
_RESERVED_HANDLES = {"admin", "administrator", "noma", "support", "help", "me", "root", "system", "moderator"}


class ProfilePatch(BaseModel):
    """Fields left out are untouched. `city`, `level` and `bio` accept null to clear them."""

    handle: str | None = None
    display_name: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    level: Level | None = None
    bio: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None

    @field_validator("handle")
    @classmethod
    def _handle_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lstrip("@").lower()
        if not _HANDLE.match(v):
            raise ValueError("handle must be 3-30 characters: letters, digits or underscore")
        if v in _RESERVED_HANDLES:
            raise ValueError("this handle is reserved")
        return v

    @field_validator("display_name", "city", "bio")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _not_null(self):
        # Only city / level / bio / display_name can be cleared; these cannot be set to null.
        for field in ("handle", "is_public"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class UserSummaryOut(BaseModel):
    """What anyone signed in can see about a public runner in lists and search."""

    id: uuid.UUID
    handle: str
    display_name: str | None
    city: str | None
    level: str | None
    avatar_url: str | None
    is_following: bool = False


class UserSummaryListOut(BaseModel):
    items: list[UserSummaryOut]
    next_cursor: str | None = None


class PublicProfileOut(UserSummaryOut):
    bio: str | None
    followers_count: int
    following_count: int
    activities_count: int = Field(description="Activities visible to the viewer")
    total_distance_m: float = Field(description="Sum over the activities visible to the viewer")
    is_me: bool
    created_at: datetime


class FollowStateOut(BaseModel):
    is_following: bool
    followers_count: int


class VisibilityIn(BaseModel):
    visibility: Visibility


# ---- activities -----------------------------------------------------------

_CLIENT_ID = re.compile(r"^[A-Za-z0-9_\-:.]+$")


class PointIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude: float | None = Field(default=None, ge=-1000, le=10000)
    accuracy: float | None = Field(default=None, ge=0)
    speed: float | None = Field(default=None, ge=0)
    timestamp: int = Field(gt=0, description="Unix time in milliseconds")


class ClientMetrics(BaseModel):
    """What the phone computed. Stored for diagnostics, never trusted."""

    distance_m: float | None = Field(default=None, ge=0)
    duration_ms: float | None = Field(default=None, ge=0)
    moving_time_ms: float | None = Field(default=None, ge=0)
    elevation_gain_m: float | None = Field(default=None, ge=0)


class ActivitySyncIn(BaseModel):
    client_activity_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    started_at: datetime
    ended_at: datetime
    points: list[PointIn] = Field(min_length=2, max_length=200_000)
    client_metrics: ClientMetrics | None = None

    @field_validator("client_activity_id")
    @classmethod
    def _client_id_chars(cls, v: str) -> str:
        if not _CLIENT_ID.match(v):
            raise ValueError("client_activity_id contains invalid characters")
        return v

    @field_validator("started_at", "ended_at")
    @classmethod
    def _tz_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("datetime must include a timezone")
        return v

    @model_validator(mode="after")
    def _ordered(self):
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must not be before started_at")
        ts = [p.timestamp for p in self.points]
        if any(b < a for a, b in zip(ts, ts[1:])):
            raise ValueError("points must be ordered by timestamp")
        return self


class PointOut(BaseModel):
    seq: int
    timestamp: int = Field(description="Unix time in milliseconds")
    latitude: float
    longitude: float
    altitude: float | None
    accuracy: float | None
    speed: float | None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_activity_id: str
    name: str
    status: str
    started_at: datetime
    ended_at: datetime
    duration_s: float
    moving_time_s: float
    distance_m: float
    elevation_gain_m: float
    avg_pace_s_per_km: float | None
    avg_speed_kmh: float
    algorithm_version: str
    quality: dict
    client_metrics: dict | None
    created_at: datetime
    visibility: str


class ActivityDetailOut(ActivityOut):
    points: list[PointOut] | None = None


class ActivityListOut(BaseModel):
    items: list[ActivityOut]
    next_cursor: str | None = None


class PublicActivityOut(BaseModel):
    """An activity as seen by someone other than its owner: no diagnostics, no client ids."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    started_at: datetime
    duration_s: float
    moving_time_s: float
    distance_m: float
    elevation_gain_m: float
    avg_pace_s_per_km: float | None
    avg_speed_kmh: float
    visibility: str


class PublicActivityDetailOut(PublicActivityOut):
    # The full trace, as recorded. Sharing an activity is the owner's choice (visibility).
    points: list[PointOut] | None = None


class PublicActivityListOut(BaseModel):
    items: list[PublicActivityOut]
    next_cursor: str | None = None

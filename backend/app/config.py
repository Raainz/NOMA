"""Application settings, read from environment variables / .env."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    environment: str = "development"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    max_points_per_activity: int = 100_000

    @field_validator("database_url")
    @classmethod
    def _driver(cls, v: str) -> str:
        # Supabase hands out plain postgresql:// URLs; force the psycopg 3 driver we ship.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @field_validator("jwt_secret")
    @classmethod
    def _not_placeholder(cls, v: str) -> str:
        if v.lower().startswith(("change", "your_")):
            raise ValueError("JWT_SECRET must be a real random secret")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

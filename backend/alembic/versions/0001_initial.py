"""initial schema: users, refresh tokens, activities, points

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

from app.models import UTCDateTime

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(80)),
        sa.Column("preferred_units", sa.String(10), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("locale", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", UTCDateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", UTCDateTime(), nullable=False),
        sa.Column("revoked_at", UTCDateTime()),
        sa.Column("created_at", UTCDateTime(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    op.create_table(
        "activities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_activity_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("started_at", UTCDateTime(), nullable=False),
        sa.Column("ended_at", UTCDateTime(), nullable=False),
        sa.Column("duration_s", sa.Float(), nullable=False),
        sa.Column("moving_time_s", sa.Float(), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("elevation_gain_m", sa.Float(), nullable=False),
        sa.Column("avg_pace_s_per_km", sa.Float()),
        sa.Column("avg_speed_kmh", sa.Float(), nullable=False),
        sa.Column("algorithm_version", sa.String(32), nullable=False),
        sa.Column("quality", sa.JSON(), nullable=False),
        sa.Column("client_metrics", sa.JSON()),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "client_activity_id", name="uq_activity_user_client_id"),
    )
    op.create_index("ix_activity_user_started", "activities", ["user_id", "started_at"])

    op.create_table(
        "activity_points",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("activity_id", sa.Uuid(), sa.ForeignKey("activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("ts_ms", sa.BigInteger(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("altitude", sa.Float()),
        sa.Column("accuracy", sa.Float()),
        sa.Column("speed", sa.Float()),
        sa.UniqueConstraint("activity_id", "seq", name="uq_point_activity_seq"),
    )
    op.create_index("ix_activity_points_activity_id", "activity_points", ["activity_id"])


def downgrade() -> None:
    op.drop_table("activity_points")
    op.drop_table("activities")
    op.drop_table("refresh_tokens")
    op.drop_table("users")

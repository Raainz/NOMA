"""M2 social foundation: public profiles, activity visibility, follows

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

from app.models import UTCDateTime

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing accounts stay private: is_public defaults to false, activities to private.
    op.add_column("users", sa.Column("handle", sa.String(30)))
    op.add_column("users", sa.Column("city", sa.String(80)))
    op.add_column("users", sa.Column("level", sa.String(16)))
    op.add_column("users", sa.Column("bio", sa.Text()))
    op.add_column("users", sa.Column("avatar_url", sa.String(500)))
    op.add_column("users", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_users_handle", "users", ["handle"], unique=True)

    op.add_column(
        "activities", sa.Column("visibility", sa.String(16), nullable=False, server_default="private")
    )

    op.create_table(
        "follows",
        sa.Column("follower_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("followed_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.CheckConstraint("follower_id != followed_id", name="ck_follow_not_self"),
    )
    op.create_index("ix_follows_followed", "follows", ["followed_id"])


def downgrade() -> None:
    op.drop_table("follows")
    with op.batch_alter_table("activities") as batch:
        batch.drop_column("visibility")
    op.drop_index("ix_users_handle", table_name="users")
    with op.batch_alter_table("users") as batch:
        for col in ("is_public", "avatar_url", "bio", "level", "city", "handle"):
            batch.drop_column(col)

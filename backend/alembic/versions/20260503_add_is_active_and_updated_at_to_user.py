"""add is_active and updated_at to user

Revision ID: 20260503_user_is_active_updated_at
Revises: 20260502_user
Create Date: 2026-05-03

Implements data-model.md §"Migration outline" for feature 003-users-management.
Adds two NOT NULL columns with server-side defaults so existing rows backfill in a
single statement; future writes always carry an explicit value from the application
layer (research.md R1 / R4).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260503_user_is_active_updated_at"
down_revision = "20260502_user"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "user",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "updated_at")
    op.drop_column("user", "is_active")

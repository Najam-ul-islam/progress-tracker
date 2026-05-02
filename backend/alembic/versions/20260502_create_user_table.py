"""create user table

Revision ID: 20260502_user
Revises:
Create Date: 2026-05-02

Implements data-model.md §1.1 for feature 002-auth-jwt-rbac.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260502_user"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "role IN ('admin', 'manager', 'developer')",
            name="ck_user_role",
        ),
    )
    op.create_index("ix_user_email", "user", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_user_email", table_name="user")
    op.drop_table("user")

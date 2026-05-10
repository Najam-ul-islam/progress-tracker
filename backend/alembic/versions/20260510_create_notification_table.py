"""create notification table

Revision ID: 20260510_notification
Revises: 20260505_payment
Create Date: 2026-05-10

Implements specs/008-notifications/data-model.md.

Creates one table:

  - `notification` (9 columns) — append-only feed row per recipient.
    `is_read` flips once (`false → true`); `read_at` is NULL until that flip
    and immutable thereafter (FR-005, FR-006). `dedup_key` is NULL except for
    rows produced by the deadline-scan path (FR-015).

Indexes:

  - `ix_notification_user_created` (user_id, created_at DESC) — primary feed query.
  - `uq_notification_user_dedup` (user_id, dedup_key) — partial unique
    `WHERE dedup_key IS NOT NULL` to allow many NULL dedup_keys per user
    while preventing duplicate scan emissions for the same calendar day.

CHECK constraints encode title/message length bounds (defence in depth — Pydantic
validates first).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260510_notification"
down_revision = "20260505_payment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("user.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("message", sa.String(2000), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column(
            "is_read",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.Column("dedup_key", sa.String(128), nullable=True),
        sa.CheckConstraint(
            "length(title) BETWEEN 1 AND 120",
            name="ck_notification_title_length",
        ),
        sa.CheckConstraint(
            "length(message) BETWEEN 1 AND 2000",
            name="ck_notification_message_length",
        ),
    )
    op.create_index("ix_notification_user_id", "notification", ["user_id"])
    op.create_index(
        "ix_notification_user_created",
        "notification",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "uq_notification_user_dedup",
        "notification",
        ["user_id", "dedup_key"],
        unique=True,
        postgresql_where=sa.text("dedup_key IS NOT NULL"),
        sqlite_where=sa.text("dedup_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_notification_user_dedup", table_name="notification")
    op.drop_index("ix_notification_user_created", table_name="notification")
    op.drop_index("ix_notification_user_id", table_name="notification")
    op.drop_table("notification")

"""Notifications module: SQLModel table definitions only. No business logic, no schemas.

The `Notification` entity is owned by this module. Producers (`projects`,
`payments`) call `notifications.service.publish` to emit rows; they never
import this model directly for writes (FR-024).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

import sqlalchemy as sa
from sqlmodel import Field

from app.db.base import SQLModel


class NotificationType(str, Enum):
    """Closed enum of notification kinds (FR-020)."""

    ASSIGNMENT = "assignment"
    PAYMENT = "payment"
    PAYMENT_PAID = "payment_paid"
    DEADLINE = "deadline"
    SYSTEM = "system"


class Notification(SQLModel, table=True):
    __tablename__ = "notification"
    __table_args__ = (
        sa.CheckConstraint(
            "length(title) BETWEEN 1 AND 120",
            name="ck_notification_title_length",
        ),
        sa.CheckConstraint(
            "length(message) BETWEEN 1 AND 2000",
            name="ck_notification_message_length",
        ),
        sa.Index(
            "ix_notification_user_created",
            "user_id",
            sa.text("created_at DESC"),
        ),
        sa.Index(
            "uq_notification_user_dedup",
            "user_id",
            "dedup_key",
            unique=True,
            postgresql_where=sa.text("dedup_key IS NOT NULL"),
            sqlite_where=sa.text("dedup_key IS NOT NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        foreign_key="user.id",
        nullable=False,
        index=True,
    )
    title: str = Field(min_length=1, max_length=120, nullable=False)
    message: str = Field(min_length=1, max_length=2000, nullable=False)
    type: str = Field(nullable=False, max_length=32)
    is_read: bool = Field(default=False, nullable=False)
    read_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    dedup_key: str | None = Field(default=None, max_length=128, nullable=True)

"""Notifications module: Pydantic v2 request/response schemas. No tables, no business logic.

Every schema sets `extra="forbid"` and `from_attributes=True` per the project's
conventions. Validation is layered: Pydantic catches shape/length/type issues;
the service layer enforces invariants that need DB access (recipient existence,
exactly-one-of selectors with cross-field semantics, etc.).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.notifications.model import NotificationType


_BroadcastRole = Literal["admin", "manager", "developer"]


class NotificationRead(BaseModel):
    """Single feed row returned to the caller."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class NotificationFeed(BaseModel):
    """Envelope returned by `GET /notifications`."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    items: list[NotificationRead]
    unread_count: int = Field(ge=0)
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=200)
    offset: int = Field(ge=0)


class MarkReadResponse(BaseModel):
    """Envelope returned by `PATCH /notifications/{id}/read`."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int = Field(ge=1)
    is_read: Literal[True] = True
    read_at: datetime


class BroadcastRecipients(BaseModel):
    """Selector envelope for `POST /notifications/send`.

    Exactly one of `all`, `role`, `user_ids` MUST be supplied (FR-018).
    """

    model_config = ConfigDict(extra="forbid")

    all: bool | None = None
    role: _BroadcastRole | None = None
    user_ids: list[int] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _exactly_one_selector(self) -> "BroadcastRecipients":
        provided: list[str] = []
        if self.all is not None:
            provided.append("all")
        if self.role is not None:
            provided.append("role")
        if self.user_ids is not None:
            provided.append("user_ids")
        if len(provided) != 1:
            raise ValueError(
                "recipients must specify exactly one of "
                "{all, role, user_ids}; "
                f"got {provided or 'none'}"
            )
        if "all" in provided and self.all is not True:
            raise ValueError("recipients.all must be true when supplied")
        if "user_ids" in provided:
            assert self.user_ids is not None  # mypy
            if any(uid < 1 for uid in self.user_ids):
                raise ValueError("recipients.user_ids must all be >= 1")
        return self


class BroadcastRequest(BaseModel):
    """`POST /notifications/send` request body."""

    model_config = ConfigDict(extra="forbid")

    recipients: BroadcastRecipients
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType = NotificationType.SYSTEM
    email_channel: bool = False


class BroadcastResult(BaseModel):
    """`POST /notifications/send` response body."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    created: int = Field(ge=0)
    type: NotificationType
    recipients_resolved: int = Field(ge=0)


class ScanRequest(BaseModel):
    """`POST /notifications/scan-deadlines` request body (optional)."""

    model_config = ConfigDict(extra="forbid")

    lookahead_days: int = Field(default=3, ge=0, le=30)


class ScanResult(BaseModel):
    """`POST /notifications/scan-deadlines` response body."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    scanned_projects: int = Field(ge=0)
    emitted: int = Field(ge=0)
    deduped: int = Field(ge=0)
    as_of: datetime


__all__ = [
    "NotificationRead",
    "NotificationFeed",
    "MarkReadResponse",
    "BroadcastRecipients",
    "BroadcastRequest",
    "BroadcastResult",
    "ScanRequest",
    "ScanResult",
]

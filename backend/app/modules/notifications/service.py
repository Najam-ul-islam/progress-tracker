"""Notifications module: all business logic. The only legal home for domain rules.

This module hosts the public `publish` entry point used by upstream modules
(FR-012, FR-013), the caller-scoped feed/mark-read/broadcast functions, and
the typed exceptions that map to HTTP status codes in `routes.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from sqlmodel import Session, select

from app.modules.notifications import repository as notifications_repo
from app.modules.notifications.model import Notification, NotificationType
from app.modules.notifications.schema import (
    BroadcastRecipients,
    BroadcastRequest,
    BroadcastResult,
    MarkReadResponse,
    NotificationFeed,
    NotificationRead,
)
from app.modules.users.model import User
from app.modules.users.repository import get_user_by_id


# --- Typed exceptions (routes map each to a specific HTTP status) ---


class NotificationServiceError(Exception):
    """Base class for service-level errors."""


class InvalidNotificationType(NotificationServiceError):
    """Provided `type` is not a member of `NotificationType` (FR-020)."""


class InvalidNotificationContent(NotificationServiceError):
    """Title or message is empty/whitespace or exceeds bounds (FR-021)."""


class RecipientNotFound(NotificationServiceError):
    """Provided `recipient_id` does not match any user."""


class RecipientInactive(NotificationServiceError):
    """Recipient exists but `is_active=False`."""


class NotificationNotFound(NotificationServiceError):
    """Notification id does not exist OR belongs to another user (FR-005)."""


class InvalidPagination(NotificationServiceError):
    """`limit` or `offset` outside of allowed bounds."""


class InvalidRecipientIds(NotificationServiceError):
    """One or more `user_ids` in a broadcast did not resolve to active users.

    The whole request is rejected (FR-019). Carries `invalid_ids` so the route
    layer can include the list in the 422 response.
    """

    def __init__(self, invalid_ids: list[int]) -> None:
        self.invalid_ids = sorted(set(invalid_ids))
        super().__init__(
            f"recipients.user_ids contained invalid or inactive ids: "
            f"{self.invalid_ids}"
        )


# --- Internal: validate-and-coerce helpers ---


_TYPE_VALUES = {member.value for member in NotificationType}
_TITLE_BOUNDS = (1, 120)
_MESSAGE_BOUNDS = (1, 2000)


def _coerce_type(value: NotificationType | str) -> NotificationType:
    if isinstance(value, NotificationType):
        return value
    if isinstance(value, str) and value in _TYPE_VALUES:
        return NotificationType(value)
    raise InvalidNotificationType(
        f"type must be one of {sorted(_TYPE_VALUES)}; got {value!r}"
    )


def _validate_content(*, title: str, message: str) -> tuple[str, str]:
    if not isinstance(title, str) or not title.strip():
        raise InvalidNotificationContent("title must be non-empty")
    if not isinstance(message, str) or not message.strip():
        raise InvalidNotificationContent("message must be non-empty")
    if not (_TITLE_BOUNDS[0] <= len(title) <= _TITLE_BOUNDS[1]):
        raise InvalidNotificationContent(
            f"title length must be in {_TITLE_BOUNDS}"
        )
    if not (_MESSAGE_BOUNDS[0] <= len(message) <= _MESSAGE_BOUNDS[1]):
        raise InvalidNotificationContent(
            f"message length must be in {_MESSAGE_BOUNDS}"
        )
    return title, message


def _ensure_active_user(session: Session, recipient_id: int) -> User:
    user = get_user_by_id(session, recipient_id)
    if user is None:
        raise RecipientNotFound(
            f"recipient_id={recipient_id} does not exist"
        )
    if not user.is_active:
        raise RecipientInactive(
            f"recipient_id={recipient_id} is not active"
        )
    return user


# --- Public publish entry point (called by upstream modules) ---


def publish(
    session: Session,
    *,
    recipient_id: int,
    title: str,
    message: str,
    type: NotificationType | str,
    dedup_key: str | None = None,
    email_channel: bool = False,
) -> Notification:
    """Single boundary for inserting a `Notification` row.

    Uses the **caller's session**: does not commit, does not rollback. The
    upstream caller (or the route's session-bound handler) owns transactional
    binding (FR-013). When the upstream service rolls back, this row is rolled
    back with it.

    Raises typed exceptions; routes map each to HTTP 422 (or 404 for
    `NotificationNotFound`). The `email_channel` flag is accepted for API
    forward-compat with US4; no-op for now (channel is gated by an env flag
    and a future BackgroundTasks queue — see specs/008-notifications/plan.md).
    """

    coerced_type = _coerce_type(type)
    title_, message_ = _validate_content(title=title, message=message)
    _ensure_active_user(session, recipient_id)
    return notifications_repo.insert_notification(
        session,
        user_id=recipient_id,
        title=title_,
        message=message_,
        type_=coerced_type.value,
        dedup_key=dedup_key,
    )


# --- Caller-scoped feed surface ---


_FEED_LIMIT_MIN, _FEED_LIMIT_MAX = 1, 200
_FEED_OFFSET_MIN = 0


def list_notifications_for_user(
    session: Session,
    *,
    current_user: User,
    limit: int,
    offset: int,
) -> NotificationFeed:
    """Return the caller's feed page in `created_at` desc order."""

    if not (_FEED_LIMIT_MIN <= limit <= _FEED_LIMIT_MAX):
        raise InvalidPagination(
            f"limit must be in [{_FEED_LIMIT_MIN}, {_FEED_LIMIT_MAX}]; "
            f"got {limit}"
        )
    if offset < _FEED_OFFSET_MIN:
        raise InvalidPagination(
            f"offset must be >= {_FEED_OFFSET_MIN}; got {offset}"
        )
    items, unread, total = notifications_repo.list_for_user(
        session,
        user_id=current_user.id,  # type: ignore[arg-type]
        limit=limit,
        offset=offset,
    )
    return NotificationFeed(
        items=[NotificationRead.model_validate(row) for row in items],
        unread_count=unread,
        total=total,
        limit=limit,
        offset=offset,
    )


def mark_notification_read(
    session: Session,
    *,
    notification_id: int,
    current_user: User,
) -> MarkReadResponse:
    """Flip `is_read` (idempotent). Cross-user calls return 404 (FR-005)."""

    notification = notifications_repo.get_for_user(
        session,
        notification_id=notification_id,
        user_id=current_user.id,  # type: ignore[arg-type]
    )
    if notification is None:
        raise NotificationNotFound(
            f"notification_id={notification_id} not found"
        )
    notification = notifications_repo.mark_read(
        session, notification=notification
    )
    session.commit()
    session.refresh(notification)
    # `read_at` is non-null after mark_read because either we just stamped it
    # or it was already stamped on a prior call.
    assert notification.read_at is not None
    return MarkReadResponse(
        id=notification.id,  # type: ignore[arg-type]
        is_read=True,
        read_at=notification.read_at,
    )


# --- Admin broadcast surface ---


def _resolve_recipients(
    session: Session, *, recipients: BroadcastRecipients
) -> list[int]:
    """Return the active user-id list for a broadcast selector.

    Raises `InvalidRecipientIds` for the `user_ids` selector when any id is
    missing or inactive (all-or-nothing per FR-019).
    """

    if recipients.all is True:
        rows = session.exec(
            select(User.id).where(User.is_active == True)  # noqa: E712
        ).all()
        return _dedupe_ids(rows)
    if recipients.role is not None:
        rows = session.exec(
            select(User.id).where(
                User.role == recipients.role,
                User.is_active == True,  # noqa: E712
            )
        ).all()
        return _dedupe_ids(rows)
    assert recipients.user_ids is not None  # validated by Pydantic
    requested = list(dict.fromkeys(recipients.user_ids))
    invalid: list[int] = []
    resolved: list[int] = []
    for uid in requested:
        user = get_user_by_id(session, uid)
        if user is None or not user.is_active:
            invalid.append(uid)
        else:
            resolved.append(uid)
    if invalid:
        raise InvalidRecipientIds(invalid)
    return resolved


def _dedupe_ids(rows: Iterable[Any]) -> list[int]:
    seen: dict[int, None] = {}
    for row in rows:
        # SQLAlchemy may return either bare ints or single-column rows.
        value = row if isinstance(row, int) else row[0]
        if value not in seen:
            seen[int(value)] = None
    return list(seen.keys())


def broadcast(
    session: Session,
    *,
    request: BroadcastRequest,
    current_user: User,
) -> BroadcastResult:
    """Admin-only fan-out that creates one notification per resolved recipient.

    All-or-nothing: invalid user_ids → 422 with no rows persisted (FR-019).
    """

    if current_user.role != "admin":
        # Defence in depth — the route also gates with require_admin.
        raise PermissionError("only admins may broadcast")

    coerced_type = _coerce_type(request.type)
    title_, message_ = _validate_content(
        title=request.title, message=request.message
    )
    resolved = _resolve_recipients(session, recipients=request.recipients)
    if not resolved:
        return BroadcastResult(
            created=0, type=coerced_type, recipients_resolved=0
        )

    now = datetime.now(timezone.utc)
    rows = [
        {
            "user_id": uid,
            "title": title_,
            "message": message_,
            "type": coerced_type.value,
            "is_read": False,
            "read_at": None,
            "created_at": now,
            "dedup_key": None,
        }
        for uid in resolved
    ]
    created = notifications_repo.bulk_insert_notifications(
        session, rows=rows
    )
    session.commit()
    return BroadcastResult(
        created=created,
        type=coerced_type,
        recipients_resolved=len(resolved),
    )


__all__ = [
    "publish",
    "list_notifications_for_user",
    "mark_notification_read",
    "broadcast",
    # Exceptions
    "NotificationServiceError",
    "InvalidNotificationType",
    "InvalidNotificationContent",
    "RecipientNotFound",
    "RecipientInactive",
    "NotificationNotFound",
    "InvalidPagination",
    "InvalidRecipientIds",
]

"""Notifications module: all database queries. No business logic, no HTTP concerns.

Every function here takes a `Session` from the caller and never commits — the
service layer (and through it, the upstream caller for producer hooks) owns
transaction boundaries (FR-013).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, insert
from sqlmodel import Session, select

from app.modules.notifications.model import Notification


def list_for_user(
    session: Session,
    *,
    user_id: int,
    limit: int,
    offset: int,
) -> tuple[list[Notification], int, int]:
    """Return (items, unread_count, total) for the given user.

    Two round-trips: one for the page, one combined COUNT for unread + total
    (FR-025).
    """

    items_stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list(session.exec(items_stmt).all())

    counts_stmt = select(
        func.count()
        .filter(Notification.is_read == False)  # noqa: E712
        .label("unread"),
        func.count().label("total"),
    ).where(Notification.user_id == user_id)
    row = session.exec(counts_stmt).one()
    unread_count = int(row[0] or 0)
    total = int(row[1] or 0)
    return items, unread_count, total


def get_for_user(
    session: Session,
    *,
    notification_id: int,
    user_id: int,
) -> Notification | None:
    """Fetch a single notification scoped to the caller.

    Returns None if the row does not exist OR is owned by a different user
    (FR-005 — the caller maps both to 404 to avoid existence leakage).
    """

    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    return session.exec(stmt).first()


def mark_read(
    session: Session, *, notification: Notification
) -> Notification:
    """Flip `is_read` once and stamp `read_at`. Idempotent on subsequent calls.

    Does NOT commit — the caller controls the transaction.
    """

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        session.add(notification)
        session.flush()
    return notification


def insert_notification(
    session: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    type_: str,
    dedup_key: str | None = None,
) -> Notification:
    """Single-row INSERT used by `service.publish`.

    Caller controls the transaction. Does NOT commit.
    """

    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type_,
        dedup_key=dedup_key,
    )
    session.add(notification)
    session.flush()
    session.refresh(notification)
    return notification


def bulk_insert_notifications(
    session: Session, *, rows: list[dict[str, Any]]
) -> int:
    """Bulk INSERT for broadcast fan-out — single round-trip (FR-025).

    Returns the count of rows inserted. Caller controls the transaction.
    """

    if not rows:
        return 0
    stmt = insert(Notification.__table__).values(rows)
    result = session.exec(stmt)
    session.flush()
    rowcount = getattr(result, "rowcount", None)
    return int(rowcount) if rowcount and rowcount > 0 else len(rows)

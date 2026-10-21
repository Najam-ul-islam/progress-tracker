"""Notifications module: HTTP routing only. Delegates to services.

Every route body is a thin try/except mapping typed service exceptions to
canonical HTTP responses per
`specs/008-notifications/contracts/notifications.openapi.yaml`.

Guard ordering on every endpoint: 401 → 403 → 404 → 422 (FR-016).
Cross-user PATCH/read deliberately returns **404 not 403** to avoid leaking
notification existence (FR-005).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.notifications import service as notifications_service
from app.modules.notifications.schema import (
    BroadcastRequest,
    BroadcastResult,
    MarkReadResponse,
    NotificationFeed,
)
from app.modules.users.model import User


router = APIRouter(tags=["notifications"])


@router.get("", response_model=NotificationFeed)
def list_my_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> NotificationFeed:
    try:
        return notifications_service.list_notifications_for_user(
            session,
            current_user=current_user,
            limit=limit,
            offset=offset,
        )
    except notifications_service.InvalidPagination as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.patch(
    "/{notification_id}/read",
    response_model=MarkReadResponse,
)
def mark_notification_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MarkReadResponse:
    try:
        return notifications_service.mark_notification_read(
            session,
            notification_id=notification_id,
            current_user=current_user,
        )
    except notifications_service.NotificationNotFound as exc:
        # FR-005: conflate "not yours" with "not found" — 404, never 403.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/send",
    response_model=BroadcastResult,
    status_code=status.HTTP_201_CREATED,
)
def send_broadcast(
    payload: BroadcastRequest,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_admin),
) -> BroadcastResult:
    try:
        return notifications_service.broadcast(
            session,
            request=payload,
            current_user=requester,
        )
    except notifications_service.InvalidRecipientIds as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": str(exc),
                "invalid_ids": exc.invalid_ids,
            },
        )
    except notifications_service.InvalidNotificationType as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except notifications_service.InvalidNotificationContent as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

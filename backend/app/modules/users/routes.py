"""Users module: HTTP routing only. Delegates to services.

No business logic, no DB access. Endpoints translate service-level exceptions
into the canonical HTTP responses defined in `contracts/openapi.yaml`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    require_admin,
    require_any,
)
from app.modules.users import service as users_service
from app.modules.users.model import User
from app.modules.users.schema import UserRead, UserStatusUpdate, UserUpdate


router = APIRouter(tags=["users"])

_NOT_FOUND = "User not found"
_FORBIDDEN = "Forbidden"


@router.get("/me", response_model=UserRead)
def get_my_profile(requester: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(requester)


@router.get("", response_model=list[UserRead])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> list[UserRead]:
    return users_service.list_users(session)


@router.get("/developers", response_model=list[UserRead])
def list_developers(
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> list[UserRead]:
    return users_service.list_developers(session)


@router.get("/{id}", response_model=UserRead)
def get_user_by_id(
    id: int,
    session: Session = Depends(get_session),
    requester: User = Depends(get_current_user),
) -> UserRead:
    try:
        return users_service.get_user_profile(
            session, target_id=id, requester=requester
        )
    except users_service.ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        )
    except users_service.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )


@router.patch("/{id}", response_model=UserRead)
def update_user(
    id: int,
    patch: UserUpdate,
    session: Session = Depends(get_session),
    requester: User = Depends(require_admin),
) -> UserRead:
    try:
        return users_service.update_user_profile(
            session, target_id=id, patch=patch, requester=requester
        )
    except users_service.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )
    except users_service.LastAdminError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        )


@router.patch("/{id}/status", response_model=UserRead)
def change_user_status(
    id: int,
    patch: UserStatusUpdate,
    session: Session = Depends(get_session),
    requester: User = Depends(require_admin),
) -> UserRead:
    try:
        return users_service.change_user_status(
            session, target_id=id, patch=patch, requester=requester
        )
    except users_service.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )
    except (
        users_service.LastAdminError,
        users_service.SelfDeactivationError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        )

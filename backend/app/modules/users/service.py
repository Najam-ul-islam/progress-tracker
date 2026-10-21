"""Users module: all business logic. The only legal home for domain rules.

Routes call into this module; this module calls `users.repository` for
persistence and raises typed exceptions that the routes layer translates into
the HTTP responses documented in `contracts/openapi.yaml`.
"""

from __future__ import annotations

import logging

from sqlmodel import Session

from app.modules.users import repository as users_repo
from app.modules.users.model import User
from app.modules.users.schema import (
    UserRead,
    UserStatusUpdate,
    UserUpdate,
)


logger = logging.getLogger(__name__)


class UserNotFoundError(Exception):
    """Target user id does not exist (FR-019 → HTTP 404)."""


class ForbiddenError(Exception):
    """Caller is authenticated but not allowed to perform this action
    (developer non-self read; FR-005 → HTTP 403)."""


class LastAdminError(Exception):
    """Last-admin invariant would be violated by this write
    (FR-014 → HTTP 409). The exception message carries the human-readable detail."""


class SelfDeactivationError(Exception):
    """An admin cannot deactivate themselves (FR-014 second leg → HTTP 409)."""


def get_user_profile(
    session: Session, *, target_id: int, requester: User
) -> UserRead:
    """Fetch a user record. Enforces the developer-self-only rule (FR-005)
    *before* the lookup so a developer cannot probe id existence via 404.
    Admin/manager get the lookup first → 404 if missing (FR-019)."""
    if requester.role == "developer" and target_id != requester.id:
        logger.info(
            "users.get_user_profile: forbidden requester_id=%s target_id=%s",
            requester.id,
            target_id,
        )
        raise ForbiddenError()

    user = users_repo.get_user_by_id(session, target_id)
    if user is None:
        raise UserNotFoundError(target_id)
    return UserRead.model_validate(user)


def list_users(session: Session) -> list[UserRead]:
    """Admin/manager only — gated at the route by `Depends(require_any(...))`."""
    return [UserRead.model_validate(u) for u in users_repo.list_users(session)]


def list_developers(session: Session) -> list[UserRead]:
    """Admin/manager only — gated at the route. Filters role+is_active at the repo."""
    return [
        UserRead.model_validate(u)
        for u in users_repo.list_developers(session)
    ]


def update_user_profile(
    session: Session,
    *,
    target_id: int,
    patch: UserUpdate,
    requester: User,
) -> UserRead:
    """Admin-only patch (gated at the route). Enforces FR-014: refuses to demote
    or deactivate the last remaining active admin via a transactional count."""
    user = users_repo.get_user_by_id(session, target_id)
    if user is None:
        raise UserNotFoundError(target_id)

    demoting_admin = (
        user.role == "admin"
        and patch.role is not None
        and patch.role != "admin"
    )
    deactivating_admin = (
        user.role == "admin"
        and user.is_active is True
        and patch.is_active is False
    )

    if demoting_admin or deactivating_admin:
        remaining = users_repo.count_active_admins(
            session, exclude_id=target_id
        )
        if remaining == 0:
            message = (
                "cannot demote the last remaining admin"
                if demoting_admin
                else "cannot deactivate the last remaining admin"
            )
            logger.info(
                "users.update_user_profile: last-admin guard fired target_id=%s",
                target_id,
            )
            raise LastAdminError(message)

    fields = patch.model_dump(exclude_none=True)
    user = users_repo.update_user(session, user, **fields)
    logger.info(
        "users.update_user_profile: user_id=%s changed=%s",
        user.id,
        list(fields.keys()),
    )
    return UserRead.model_validate(user)


def change_user_status(
    session: Session,
    *,
    target_id: int,
    patch: UserStatusUpdate,
    requester: User,
) -> UserRead:
    """Admin-only flag flip (gated at the route). Refuses self-deactivation
    and the last-admin deactivation (both FR-014)."""
    user = users_repo.get_user_by_id(session, target_id)
    if user is None:
        raise UserNotFoundError(target_id)

    if requester.id == target_id and patch.is_active is False:
        # Last-admin guard would catch this if the requester is the only admin,
        # but a self-deactivate is independently disallowed (FR-014 second leg).
        if user.role == "admin":
            remaining = users_repo.count_active_admins(
                session, exclude_id=target_id
            )
            if remaining == 0:
                logger.info(
                    "users.change_user_status: last-admin guard fired target_id=%s",
                    target_id,
                )
                raise LastAdminError(
                    "cannot deactivate the last remaining admin"
                )
        raise SelfDeactivationError("cannot deactivate yourself")

    if (
        patch.is_active is False
        and user.role == "admin"
        and user.is_active is True
    ):
        remaining = users_repo.count_active_admins(
            session, exclude_id=target_id
        )
        if remaining == 0:
            logger.info(
                "users.change_user_status: last-admin guard fired target_id=%s",
                target_id,
            )
            raise LastAdminError(
                "cannot deactivate the last remaining admin"
            )

    user = users_repo.update_user(session, user, is_active=patch.is_active)
    logger.info(
        "users.change_user_status: user_id=%s is_active=%s",
        user.id,
        user.is_active,
    )
    return UserRead.model_validate(user)

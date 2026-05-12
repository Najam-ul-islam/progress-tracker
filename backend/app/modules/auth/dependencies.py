"""Auth module: FastAPI Depends() factories. No business logic, no DB queries.

This module is the *only* place in the codebase outside `app.core.security` that
decodes a JWT (FR-013 / FR-017 / SC-006). Other modules import from here:

    from app.modules.auth.dependencies import get_current_user, require_admin
"""

from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.core.security import TokenError, decode_access_token
from app.db.session import get_session
from app.modules.auth import repository as auth_repo
from app.modules.users.model import User


logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

_GENERIC_AUTH_ERROR = "Could not validate credentials"
_FORBIDDEN_ERROR = "Forbidden"


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=_GENERIC_AUTH_ERROR,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    if not token:
        logger.info("auth.get_current_user: missing bearer token")
        raise _credentials_exception()

    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        logger.info("auth.get_current_user: token rejected (%s)", exc)
        raise _credentials_exception()

    sub = payload.get("sub")
    try:
        user_id = int(sub) if sub is not None else None
    except (TypeError, ValueError):
        user_id = None

    if user_id is None:
        raise _credentials_exception()

    user = auth_repo.get_user_by_id(session, user_id)
    if user is None:
        # FR-021: token without principal is not a session.
        logger.info("auth.get_current_user: user_id=%s not found", user_id)
        raise _credentials_exception()
    return user


def require_any(*roles: str):
    """Dependency factory: yield the principal only if their role is in `roles`,
    otherwise HTTP 403 with a generic body (FR-014 / FR-015 / SC-004)."""

    allowed = frozenset(roles)

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            logger.info(
                "auth.require_any: role=%s not in %s (user_id=%s)",
                current_user.role,
                tuple(allowed),
                current_user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=_FORBIDDEN_ERROR,
            )
        return current_user

    return _dependency


require_admin = require_any("admin")
require_manager = require_any("manager")
require_developer = require_any("developer")


__all__ = [
    "get_current_user",
    "require_any",
    "require_admin",
    "require_manager",
    "require_developer",
]

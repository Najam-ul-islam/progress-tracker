"""Auth module: all business logic. The only legal home for domain rules.

Routes call into this module; this module calls `core.security` for cryptographic
primitives and `auth.repository` (a thin facade over `users.repository`) for
persistence.
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.security import (
    TokenError,
    create_access_token,
    hash_password,
    verify_password,
)
from app.modules.auth import repository as auth_repo
from app.modules.auth.schema import TokenResponse, UserCreate, UserLogin, UserRead
from app.modules.users.model import User


logger = logging.getLogger(__name__)


class EmailAlreadyExistsError(Exception):
    """Email is already registered (FR-003 → HTTP 409)."""


class InvalidCredentialsError(Exception):
    """Generic auth failure: unknown email *or* wrong password (FR-007 / SC-005 →
    one byte-identical HTTP 401)."""


def register_user(session: Session, payload: UserCreate) -> User:
    existing = auth_repo.get_user_by_email(session, payload.email)
    if existing is not None:
        raise EmailAlreadyExistsError(payload.email)

    try:
        user = auth_repo.create_user(
            session,
            name=payload.name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
    except IntegrityError as exc:
        # Race: another request inserted the same email between the pre-check
        # and the commit. Surface as 409, not 500 (FR-003).
        session.rollback()
        raise EmailAlreadyExistsError(payload.email) from exc

    logger.info("auth.register_user: user_id=%s email=%s role=%s", user.id, user.email, user.role)
    return user


def authenticate_user(session: Session, *, email: str, password: str) -> User:
    user = auth_repo.get_user_by_email(session, email)
    if user is None or not verify_password(password, user.password_hash):
        # Single error for both cases — no user-enumeration leak (FR-007 / SC-005).
        logger.info("auth.authenticate_user: failure email=%s", email)
        raise InvalidCredentialsError()
    if not user.is_active:
        # FR-013: deactivated users cannot log in. Same exception → byte-identical 401.
        logger.info("auth.authenticate_user: inactive user email=%s", email)
        raise InvalidCredentialsError()
    return user


def login_user(session: Session, payload: UserLogin) -> TokenResponse:
    user = authenticate_user(session, email=payload.email, password=payload.password)
    assert user.id is not None  # row from DB always has an id
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    logger.info("auth.login_user: success user_id=%s", user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


__all__ = [
    "EmailAlreadyExistsError",
    "InvalidCredentialsError",
    "TokenError",
    "register_user",
    "authenticate_user",
    "login_user",
]

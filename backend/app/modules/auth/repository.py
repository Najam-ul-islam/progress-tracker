"""Auth module: thin facade over `users.repository`.

Per ADR-0003 / FR-016 / SC-007 the User entity is owned by the `users` module.
This file is the only place where the auth module touches user persistence;
auth.service must import from here, never from `users.model` or `users.repository`.
No SQL is issued in this file — every helper is a pass-through.
"""

from __future__ import annotations

from sqlmodel import Session

from app.modules.users import repository as _users_repo
from app.modules.users.model import User, UserRole


def get_user_by_email(session: Session, email: str) -> User | None:
    return _users_repo.get_user_by_email(session, email)


def get_user_by_id(session: Session, user_id: int) -> User | None:
    return _users_repo.get_user_by_id(session, user_id)


def create_user(
    session: Session,
    *,
    name: str,
    email: str,
    password_hash: str,
    role: UserRole,
) -> User:
    return _users_repo.create_user(
        session,
        name=name,
        email=email,
        password_hash=password_hash,
        role=role,
    )

"""Users module: all database queries. No business logic, no HTTP concerns.

This is the only legal home for SQL against the `user` table (ADR-0003).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.modules.users.model import User, UserRole


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def get_user_by_id(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def create_user(
    session: Session,
    *,
    name: str,
    email: str,
    password_hash: str,
    role: UserRole,
) -> User:
    user = User(name=name, email=email, password_hash=password_hash, role=role)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def list_users(session: Session) -> list[User]:
    return list(session.exec(select(User).order_by(User.id)).all())


def list_developers(session: Session) -> list[User]:
    statement = (
        select(User)
        .where(User.role == "developer", User.is_active == True)  # noqa: E712
        .order_by(User.id)
    )
    return list(session.exec(statement).all())


def update_user(session: Session, user: User, **fields: Any) -> User:
    for key, value in fields.items():
        setattr(user, key, value)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def count_active_admins(
    session: Session, *, exclude_id: int | None = None
) -> int:
    statement = select(func.count()).select_from(User).where(
        User.role == "admin",
        User.is_active == True,  # noqa: E712
    )
    if exclude_id is not None:
        statement = statement.where(User.id != exclude_id)
    result = session.exec(statement).one()
    return int(result)

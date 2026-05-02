"""Users module: all database queries. No business logic, no HTTP concerns.

This is the only legal home for SQL against the `user` table (ADR-0003).
"""

from __future__ import annotations

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

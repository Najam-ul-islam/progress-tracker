"""Shared pytest fixtures for the auth feature integration tests.

Uses an in-memory SQLite engine (one engine per test) and overrides
`app.db.session.get_session` via FastAPI dependency overrides so production
Postgres is never touched by the suite.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# Ensure required env vars exist *before* any application module is imported
# (FR-010: missing JWT_SECRET_KEY would fail boot).
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-do-not-use-in-prod")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.db.base import SQLModel
from app.db.session import get_session
from app.main import app

# Import every module's model so SQLModel.metadata.create_all picks them up.
from app.modules.clients.model import Client  # noqa: F401
from app.modules.users.model import User  # noqa: F401


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(name="session")
def session_fixture(engine) -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session) -> Iterator[TestClient]:
    def _override_get_session() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(name="seed_user")
def seed_user_fixture(session):
    """Factory: returns a callable that inserts a user with a real bcrypt hash."""
    from app.core.security import hash_password
    from app.modules.users.repository import create_user

    def _make(
        *,
        name: str = "Test User",
        email: str = "test@example.com",
        password: str = "correct-horse",
        role: str = "developer",
    ) -> User:
        return create_user(
            session,
            name=name,
            email=email.lower().strip(),
            password_hash=hash_password(password),
            role=role,  # type: ignore[arg-type]
        )

    return _make


@pytest.fixture(name="seed_admin")
def seed_admin_fixture(seed_user):
    def _make(
        *,
        name: str = "Ada Admin",
        email: str = "admin@example.com",
        password: str = "correct-horse",
    ) -> User:
        return seed_user(name=name, email=email, password=password, role="admin")

    return _make


@pytest.fixture(name="seed_manager")
def seed_manager_fixture(seed_user):
    def _make(
        *,
        name: str = "Mia Manager",
        email: str = "manager@example.com",
        password: str = "correct-horse",
    ) -> User:
        return seed_user(name=name, email=email, password=password, role="manager")

    return _make


@pytest.fixture(name="seed_developer")
def seed_developer_fixture(seed_user):
    def _make(
        *,
        name: str = "Dev One",
        email: str = "dev@example.com",
        password: str = "correct-horse",
    ) -> User:
        return seed_user(name=name, email=email, password=password, role="developer")

    return _make


@pytest.fixture(name="make_token")
def make_token_fixture():
    from app.core.security import create_access_token

    def _make(user: User) -> str:
        assert user.id is not None
        return create_access_token(
            user_id=user.id, email=user.email, role=user.role
        )

    return _make


@pytest.fixture(name="auth_header")
def auth_header_fixture(make_token):
    def _make(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {make_token(user)}"}

    return _make

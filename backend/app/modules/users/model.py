"""Users module: SQLModel table definitions only. No business logic, no schemas.

The `User` entity is owned by this module (ADR-0003 / FR-016). The `auth` module
consumes it through `users.repository` only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import CheckConstraint
from sqlmodel import Field

from app.db.base import SQLModel


UserRole = Literal["admin", "manager", "developer"]


class User(SQLModel, table=True):
    __tablename__ = "user"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager', 'developer')",
            name="ck_user_role",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(min_length=1, max_length=120, nullable=False)
    email: str = Field(
        min_length=3,
        max_length=320,
        nullable=False,
        unique=True,
        index=True,
        sa_column_kwargs={"name": "email"},
    )
    password_hash: str = Field(nullable=False)
    role: str = Field(nullable=False, max_length=16)
    # Note: UserRole literal contract is enforced at the schema layer (UserCreate)
    # and at the DB layer (CheckConstraint above). Stored as `str` because SQLModel
    # cannot introspect typing.Literal annotations into a SQLAlchemy column type.
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

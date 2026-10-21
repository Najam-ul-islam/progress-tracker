"""Clients module: SQLModel table definitions only. No business logic, no schemas.

The `Client` entity is owned by this module (FR-001 / FR-003 / ADR-0003 spirit).
Other modules (e.g. `projects` when it ships) consume it via a foreign key on
`client.id`; they MUST NOT redefine the entity.
"""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from sqlmodel import Field

from app.db.base import SQLModel


class Client(SQLModel, table=True):
    __tablename__ = "client"
    # Partial unique indexes — uniqueness applies only to active rows so a
    # soft-deleted client frees its email/phone for re-use (FR-009 / Edge Case;
    # research.md R1). The dialect-prefixed `*_where` kwargs let the same
    # declaration cover Postgres (prod) and SQLite (tests).
    __table_args__ = (
        sa.Index(
            "ix_client_email_active",
            "email",
            unique=True,
            postgresql_where=sa.text("is_active = TRUE"),
            sqlite_where=sa.text("is_active = 1"),
        ),
        sa.Index(
            "ix_client_phone_active",
            "phone",
            unique=True,
            postgresql_where=sa.text("is_active = TRUE"),
            sqlite_where=sa.text("is_active = 1"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(min_length=1, max_length=120, nullable=False)
    email: str = Field(min_length=3, max_length=320, nullable=False)
    phone: str = Field(min_length=8, max_length=40, nullable=False)
    company_name: str | None = Field(default=None, max_length=200, nullable=True)
    address: str | None = Field(default=None, max_length=500, nullable=True)
    notes: str | None = Field(default=None, nullable=True)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

"""Projects module: SQLModel table definitions only. No business logic, no schemas.

The `Project` and `ProjectModule` entities are owned by this module
(FR-001 / FR-003 / FR-004 / FR-028 / ADR-0003 spirit). The future `payments`
module will FK to `project.id` and `project_module.id`; it MUST NOT redefine
the entities.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import sqlalchemy as sa
from sqlmodel import Field

from app.db.base import SQLModel


class Project(SQLModel, table=True):
    __tablename__ = "project"
    __table_args__ = (
        sa.CheckConstraint(
            "total_amount > 0", name="ck_project_total_amount_positive"
        ),
        sa.CheckConstraint(
            "end_date >= start_date", name="ck_project_date_range"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'completed')",
            name="ck_project_status",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(min_length=1, max_length=200, nullable=False)
    description: str | None = Field(default=None, nullable=True)
    client_id: int = Field(
        foreign_key="client.id",
        nullable=False,
        index=True,
        sa_column_kwargs={"name": "client_id"},
    )
    total_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        nullable=False,
    )
    company_share: Decimal = Field(
        default=Decimal("30.00"),
        max_digits=5,
        decimal_places=2,
        nullable=False,
    )
    developer_share: Decimal = Field(
        default=Decimal("70.00"),
        max_digits=5,
        decimal_places=2,
        nullable=False,
    )
    start_date: date = Field(nullable=False)
    end_date: date = Field(nullable=False)
    status: str = Field(default="pending", max_length=16, nullable=False)
    is_active: bool = Field(default=True, nullable=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ProjectModule(SQLModel, table=True):
    __tablename__ = "project_module"
    __table_args__ = (
        sa.CheckConstraint(
            "progress BETWEEN 0 AND 100",
            name="ck_project_module_progress_range",
        ),
        sa.CheckConstraint(
            "share_percentage > 0 AND share_percentage <= 70",
            name="ck_project_module_share_range",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed')",
            name="ck_project_module_status",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(
        foreign_key="project.id",
        nullable=False,
        index=True,
    )
    name: str = Field(min_length=1, max_length=200, nullable=False)
    description: str | None = Field(default=None, nullable=True)
    assigned_developer_id: int = Field(
        foreign_key="user.id",
        nullable=False,
        index=True,
    )
    progress: int = Field(default=0, nullable=False)
    status: str = Field(default="pending", max_length=16, nullable=False)
    share_percentage: Decimal = Field(
        max_digits=5,
        decimal_places=2,
        nullable=False,
    )
    is_active: bool = Field(default=True, nullable=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

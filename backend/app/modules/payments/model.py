"""Payments module: SQLModel table definitions only. No business logic, no schemas.

The `Payment` and `DeveloperPayment` entities form an append-only ledger:

  - `Payment` (parent) — `id`, `project_id`, `total_amount`, `company_amount`,
    `developer_amount`, `created_at` are immutable post-INSERT (FR-019).
    `status` is **derived** by the service layer from children
    (`pending|partial|paid`) and is never operator-settable.

  - `DeveloperPayment` (child) — frozen snapshot of `developer_id`,
    `module_id`, `share_percentage`, `amount` at generation time (FR-018).
    `status` is the only mutable column (`pending → paid`, monotonic).

All FKs use `ON DELETE RESTRICT` (audit-trail durability — SC-005, FR-017).
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import sqlalchemy as sa
from sqlmodel import Field

from app.db.base import SQLModel


class Payment(SQLModel, table=True):
    __tablename__ = "payment"
    __table_args__ = (
        sa.CheckConstraint(
            "total_amount > 0", name="ck_payment_total_amount_positive"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'partial', 'paid')",
            name="ck_payment_status",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(
        foreign_key="project.id",
        nullable=False,
        index=True,
    )
    total_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        nullable=False,
    )
    company_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        nullable=False,
    )
    developer_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        nullable=False,
    )
    status: str = Field(default="pending", max_length=16, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class DeveloperPayment(SQLModel, table=True):
    __tablename__ = "developer_payment"
    __table_args__ = (
        sa.CheckConstraint(
            "share_percentage > 0 AND share_percentage <= 70",
            name="ck_developer_payment_share_range",
        ),
        sa.CheckConstraint(
            "amount >= 0", name="ck_developer_payment_amount_nonneg"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'paid')",
            name="ck_developer_payment_status",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    payment_id: int = Field(
        foreign_key="payment.id",
        nullable=False,
        index=True,
    )
    developer_id: int = Field(
        foreign_key="user.id",
        nullable=False,
        index=True,
    )
    module_id: int = Field(
        foreign_key="project_module.id",
        nullable=False,
        index=True,
    )
    share_percentage: Decimal = Field(
        max_digits=5,
        decimal_places=2,
        nullable=False,
    )
    amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        nullable=False,
    )
    status: str = Field(default="pending", max_length=8, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

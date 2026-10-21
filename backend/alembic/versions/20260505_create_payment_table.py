"""create payment and developer_payment tables

Revision ID: 20260505_payment
Revises: 20260504_project
Create Date: 2026-05-05

Implements data-model.md §"Migration strategy" for feature 006-payments-distribution.
Creates two tables:

  - `payment` (7 columns) — owns parent ledger entry; status derived from children
    (`pending|partial|paid`); FK to `project.id`.
  - `developer_payment` (8 columns) — owns frozen per-module disbursement slice;
    `status` is the only mutable column (`pending → paid`, monotonic).

All FKs use `ON DELETE RESTRICT` because the ledger is an audit trail (SC-005, FR-017).
CHECK constraints encode closed-domain rules for status enums, share-percentage range,
amount non-negativity, and total_amount positivity.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260505_payment"
down_revision = "20260504_project"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("project.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("company_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("developer_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.CheckConstraint(
            "total_amount > 0", name="ck_payment_total_amount_positive"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'partial', 'paid')",
            name="ck_payment_status",
        ),
    )
    op.create_index("ix_payment_project_id", "payment", ["project_id"])

    op.create_table(
        "developer_payment",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "payment_id",
            sa.Integer,
            sa.ForeignKey("payment.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "developer_id",
            sa.Integer,
            sa.ForeignKey("user.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "module_id",
            sa.Integer,
            sa.ForeignKey("project_module.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("share_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "status",
            sa.String(8),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
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
    op.create_index(
        "ix_developer_payment_payment_id",
        "developer_payment",
        ["payment_id"],
    )
    op.create_index(
        "ix_developer_payment_developer_id",
        "developer_payment",
        ["developer_id"],
    )
    op.create_index(
        "ix_developer_payment_module_id",
        "developer_payment",
        ["module_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_developer_payment_module_id", table_name="developer_payment"
    )
    op.drop_index(
        "ix_developer_payment_developer_id", table_name="developer_payment"
    )
    op.drop_index(
        "ix_developer_payment_payment_id", table_name="developer_payment"
    )
    op.drop_table("developer_payment")
    op.drop_index("ix_payment_project_id", table_name="payment")
    op.drop_table("payment")

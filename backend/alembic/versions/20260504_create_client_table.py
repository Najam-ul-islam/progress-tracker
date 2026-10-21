"""create client table

Revision ID: 20260504_client
Revises: 20260503_user_is_active_updated_at
Create Date: 2026-05-04

Implements data-model.md §"Migration outline" for feature 004-clients-management.
Creates the `client` table (10 columns) plus two **partial unique indexes** on
`email` and `phone`, filtered by `is_active = TRUE` so that soft-deleted rows
free their identifiers for re-use (research.md R1).

Server defaults exist only to satisfy NOT NULL during the initial table
creation; the application layer always carries explicit values for `is_active`,
`created_at`, and `updated_at` on subsequent writes (FR-013).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260504_client"
down_revision = "20260503_user_is_active_updated_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )
    op.create_index(
        "ix_client_email_active",
        "client",
        ["email"],
        unique=True,
        postgresql_where=sa.text("is_active = TRUE"),
        sqlite_where=sa.text("is_active = 1"),
    )
    op.create_index(
        "ix_client_phone_active",
        "client",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("is_active = TRUE"),
        sqlite_where=sa.text("is_active = 1"),
    )


def downgrade() -> None:
    op.drop_index("ix_client_phone_active", table_name="client")
    op.drop_index("ix_client_email_active", table_name="client")
    op.drop_table("client")

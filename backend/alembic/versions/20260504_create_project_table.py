"""create project and project_module tables

Revision ID: 20260504_project
Revises: 20260504_client
Create Date: 2026-05-04

Implements data-model.md §"Migration outline" for feature 005-projects. Creates
two tables:

  - `project` (13 columns) — owns lifecycle state (`pending|active|completed`),
    server-set `company_share` / `developer_share`, FK to `client.id`.
  - `project_module` (11 columns) — owns the per-module `share_percentage` and
    `progress` values. FKs to `project.id` and `user.id` (assigned developer).

All FKs use `ON DELETE RESTRICT` because both parent tables are soft-deleted
(soft delete keeps the row alive, so the FK is never orphaned). CHECK
constraints encode the closed-domain rules for status, progress range, share
range, total_amount positivity, and end_date >= start_date — final guards in
addition to the Pydantic / service layers.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260504_project"
down_revision = "20260504_client"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "client_id",
            sa.Integer,
            sa.ForeignKey("client.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "company_share",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("30.00"),
        ),
        sa.Column(
            "developer_share",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("70.00"),
        ),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
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
    op.create_index("ix_project_client_id", "project", ["client_id"])
    op.create_index("ix_project_is_active", "project", ["is_active"])

    op.create_table(
        "project_module",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("project.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "assigned_developer_id",
            sa.Integer,
            sa.ForeignKey("user.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "progress",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("share_percentage", sa.Numeric(5, 2), nullable=False),
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
    op.create_index(
        "ix_project_module_project_id", "project_module", ["project_id"]
    )
    op.create_index(
        "ix_project_module_assigned_developer_id",
        "project_module",
        ["assigned_developer_id"],
    )
    op.create_index(
        "ix_project_module_is_active", "project_module", ["is_active"]
    )


def downgrade() -> None:
    op.drop_index("ix_project_module_is_active", table_name="project_module")
    op.drop_index(
        "ix_project_module_assigned_developer_id", table_name="project_module"
    )
    op.drop_index("ix_project_module_project_id", table_name="project_module")
    op.drop_table("project_module")
    op.drop_index("ix_project_is_active", table_name="project")
    op.drop_index("ix_project_client_id", table_name="project")
    op.drop_table("project")

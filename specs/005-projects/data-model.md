# Data Model: Projects Management

**Feature**: `005-projects`
**Date**: 2026-05-04

## Source of truth

`backend/app/modules/projects/model.py` — created in this feature. Mirroring
ADR-0003 for `User` and the equivalent stance for `Client`: this is the only
definition of the `Project` and `ProjectModule` SQLModels anywhere in the
codebase. The `payments` module (when it ships) FKs to `project.id` and
`project_module.id`; it MUST NOT redefine the entities.

## Entity: `Project`

| Column            | Type                       | Constraints                                                              | Notes                                                                                          |
| ----------------- | -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `id`              | INTEGER                    | PRIMARY KEY, autoincrement                                               | Surrogate key. Stable.                                                                         |
| `name`            | VARCHAR(200)               | NOT NULL, length 1..200                                                  | Display name.                                                                                  |
| `description`     | TEXT                       | NULL                                                                     | Optional plain text.                                                                           |
| `client_id`       | INTEGER                    | NOT NULL, FK → `client.id` ON DELETE RESTRICT, indexed                   | Must reference `is_active = TRUE` row at write time (FR-005).                                   |
| `total_amount`    | NUMERIC(12, 2)             | NOT NULL, CHECK (total_amount > 0)                                       | Money. Decimal in Python; serialised as JSON string on the wire (R10).                          |
| `company_share`   | NUMERIC(5, 2)              | NOT NULL, default 30.00                                                  | Server-set; rejected on `*Create` / `*Update` per FR-018.                                       |
| `developer_share` | NUMERIC(5, 2)              | NOT NULL, default 70.00                                                  | Server-set; rejected on `*Create` / `*Update` per FR-018.                                       |
| `start_date`      | DATE                       | NOT NULL                                                                 | Calendar date.                                                                                 |
| `end_date`        | DATE                       | NOT NULL, CHECK (end_date >= start_date)                                 | Validated at app layer too (FR-006); CHECK is the ultimate guard.                               |
| `status`          | VARCHAR(16)                | NOT NULL, default `'pending'`, CHECK in (`'pending'`, `'active'`, `'completed'`) | Manual `pending → active`; auto `active → completed` (FR-014, FR-015).                           |
| `is_active`       | BOOLEAN                    | NOT NULL, default TRUE                                                   | `false` ⇒ soft-deleted; invisible to public reads (FR-024 / FR-026).                            |
| `created_at`      | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                    | Set by application factory.                                                                    |
| `updated_at`      | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                    | App-layer maintained on every successful write (FR-017).                                        |

### Indexes (Project)

- `PRIMARY KEY (id)`.
- `ix_project_client_id` — non-unique on `(client_id)`. Speeds up the
  per-client project lookup that the projects-from-clients UI will issue.
- `ix_project_is_active` — non-unique on `(is_active)`. Filters the public
  read path (`GET /projects` always reads `is_active = TRUE`).

### Constraints (Project)

- `CHECK (total_amount > 0)` — final guard for FR-003. Enforced again in
  Pydantic.
- `CHECK (end_date >= start_date)` — final guard for FR-006.
- `CHECK (status IN ('pending', 'active', 'completed'))` — final guard for
  FR-015 / FR-014.
- *No CHECK on `company_share` / `developer_share`*: those columns are never
  user-supplied. The closed schema (FR-018) is the only enforcement.

## Entity: `ProjectModule`

| Column                  | Type                       | Constraints                                                                  | Notes                                                                                          |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                    | INTEGER                    | PRIMARY KEY, autoincrement                                                   | Surrogate key.                                                                                 |
| `project_id`            | INTEGER                    | NOT NULL, FK → `project.id` ON DELETE RESTRICT, indexed                      | One project → many modules.                                                                    |
| `name`                  | VARCHAR(200)               | NOT NULL, length 1..200                                                      | Display name.                                                                                  |
| `description`           | TEXT                       | NULL                                                                         | Optional.                                                                                      |
| `assigned_developer_id` | INTEGER                    | NOT NULL, FK → `user.id` ON DELETE RESTRICT, indexed                         | App-layer enforces `role = 'developer'` and `is_active = TRUE` at write time (FR-009).           |
| `progress`              | INTEGER                    | NOT NULL, default 0, CHECK between 0 AND 100                                 | Developer's primary mutation surface (FR-020).                                                  |
| `status`                | VARCHAR(16)                | NOT NULL, default `'pending'`, CHECK in (`'pending'`, `'in_progress'`, `'completed'`) | Derived from `progress` on every write (FR-020).                                                |
| `share_percentage`      | NUMERIC(5, 2)              | NOT NULL, CHECK (share_percentage > 0 AND share_percentage <= 70)            | Sum of active modules' `share_percentage` per project ≤ 70.00 (FR-010, FR-011).                  |
| `is_active`             | BOOLEAN                    | NOT NULL, default TRUE                                                       | Soft-delete flag.                                                                              |
| `created_at`            | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                        |                                                                                                 |
| `updated_at`            | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                        | App-layer maintained on every successful write (FR-017).                                        |

### Indexes (ProjectModule)

- `PRIMARY KEY (id)`.
- `ix_project_module_project_id` — non-unique on `(project_id)`. The hot
  path: every share-cap check, the activation gate, the auto-completion
  scan, and the progress aggregator all read modules-by-project.
- `ix_project_module_assigned_developer_id` — non-unique on
  `(assigned_developer_id)`. Speeds up the developer-visibility filter
  (FR-008).
- `ix_project_module_is_active` — non-unique on `(is_active)`. Filters
  active rows out of the cap-check and progress aggregator queries.

### Constraints (ProjectModule)

- `CHECK (progress BETWEEN 0 AND 100)` — final guard for FR-020.
- `CHECK (share_percentage > 0 AND share_percentage <= 70)` — final guard
  for FR-010. The cap of 70 is the per-project ceiling; the cross-row sum
  rule lives at the app layer (no DB-level cross-row CHECK).
- `CHECK (status IN ('pending', 'in_progress', 'completed'))` — final guard
  for FR-020.

### Why no partial unique indexes here

Unlike clients (where `email` and `phone` are externally meaningful and must
be globally unique among active rows), neither `project` nor `project_module`
has a natural-key column requiring uniqueness. The 70%-cap rule is a *sum*
constraint, not a uniqueness constraint, and is enforced at the service
layer (R3).

## State transitions — Project

```text
                              ┌──────────────┐
   POST /projects     ───────►│  pending     │  status='pending', is_active=TRUE
                              └──────┬───────┘
                                     │
                       PATCH /projects/{id} {status:"active"}
                       (activation gate: SUM(share_percentage)=70.00 over active modules)
                                     │
                                     ▼
                              ┌──────────────┐
                              │  active      │  status='active'
                              └──────┬───────┘
                                     │
                  every active module reaches progress=100
                  (auto on POST /modules, PATCH /modules, PATCH /modules/progress, DELETE /modules)
                                     │
                                     ▼
                              ┌──────────────┐
                              │  completed   │  status='completed'  (rejects all module mutations)
                              └──────┬───────┘
                                     │
                       DELETE /projects/{id}
                       (admin only; soft delete from any status)
                                     │
                                     ▼
                              ┌──────────────┐
                              │ is_active=FALSE │  invisible to public reads
                              └──────────────┘

   No backwards transitions (FR-015).
   No restoration path in this feature.
```

## State transitions — ProjectModule

```text
                              ┌──────────────┐
   POST /projects/{id}/modules ─►│  pending     │  progress=0, status='pending', is_active=TRUE
                              └──────┬───────┘
                                     │
                       PATCH /modules/{id}/progress (1..99)
                                     │
                                     ▼
                              ┌──────────────┐
                              │ in_progress  │
                              └──────┬───────┘
                                     │
                       PATCH /modules/{id}/progress (100)
                                     │
                                     ▼
                              ┌──────────────┐
                              │  completed   │
                              └──────┬───────┘
                                     │
                       DELETE /modules/{id}
                       (admin only; share_percentage freed for re-use)
                                     │
                                     ▼
                              ┌──────────────┐
                              │ is_active=FALSE │
                              └──────────────┘

   `status` is derived from `progress` on every write (FR-020). Clients
   never supply `status` on these endpoints.
```

## Validation rules (per FR)

| FR     | Rule                                                                                                                                                                | Layer                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| FR-003 | `Project` has 13 columns above with the listed types.                                                                                                               | DB migration `20260504_project.py` + SQLModel `Field` declarations. |
| FR-004 | `ProjectModule` has 11 columns above with the listed types.                                                                                                         | Same migration + model.                                      |
| FR-005 | `client_id` references an `is_active = TRUE` row in `client`.                                                                                                       | `projects.service.create_project` calls `clients.repository.get_client_by_id`. |
| FR-006 | `end_date >= start_date`.                                                                                                                                           | Pydantic `model_validator` on `ProjectCreate` / `ProjectUpdate` + DB CHECK. |
| FR-008 | Developers see only projects with at least one assigned active module.                                                                                              | `projects.repository.list_projects_for_user` joins `project_module`. |
| FR-009 | `assigned_developer_id` references a `user` with `role = 'developer'` and `is_active = TRUE`.                                                                       | `projects.service` calls `users.repository.get_user_by_id`.  |
| FR-010 | Sum of `share_percentage` over active modules ≤ 70.00 on POST/PATCH.                                                                                                | `projects.repository.sum_active_module_shares` + `projects.service`. |
| FR-011 | On `PATCH /modules/{id}` the module's own current share is excluded from the sum.                                                                                   | `projects.service.update_module`.                            |
| FR-012 | Empty / all-null PATCH body → 422.                                                                                                                                  | Pydantic `model_validator(mode="after")` on every `*Update` schema. |
| FR-013 | Activation: sum equals exactly 70.00 over active modules.                                                                                                           | `projects.service.activate_project` (called from `update_project` when `status="active"`). |
| FR-014 | Auto `active → completed` when every active module hits `progress = 100`.                                                                                           | `projects.service._maybe_autocomplete_project` invoked from 4 write paths. |
| FR-015 | Backwards transitions rejected.                                                                                                                                     | `projects.service.update_project` raises `IllegalStatusTransitionError`. |
| FR-016 | Module mutations on `completed` projects → 422.                                                                                                                     | `projects.service` precondition check → `CompletedProjectFrozenError`. |
| FR-017 | Every successful write bumps `updated_at` on the entity, AND on the parent project for module writes.                                                               | `projects.repository.{update_project, update_module, soft_delete_*}`. |
| FR-018 | Closed schemas; server-set fields rejected.                                                                                                                         | All Pydantic models use `ConfigDict(extra="forbid")`.        |
| FR-019 | Developer may PATCH progress only for their own modules; admin/manager may PATCH any.                                                                               | `projects.service.update_module_progress` (no DI guard — the rule is data-dependent). |
| FR-020 | `status` derived from `progress`: 0=pending, 1..99=in_progress, 100=completed.                                                                                      | `projects.service._derive_module_status`.                    |
| FR-021 | Progress mutation rejected on non-`active` parent.                                                                                                                  | `projects.service.update_module_progress` precondition.      |
| FR-022 | `GET /projects/{id}/progress` returns simple arithmetic mean over active modules; 0.0 when none.                                                                    | `projects.service.compute_progress` + `repository.list_active_modules`. |
| FR-023 | Soft-deleted modules excluded from caps, gates, auto-completion, aggregator.                                                                                        | All repository queries filter `is_active = TRUE`.            |
| FR-024 | All endpoints require a valid bearer token.                                                                                                                         | `Depends(get_current_user)` on every route.                  |
| FR-025 | `require_admin` / `require_any` from `auth.dependencies` for role gates.                                                                                            | Routes only.                                                  |
| FR-026 | 404 on non-existent or soft-deleted id; body never distinguishes the two.                                                                                           | `projects.service` raises `ProjectNotFoundError` / `ModuleNotFoundError`; route maps to 404. |
| FR-027 | Allowed cross-module imports: `auth.dependencies`, `auth.schema`, `users.repository`, `clients.repository`. Audit script enforces.                                  | `backend/scripts/audit_projects_imports.sh`.                 |
| FR-028 | `Project` and `ProjectModule` defined only in `app/modules/projects/model.py`.                                                                                      | Audit script greps for `class Project(SQLModel, table=True)` / `class ProjectModule(SQLModel, table=True)` outside that path. |

## Schemas (Pydantic v2)

```python
# app/modules/projects/schema.py

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProjectStatus = Literal["pending", "active", "completed"]
ModuleStatus = Literal["pending", "in_progress", "completed"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    client_id: int = Field(gt=0)
    total_amount: Decimal = Field(gt=Decimal("0"), max_digits=12, decimal_places=2)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _date_range(self) -> "ProjectCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    total_amount: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=12, decimal_places=2)
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["active"] | None = None  # only the manual transition is acceptable

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ProjectUpdate":
        if all(
            v is None
            for v in (self.name, self.description, self.total_amount, self.start_date, self.end_date, self.status)
        ):
            raise ValueError("at least one of name/description/total_amount/start_date/end_date/status must be provided")
        return self


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    description: str | None
    client_id: int
    total_amount: Decimal
    company_share: Decimal
    developer_share: Decimal
    start_date: date
    end_date: date
    status: ProjectStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ModuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    assigned_developer_id: int = Field(gt=0)
    share_percentage: Decimal = Field(gt=Decimal("0"), le=Decimal("70"), max_digits=5, decimal_places=2)


class ModuleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    assigned_developer_id: int | None = Field(default=None, gt=0)
    share_percentage: Decimal | None = Field(default=None, gt=Decimal("0"), le=Decimal("70"), max_digits=5, decimal_places=2)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ModuleUpdate":
        if all(
            v is None
            for v in (self.name, self.description, self.assigned_developer_id, self.share_percentage)
        ):
            raise ValueError("at least one of name/description/assigned_developer_id/share_percentage must be provided")
        return self


class ModuleProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    progress: int = Field(ge=0, le=100)


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    project_id: int
    name: str
    description: str | None
    assigned_developer_id: int
    progress: int
    status: ModuleStatus
    share_percentage: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ModuleProgressSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    progress: int
    share_percentage: Decimal


class ProjectProgressResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: int
    progress: float  # presentational; not financial — see Assumptions in spec.md
    modules: list[ModuleProgressSummary]


ProjectListResponse = list[ProjectRead]
ModuleListResponse = list[ModuleRead]
```

## Migration outline (`20260504_project.py`)

```python
"""create project and project_module tables

Revision ID: 20260504_project
Revises: 20260504_client
Create Date: 2026-05-04
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


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
        sa.Column("client_id", sa.Integer, sa.ForeignKey("client.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("company_share", sa.Numeric(5, 2), nullable=False, server_default=sa.text("30.00")),
        sa.Column("developer_share", sa.Numeric(5, 2), nullable=False, server_default=sa.text("70.00")),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.CheckConstraint("total_amount > 0", name="ck_project_total_amount_positive"),
        sa.CheckConstraint("end_date >= start_date", name="ck_project_date_range"),
        sa.CheckConstraint("status IN ('pending', 'active', 'completed')", name="ck_project_status"),
    )
    op.create_index("ix_project_client_id", "project", ["client_id"])
    op.create_index("ix_project_is_active", "project", ["is_active"])

    op.create_table(
        "project_module",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("project.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("assigned_developer_id", sa.Integer, sa.ForeignKey("user.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("progress", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("share_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_project_module_progress_range"),
        sa.CheckConstraint("share_percentage > 0 AND share_percentage <= 70", name="ck_project_module_share_range"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="ck_project_module_status"),
    )
    op.create_index("ix_project_module_project_id", "project_module", ["project_id"])
    op.create_index("ix_project_module_assigned_developer_id", "project_module", ["assigned_developer_id"])
    op.create_index("ix_project_module_is_active", "project_module", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_project_module_is_active", table_name="project_module")
    op.drop_index("ix_project_module_assigned_developer_id", table_name="project_module")
    op.drop_index("ix_project_module_project_id", table_name="project_module")
    op.drop_table("project_module")
    op.drop_index("ix_project_is_active", table_name="project")
    op.drop_index("ix_project_client_id", table_name="project")
    op.drop_table("project")
```

## Referential integrity outlook

- `project.client_id → client.id ON DELETE RESTRICT`. Soft-delete keeps the
  parent row in place, so the FK is never orphaned.
- `project_module.project_id → project.id ON DELETE RESTRICT`. Same logic.
- `project_module.assigned_developer_id → user.id ON DELETE RESTRICT`. The
  user soft-delete in feature 003 keeps the row alive; the FK is never
  orphaned. A future "developer left the company" workflow will re-assign
  modules first, then soft-delete the user.
- The `payments` module (future) will FK to `project.id` and
  `project_module.id`, both with `ON DELETE RESTRICT`.

## Storage footprint estimate

For the medium-term scale target (≤ a few thousand projects, ≤ a few tens of
thousands of modules), both tables together remain well under 20 MB. The
three module-side indexes add ≤ 5 MB combined. No partitioning planned;
same scale envelope as features 003–004.

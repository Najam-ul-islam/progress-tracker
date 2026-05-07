# Research: Projects Management

**Feature**: `005-projects`
**Date**: 2026-05-04
**Status**: All NEEDS CLARIFICATION resolved (3 explicit user decisions baked in: cap-always-equal-at-activation; soft delete; hybrid status flow).

## Scope

This document records the technical decisions taken between the spec and the
plan for the `projects` module. The broader architectural ground (single-source-of-truth
per entity, six-file modular layout, RBAC via `auth.dependencies`, soft-delete pattern,
app-layer `updated_at`, grep-audit-as-CI) is already settled by ADRs 0001/0002/0003 and
features 002/003/004. This file only covers what is new for projects.

---

## R1 — Share-cap rule: when does the sum of module shares get checked?

**Decision**: Two distinct gates.

1. **Cap gate** (every module write): on every successful `POST /projects/{id}/modules`
   and `PATCH /modules/{id}` (when `share_percentage` changes), the post-write sum of
   `share_percentage` across all `is_active = TRUE` modules of the project must be
   `<= Decimal("70.00")`. Equality is allowed.
2. **Activation gate** (manual `pending → active` transition only): on `PATCH /projects/{id}`
   with `{status:"active"}`, the same sum must equal exactly `Decimal("70.00")`.

For `PATCH /modules/{id}` the cap-gate sum excludes the module's own current
`share_percentage` (FR-011) so a no-op PATCH (sending the same value) never
collides with itself.

**Rationale**: The user explicitly chose "Both: cap always, equal at activation"
in the `/sp.specify` clarifier. The cap is the financial invariant — the company's
70% pool can never be over-allocated. The activation gate is the operational
invariant — a project doesn't move out of `pending` until every share has been
parcelled out. Splitting the two rules lets operators iterate on module structure
in `pending` without being blocked by an "everything must add up right now" check.

**Implementation note**: All arithmetic is `Decimal`. The cap and gate values
are class-level constants `MAX_TOTAL_SHARE = Decimal("70.00")` in `service.py`.
Floats are forbidden for share math because `0.1 + 0.2 != 0.3` is exactly the
class of bug we are protecting against — a project that "almost" sums to 70.

**Alternatives considered**:

- *Cap at activation only*: rejected. The operator could over-allocate to 80%
  and never notice until activation, when the only fix is delete-and-rebuild.
- *Equality at every write*: rejected. Impossible to bootstrap (the first
  module of a project can't sum to 70 alone unless its share is 70). Would
  prevent the natural workflow of staging modules before activation.
- *Track running sum on the project row*: rejected. Denormalisation;
  invalidated by every soft-delete. SQL `SUM()` on a small table is the cheap
  path.

📋 Architectural decision detected: dual-gate share rule. Document reasoning
and tradeoffs? Run `/sp.adr projects-share-cap-and-activation-gate`.

---

## R2 — Status state machine: who/what transitions

**Decision**: Hybrid.

| From      | To          | Trigger                                             | Gate                                                                 |
| --------- | ----------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `pending` | `active`    | manual `PATCH /projects/{id}` with `{status:"active"}` | active modules' shares sum to exactly `Decimal("70.00")` (FR-013).    |
| `active`  | `completed` | automatic — fired on every successful module write | every `is_active=TRUE` module of the project has `progress = 100` AND at least one such module exists (FR-014). |

All other transitions are rejected (FR-015):

- `pending → completed` — illegal (must pass through `active`).
- `active → pending` — illegal (no manual de-activation).
- `completed → *` — illegal (terminal; restoration is out of scope).

**Rationale**: The user explicitly chose "Hybrid: activate manual, complete auto"
in the `/sp.specify` clarifier. The `active → completed` rule is intuitive (the
project is done when all the work is done); making it manual would let the
operator forget to flip it. The `pending → active` flip is intentionally manual
because activation is a commitment — the moment after which `share_percentage`
mutations are still allowed but progress mutations begin (FR-021 only permits
progress writes when the project is `active`).

**Where the auto-completion fires** (in `service.py`):

- `add_module()` — after the insert, recompute. (Adding a module pushes total
  to ≥1 module so a brand-new project that auto-completes is structurally
  impossible: no zero-module path triggers this branch.)
- `update_module()` — after the update.
- `update_module_progress()` — after the progress write.
- `soft_delete_module()` — after the delete (deleting the last under-100 module
  could push the project to "every remaining active module is at 100").

The auto-completion check is centralised in a single `service._maybe_autocomplete_project`
helper that all four call sites invoke. This is the minimum viable invariant
preservation; the alternative (a database trigger or a model `@event.listens_for`)
is rejected as out-of-pattern (the project's convention is to do all
state-derivations in the service layer).

**Edge case**: if every module is soft-deleted (count of active modules == 0),
the auto-rule does NOT fire (the spec is explicit: "at least one module exists
AND every active module has progress = 100"). A project with all modules deleted
stays in whatever status it had before. This is a deliberate choice — completing
a project by deleting its modules would be perverse.

**Alternatives considered**:

- *All-manual*: rejected per user decision; also operationally awkward.
- *All-automatic*: rejected per user decision; activation is a commitment that
  should require an explicit operator action.
- *Database trigger for auto-completion*: rejected. Triggers split state
  derivation across two layers (Python service AND a SQL trigger), which is
  exactly the kind of thing that creates "why is the test passing but prod
  failing" mysteries. The project's convention is service-layer rules.

📋 Architectural decision detected: project status state machine.
Document reasoning and tradeoffs? Run `/sp.adr projects-status-transitions`.

---

## R3 — Soft-delete semantics for `Project` AND `ProjectModule`

**Decision**: Both entities carry `is_active: bool` (default TRUE). DELETE
endpoints flip to `FALSE`, bump `updated_at`, return 204.

Per the spec's User Story 7 and FR-024:

- `DELETE /projects/{id}` — admin only. Soft-deletes the project. Does NOT
  cascade to modules in storage (they keep `is_active = TRUE`), but they
  become unreachable through the public API because the only entry point —
  `POST /projects/{project_id}/modules`, `GET /projects/{id}/progress`,
  the developer-visibility filter on `GET /projects` — gates on
  `project.is_active = TRUE`. A soft-deleted project's modules are
  reachable only via `PATCH /modules/{id}` and `PATCH /modules/{id}/progress`,
  both of which check the parent project's `is_active` and return 404.
- `DELETE /modules/{id}` — admin only. Soft-deletes the module. Its
  `share_percentage` is now excluded from the cap sum (FR-010) and the
  activation gate (FR-013), so the operator can re-add a module with the
  same allocation. Excluded from progress aggregation (FR-022, FR-023).

No reactivation endpoint, no hard delete. Mirrors feature 004 exactly.

**Rationale**: The user chose "Soft delete (mirror clients)" in the
`/sp.specify` clarifier. Soft delete is mandatory for the financial-invariants
case anyway: the future `payments` module will FK to `project.id` and
`project_module.id`, and orphaning those FKs would break audit trail
reconstruction. The "deleted module's share is freed" rule is the projects-side
analogue of "deleted client's email is freed" (R1 in feature 004's research).

**Indexes to enforce active-row-only state**:

- No partial unique indexes are needed on `project` or `project_module` —
  there is no per-row uniqueness constraint to enforce (no email-equivalent).
  The cap and activation rules are computed via `SUM()` over `is_active = TRUE`
  rows; that's a query, not an index.
- Standard indexes:
  - `project`: `PRIMARY KEY (id)`, `INDEX (client_id)` (one Client → many
    Projects; the FK lookup is the hot path for the developer-visibility
    filter and any future `GET /clients/{id}/projects` view).
  - `project_module`: `PRIMARY KEY (id)`, `INDEX (project_id)`,
    `INDEX (assigned_developer_id)` (the developer-visibility filter on
    `GET /projects` joins on this).

**Alternatives considered**:

- *Hard delete with `ON DELETE CASCADE`*: rejected per user decision and
  FK-orphaning concern (same as feature 004 R1).
- *Soft delete on Project only; hard delete on Module*: rejected. Asymmetric
  semantics across two related entities are confusing. Mirroring clients keeps
  the codebase pattern uniform.

---

## R4 — Schema layer composition

**Decision**: `app/modules/projects/schema.py` declares six schemas, all
Pydantic v2 with `ConfigDict(extra="forbid")` (and `from_attributes=True` for
read shapes).

- **`ProjectCreate`** — input for `POST /projects`:
  - `name: str` (1..200, required)
  - `description: str | None`
  - `client_id: int` (required, ≥ 1)
  - `total_amount: Decimal` (> 0, max 12 digits, 2 decimals)
  - `start_date: date` (required)
  - `end_date: date` (required)
  - `model_validator(mode="after")` enforces `end_date >= start_date` (FR-006).
  - `extra="forbid"` ⇒ supplying `id`, `status`, `is_active`, `company_share`,
    `developer_share`, `created_at`, or `updated_at` is HTTP 422 (FR-018).
- **`ProjectUpdate`** — input for `PATCH /projects/{id}`:
  - Every field optional: `name`, `description`, `total_amount`, `start_date`,
    `end_date`, `status` (the latter accepts only the literal `"active"` —
    Pydantic literal narrows the manual-transition surface so the type system
    catches `{status:"completed"}` at parse time, FR-014).
  - `model_validator(mode="after")` rejects empty patches (FR-012).
  - `model_validator(mode="after")` re-checks `end_date >= start_date` if both
    are provided OR if only one is provided AND the other is read from the
    existing row at the service layer (the service does the second check).
  - `extra="forbid"` ⇒ `company_share`, `developer_share`, `is_active`,
    `created_at`, `updated_at` rejected.
- **`ProjectRead`** — public output: every persisted field, `from_attributes=True`,
  `extra="forbid"`. Includes `is_active` (admins see deactivation in audit
  views — same trade-off as feature 004 R3).
- **`ModuleCreate`** — input for `POST /projects/{id}/modules`:
  - `name: str` (1..200, required)
  - `description: str | None`
  - `assigned_developer_id: int` (required, ≥ 1)
  - `share_percentage: Decimal` (0.01..70.00, max 5 digits, 2 decimals)
  - `extra="forbid"` ⇒ supplying `id`, `project_id` (taken from path),
    `progress`, `status`, `is_active`, `created_at`, `updated_at` is HTTP 422.
- **`ModuleUpdate`** — input for `PATCH /modules/{id}`:
  - Every field optional: `name`, `description`, `assigned_developer_id`,
    `share_percentage`. `progress` and `status` are NOT in this schema
    (progress has its own dedicated endpoint; status is derived).
  - `model_validator` rejects empty patches.
- **`ModuleProgressUpdate`** — input for `PATCH /modules/{id}/progress`:
  - `progress: int = Field(ge=0, le=100)` — single required field.
  - `extra="forbid"`.
- **`ModuleRead`** — public output: every persisted module field,
  `from_attributes=True`, `extra="forbid"`.
- **`ProjectProgressResponse`** — output for `GET /projects/{id}/progress`:
  - `project_id: int`, `progress: float` (rounded to 1 decimal),
    `modules: list[ModuleProgressItem]` where each item is
    `{id, name, progress, share_percentage}`.

**Rationale**: One Pydantic schema per (entity × operation) lane keeps the
type signatures crisp. The role `Literal` is **imported** from
`app.modules.auth.schema` — clients did the same, the pattern is now
established. `Decimal` (not `float`) for money and shares is a hard rule
(see R1).

**Alternatives considered**:

- *Combine `ModuleCreate` and `ModuleUpdate` into a single `Optional[]`-heavy
  schema*: rejected. POST and PATCH have different required fields; merging
  obscures which ones the client must send.
- *Inline the activation status as a separate `PATCH /projects/{id}/activate`
  endpoint*: rejected. The `status` field is already in `ProjectUpdate`;
  splitting it into a dedicated endpoint adds a route surface for what is
  one boolean transition. The `Literal["active"]` constraint already prevents
  `{status:"completed"}` and `{status:"pending"}` from being accepted on
  update.

---

## R5 — Repository layer: queries needed

**Decision**: `app/modules/projects/repository.py` exposes the following
helpers. None contains business logic; each is a single SQL statement.

**Project helpers**:

- `create_project(session, **fields) -> Project` — inserts; returns the row.
- `get_project_by_id(session, id) -> Project | None` —
  `SELECT * FROM project WHERE id = :id AND is_active = TRUE`.
- `list_projects(session) -> list[Project]` —
  `SELECT * FROM project WHERE is_active = TRUE ORDER BY id`. Used by admin/manager.
- `list_projects_for_developer(session, developer_id) -> list[Project]` —
  joins `project` against `project_module` (active rows only) on
  `assigned_developer_id = :developer_id`, returns the distinct active projects
  in stable id order. Used by `GET /projects` for developers (FR-008).
- `is_developer_assigned_to_project(session, developer_id, project_id) -> bool` —
  `SELECT 1 FROM project_module WHERE project_id = :p AND assigned_developer_id = :d AND is_active = TRUE LIMIT 1`.
  Used by `GET /projects/{id}` and `GET /projects/{id}/progress` for developers.
- `update_project(session, project, **fields) -> Project` — applies the diff,
  bumps `updated_at`. Same shape as `users.update_user`.
- `soft_delete_project(session, project) -> None` — sets `is_active = FALSE`,
  bumps `updated_at`.

**Module helpers**:

- `create_module(session, **fields) -> ProjectModule` — inserts; returns the row.
- `get_module_by_id(session, id) -> ProjectModule | None` —
  `SELECT * FROM project_module WHERE id = :id AND is_active = TRUE`.
- `list_modules_for_project(session, project_id) -> list[ProjectModule]` —
  `SELECT * FROM project_module WHERE project_id = :p AND is_active = TRUE ORDER BY id`.
  Used by the cap check, the activation gate, the auto-completion check,
  and the progress aggregator.
- `sum_active_module_shares(session, project_id) -> Decimal` —
  `SELECT COALESCE(SUM(share_percentage), 0) FROM project_module WHERE project_id = :p AND is_active = TRUE`.
  Used by the cap check and the activation gate. Returns `Decimal("0.00")`
  when no rows match.
- `update_module(session, module, **fields) -> ProjectModule` — applies the
  diff, bumps `updated_at`.
- `soft_delete_module(session, module) -> None` — sets `is_active = FALSE`,
  bumps `updated_at`.

**Cross-module reads** (kept in the projects repository for narrowness;
these wrap the existing entity-owner repos to satisfy the import-audit rule):

- The clients/users existence checks (FR-005, FR-009) are NOT mirrored here.
  The service calls `clients.repository.get_client_by_id` and
  `users.repository.get_user_by_id` directly — the audit script explicitly
  allows those two read-only helpers (see R7).

**Rationale**: The narrow surface keeps the service layer's logic readable.
The `sum_active_module_shares` helper is the single chokepoint for the
financial invariant — every cap check, activation gate, and (in test) every
assertion goes through one SQL statement.

**Alternatives considered**:

- *Expose `update_project_status(project_id, new_status)` as a repo helper*:
  rejected. Status transitions are state-machine logic — they belong in the
  service layer. The repo just persists what the service hands it.
- *Cache the share sum on the `project` row*: rejected. Denormalisation
  invalidated by every soft-delete; the SQL `SUM()` over ≤ tens of rows
  per project is a no-op.

---

## R6 — Service layer business rules

**Decision**: `app/modules/projects/service.py` exposes the following typed
exceptions and callables.

**Exceptions**:

```python
class ProjectNotFoundError(Exception): ...
class ModuleNotFoundError(Exception): ...
class ClientNotActiveError(Exception): ...                # FR-005
class DeveloperNotEligibleError(Exception): ...           # FR-009 (role/active)
class ShareCapExceededError(Exception):
    """Carries .current and .requested as Decimal."""
class ActivationGateError(Exception):
    """Carries .current_total as Decimal."""
class IllegalStatusTransitionError(Exception):
    """Carries .from_status, .to_status."""
class CompletedProjectFrozenError(Exception): ...         # FR-016
class ProgressNotPermittedError(Exception):
    """Raised when project is not 'active'. Carries .current_status."""
class DeveloperNotAssignedError(Exception): ...           # FR-019 (developer caller, foreign module)
class DateRangeError(Exception): ...                       # FR-006
```

**Project callables**:

- `create_project(session, *, payload: ProjectCreate, requester: User) -> ProjectRead`:
  - Look up `clients.repository.get_client_by_id(payload.client_id)`; `None` ⇒
    `ClientNotActiveError` (FR-005).
  - Insert via `repository.create_project(...)` with `status="pending"`,
    `company_share=Decimal("30.00")`, `developer_share=Decimal("70.00")`,
    `is_active=True`.
- `list_projects(session, *, requester: User) -> list[ProjectRead]`:
  - If `requester.role == "developer"`:
    `repository.list_projects_for_developer(session, requester.id)`.
  - Else: `repository.list_projects(session)`.
- `get_project(session, *, project_id: int, requester: User) -> ProjectRead`:
  - `repository.get_project_by_id`; `None` ⇒ `ProjectNotFoundError`.
  - If `requester.role == "developer"` AND
    NOT `repository.is_developer_assigned_to_project(...)` ⇒
    `ProjectNotFoundError` (developer-invisible == 404, FR-008).
- `update_project(session, *, project_id, patch: ProjectUpdate) -> ProjectRead`:
  - `get_project_by_id`; `None` ⇒ `ProjectNotFoundError`.
  - If `patch.status == "active"`:
    - Reject if current status != `"pending"` ⇒ `IllegalStatusTransitionError`.
    - Compute `total = repository.sum_active_module_shares(session, project_id)`.
    - If `total != Decimal("70.00")` ⇒ `ActivationGateError(current_total=total)`.
  - If both `patch.start_date` and `patch.end_date` provided ⇒ check
    `end_date >= start_date`; if only one provided ⇒ check against the stored
    counterpart. Raise `DateRangeError` on violation.
  - Apply via `repository.update_project(...)`.
- `delete_project(session, *, project_id) -> None`:
  - `get_project_by_id`; `None` ⇒ `ProjectNotFoundError`.
  - `repository.soft_delete_project(...)`.
- `get_project_progress(session, *, project_id, requester: User) -> ProjectProgressResponse`:
  - Same visibility check as `get_project`.
  - List active modules via `repository.list_modules_for_project`.
  - Average their `progress` (or `0.0` if empty), round to 1 decimal.

**Module callables**:

- `add_module(session, *, project_id, payload: ModuleCreate) -> ModuleRead`:
  - `get_project_by_id`; `None` ⇒ `ProjectNotFoundError`.
  - If project status == `"completed"` ⇒ `CompletedProjectFrozenError` (FR-016).
  - Validate developer: `users.repository.get_user_by_id(payload.assigned_developer_id)`;
    if missing OR role != `"developer"` OR not active ⇒
    `DeveloperNotEligibleError` (FR-009).
  - Compute `current = repository.sum_active_module_shares(session, project_id)`.
  - If `current + payload.share_percentage > Decimal("70.00")` ⇒
    `ShareCapExceededError(current, requested=payload.share_percentage)` (FR-010).
  - Insert via `repository.create_module(...)` with `progress=0`, `status="pending"`,
    `is_active=True`.
  - Bump the parent project's `updated_at` (FR-017).
  - Run `_maybe_autocomplete_project(...)` (no-op for fresh module since
    `progress = 0`).
- `update_module(session, *, module_id, patch: ModuleUpdate) -> ModuleRead`:
  - `get_module_by_id`; `None` ⇒ `ModuleNotFoundError`.
  - `get_project_by_id(module.project_id)`; if soft-deleted ⇒ `ModuleNotFoundError`
    (the parent gate).
  - If parent status == `"completed"` ⇒ `CompletedProjectFrozenError`.
  - If `patch.assigned_developer_id` provided ⇒ developer-eligibility check (FR-009).
  - If `patch.share_percentage` provided:
    - `current = repository.sum_active_module_shares(session, module.project_id)`.
    - `excluding_self = current - module.share_percentage`.
    - If `excluding_self + patch.share_percentage > Decimal("70.00")` ⇒
      `ShareCapExceededError(...)` (FR-010, FR-011).
  - Apply via `repository.update_module(...)`.
  - Bump parent project's `updated_at`.
  - Run `_maybe_autocomplete_project(...)`.
- `update_module_progress(session, *, module_id, progress: int, requester: User) -> ModuleRead`:
  - `get_module_by_id`; `None` ⇒ `ModuleNotFoundError`.
  - `get_project_by_id(module.project_id)`; if soft-deleted ⇒ `ModuleNotFoundError`.
  - If parent status != `"active"` ⇒
    `ProgressNotPermittedError(current_status=...)` (FR-021).
  - Developer ownership: if `requester.role == "developer"` AND
    `module.assigned_developer_id != requester.id` ⇒ `DeveloperNotAssignedError`
    (FR-019; mapped to 403). Admin/manager bypass this check.
  - Derive `status = {"pending" if progress == 0 else "in_progress" if progress < 100 else "completed"}` (FR-020).
  - Apply via `repository.update_module(module, progress=progress, status=...)`.
  - Bump parent project's `updated_at`.
  - Run `_maybe_autocomplete_project(...)`.
- `delete_module(session, *, module_id) -> None`:
  - `get_module_by_id`; `None` ⇒ `ModuleNotFoundError`.
  - `repository.soft_delete_module(...)`.
  - Bump parent project's `updated_at`.
  - Run `_maybe_autocomplete_project(...)` — necessary because deleting the
    last under-100 module can flip the project to `completed`.

**Auto-completion helper** (`_maybe_autocomplete_project`):

```python
def _maybe_autocomplete_project(session: Session, project: Project) -> None:
    if project.status != "active":
        return
    modules = repository.list_modules_for_project(session, project.id)
    if not modules:
        return  # FR-014: requires "at least one module exists"
    if all(m.progress == 100 for m in modules):
        repository.update_project(session, project, status="completed")
```

**Rationale**: Centralising the auto-completion check in one helper is the
minimum change needed to keep the four call sites (add_module, update_module,
update_module_progress, delete_module) honest. Service-layer state derivation
matches the project's existing convention (no DB triggers, no model events).

**Alternatives considered**:

- *Use a model-level `@event.listens_for(Session, "before_flush")`*: rejected.
  Splits invariants across two layers; harder to reason about under tests.
- *Use a single `mutate_module(session, *, op: Literal["create","update","progress","delete"], ...)`
  that fans out internally*: rejected. The four call sites have different
  validation paths (developer check, share cap, project-frozen gate, ownership
  gate) and merging them obscures all four. Four named methods are clearer.

---

## R7 — Audit script for FR-027 (projects module boundaries)

**Decision**: Add `backend/scripts/audit_projects_imports.sh`, mirroring
`audit_clients_imports.sh`. Allow:

- `app.modules.auth.dependencies` — `get_current_user`, `require_*` (RBAC).
- `app.modules.auth.schema` — role `Literal`.
- `app.modules.users.repository` — `get_user_by_id` (and optionally
  `list_developers`). Used for FR-009 enforcement.
- `app.modules.clients.repository` — `get_client_by_id`. Used for FR-005.

Reject:

- `app.modules.auth.{service,repository,routes}`.
- `app.modules.users.{service,routes,model,schema}`.
- `app.modules.clients.{service,routes,model,schema}`.
- `app.modules.payments.*` (entire module).

```bash
violations_disallowed=$(
  grep -RIn --include='*.py' -E '^\s*(from|import)\s+app\.modules\.(payments)' app/modules/projects \
    || true
)
violations_auth=$(
  grep -RIn --include='*.py' -E '^\s*(from|import)\s+app\.modules\.auth' app/modules/projects \
    | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
    || true
)
violations_users=$(
  grep -RIn --include='*.py' -E '^\s*(from|import)\s+app\.modules\.users' app/modules/projects \
    | grep -vE 'app\.modules\.users\.repository' \
    || true
)
violations_clients=$(
  grep -RIn --include='*.py' -E '^\s*(from|import)\s+app\.modules\.clients' app/modules/projects \
    | grep -vE 'app\.modules\.clients\.repository' \
    || true
)
```

Same exit-code contract as the existing audit scripts; printed status line
on success.

**Rationale**: FR-027 says "projects MUST NOT import any business logic from
auth.service, auth.repository, users.service, payments.\*". The script
encodes the four allowed read-only entry points and rejects everything else.
Importing `clients.repository.get_client_by_id` is the projects module's
**only** reach into clients (FR-005); the audit lets that exact import
through and rejects every other clients import (no `clients.service`,
no `clients.model`, no `clients.routes`, no `clients.schema`).

**Alternatives considered**:

- *Run all four audit scripts as a single CI step*: convenience-only;
  out of scope for this feature.
- *Express boundaries as `import-linter` rules*: same rejection as feature
  004 R7; the project's pattern is shell grep audits.

---

## R8 — Migration (`20260504_create_project_and_module_tables.py`)

**Decision**: One alembic revision creates both tables and their indexes.
The revision is dated 2026-05-04 (same calendar day as feature 004's
revision but a strictly later monotonic revision id):

```python
revision = "20260504_project"
down_revision = "20260504_client"   # feature 004's revision

def upgrade() -> None:
    op.create_table(
        "project",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("client_id", sa.Integer,
                  sa.ForeignKey("client.id", ondelete="RESTRICT"),
                  nullable=False, index=True),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("company_share", sa.Numeric(5, 2), nullable=False,
                  server_default=sa.text("30.00")),
        sa.Column("developer_share", sa.Numeric(5, 2), nullable=False,
                  server_default=sa.text("70.00")),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(16), nullable=False,
                  server_default=sa.text("'pending'")),
        sa.Column("is_active", sa.Boolean, nullable=False,
                  server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.current_timestamp()),
        sa.CheckConstraint(
            "status IN ('pending','active','completed')",
            name="ck_project_status",
        ),
    )
    op.create_table(
        "project_module",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer,
                  sa.ForeignKey("project.id", ondelete="RESTRICT"),
                  nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("assigned_developer_id", sa.Integer,
                  sa.ForeignKey("user.id", ondelete="RESTRICT"),
                  nullable=False, index=True),
        sa.Column("progress", sa.Integer, nullable=False,
                  server_default=sa.text("0")),
        sa.Column("status", sa.String(16), nullable=False,
                  server_default=sa.text("'pending'")),
        sa.Column("share_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False,
                  server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.current_timestamp()),
        sa.CheckConstraint(
            "status IN ('pending','in_progress','completed')",
            name="ck_project_module_status",
        ),
        sa.CheckConstraint(
            "progress BETWEEN 0 AND 100",
            name="ck_project_module_progress_range",
        ),
        sa.CheckConstraint(
            "share_percentage > 0 AND share_percentage <= 70",
            name="ck_project_module_share_range",
        ),
    )

def downgrade() -> None:
    op.drop_table("project_module")
    op.drop_table("project")
```

`ON DELETE RESTRICT` on every FK is the conservative default — soft-delete
is the public path; hard delete is structurally prevented. The CHECK
constraints on `status` enums and on `progress`/`share_percentage` ranges
are belt-and-braces alongside the schema-layer validators.

**Test parity (no alembic in tests)**: `SQLModel.metadata.create_all` does not
run alembic. The CHECK constraints expressed via `sa.CheckConstraint` in
the model's `__table_args__` will materialise into the test SQLite engine
the same way they materialise into Postgres — same code path.

**Alternatives considered**:

- *Two migrations (project, then project_module)*: rejected — same feature,
  same revision.
- *Drop the CHECK constraints; rely entirely on Pydantic*: rejected. The
  CHECK constraints are a backstop against direct DB writes (e.g. an admin
  fixing data with `psql`). Cheap to add, free at write time.

---

## R9 — Test fixture extensions

**Decision**: `backend/tests/conftest.py` already has every fixture this
feature needs (`seed_admin / seed_manager / seed_developer / make_token /
auth_header`). **The only required edit** is the model-import sweep at the
top of the file, adding `Project` and `ProjectModule` so
`SQLModel.metadata.create_all` picks them up:

```python
from app.modules.clients.model import Client            # already there
from app.modules.projects.model import Project, ProjectModule  # NEW
from app.modules.users.model import User                # already there
```

No new fixtures — the projects tests will create their seed data via API
calls (`POST /clients` → `POST /projects` → `POST /projects/{id}/modules`),
matching the pattern feature 004 established. The reasons:

- The create endpoints are themselves the units under test in US1, US3, US4.
  Threading the same payloads through both a fixture and the create test
  would duplicate the source of truth.
- For US5 (developer progress), US6 (aggregate), and US7 (delete), the
  multi-call seed in the test body is at most ~5 lines and makes the
  preconditions explicit.

**Rationale**: Smallest possible diff to `conftest.py` (one import line).
Keeps the test pattern uniform across features 002–005.

**Alternatives considered**:

- *Add `seed_project` and `seed_module` fixtures*: rejected. The 5-line
  seeds are explicit; fixtures would obscure which client / which developer
  each test is operating on.

---

## R10 — Decimal serialization on the wire

**Decision**: Return `total_amount` and `share_percentage` as JSON strings
(e.g. `"10000.00"`, `"30.00"`), not numbers. Pydantic's default for
`Decimal` is `str`. Accept either string or number on input (Pydantic v2
coerces).

**Rationale**: JavaScript's `Number` is IEEE-754 double — it cannot
represent `10000.00` distinguishably from `10000` and silently drops
precision around `0.01..0.0001`. Sending Decimals as strings is the
universal convention for money on the wire (Stripe, Plaid, Square — all
do this). The MVP frontend will need `Decimal.js` or string-based
arithmetic anyway for the share-percentage UI.

**Alternatives considered**:

- *Send as `number`*: rejected. Silent precision loss is the exact failure
  mode the dual-gate rule (R1) is built to prevent.
- *Send as scaled integer (cents, basis points)*: rejected. Premature; the
  Decimal-as-string convention is well-understood by every modern HTTP
  client and adds zero JS-side complexity.

---

## R11 — `progress` aggregation: simple average vs share-weighted

**Decision**: Simple arithmetic mean (FR-022). Each active module
contributes `progress / count` to the result regardless of its
`share_percentage`. Returned as `float` rounded to 1 decimal.

**Rationale**: The spec input is explicit: "Project progress = average of
module progress." Share-weighted would be a different feature with
different semantics: it would over-count a 50%-share module's progress
relative to a 5%-share module's. The user said "average", not "weighted",
and the activation gate already ensures shares add up to 70 — i.e. every
module is roughly equal-stake by construction (otherwise the operator
would have put all the work into one module).

**Alternatives considered**:

- *Share-weighted average*: rejected per spec. Would give a more
  "money-meaningful" progress number but at the cost of a number that no
  longer matches "what percentage of the work is done".
- *Sum of `progress * share_percentage / 100`*: same as share-weighted;
  rejected for the same reason.

A future feature can add a separate `GET /projects/{id}/payable_progress`
endpoint that returns the share-weighted variant if the payments module
needs it.

---

## Summary

All decisions are local extensions of the architecture established by
features 001–004. No new dependencies (Decimal is in the stdlib; FastAPI/
SQLModel/Pydantic/alembic already cover the rest). The one new tracked
decision per the user's `/sp.specify` choices is the dual-gate share rule
(R1); two more decisions are flagged in `plan.md` as ADR suggestions
(`projects-share-cap-and-activation-gate`, `projects-status-transitions`);
none are auto-created.

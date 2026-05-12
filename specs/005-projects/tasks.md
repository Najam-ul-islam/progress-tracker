# Tasks: Projects Management

**Feature**: `005-projects`
**Branch**: `005-projects`
**Input**: Design documents from `/specs/005-projects/`
**Prerequisites**: `plan.md` (✅), `spec.md` (✅), `research.md` (✅), `data-model.md` (✅),
`contracts/openapi.yaml` (✅), `contracts/access-control-matrix.md` (✅), `quickstart.md` (✅)

**Tests**: Spec acceptance scenarios + SC-001..SC-008 demand integration tests. Test tasks
are **included** below (TDD-friendly: each user story phase has its tests written before the
implementation tasks for that story).

**Organization**: Tasks are grouped by user story so each story can be implemented and shipped
independently. Within each story, the order is `tests → schema → repository → service →
routes → wiring`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on other in-flight tasks → safe to parallelise.
- **[Story]**: Maps task to user story. `US1` = `POST /projects`, `US2` = read/list/visibility,
  `US3` = `PATCH /projects/{id}` (update + activation), `US4` = module CRUD,
  `US5` = `PATCH /modules/{id}/progress` (developer + auto-completion),
  `US6` = `GET /projects/{id}/progress`, `US7` = soft-delete project/module.
  Setup / Foundational / Polish phases carry no story label.
- Every task includes a repo-relative file path.

## Path Conventions

This is a `backend/` + `frontend/` monorepo. **All tasks in this feature live under `backend/`.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm runtime + dev dependencies are wired through `uv` and that the six-file
scaffolding under `backend/app/modules/projects/` is intact. **No file is overwritten in this
phase.**

- [ ] T001 [P] Verify required runtime deps are already declared in `backend/pyproject.toml`
  (`fastapi`, `sqlmodel`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `alembic`,
  `python-jose[cryptography]`, `passlib[bcrypt]`, `psycopg2-binary`, `uvicorn[standard]`).
  All are present (features 002/003/004). **No new dependency is added by this feature**
  (Decimal is stdlib).
- [ ] T002 [P] Smoke-import the libraries this feature touches directly through uv to prove
  the env is healthy: `uv run --project backend python -c "from decimal import Decimal; from sqlmodel import SQLModel; from pydantic import BaseModel; import sqlalchemy"`.
- [ ] T003 [P] Confirm the six-file scaffolding already exists in
  `backend/app/modules/projects/` (`__init__.py`, `model.py`, `schema.py`, `repository.py`,
  `service.py`, `dependencies.py`, `routes.py`). They do — this task is the audit; do not
  pre-empt the empty files.
- [ ] T004 [P] Confirm the projects router is already mounted at prefix `/projects` in
  `backend/app/main.py` via `MODULE_REGISTRY`. The `/modules` paths are added by the same
  router using full-path operation decorators (see plan.md §"Routing note") — `MODULE_REGISTRY`
  is **not edited**. Verify only.

**Checkpoint**: Dependencies are present, env imports cleanly, scaffolding is whole, router is
mounted. No app code edited.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ship the cross-cutting substrate every user story consumes — the two SQLModels,
the alembic revision (two tables + indexes + CHECK constraints), all eight Pydantic schemas,
the repository helpers, and the eleven typed service exceptions.

⚠️ **CRITICAL**: This phase must merge before US1..US7 task work starts.

### Models + migration (FR-003, FR-004, FR-017)

- [ ] T005 Implement `Project` and `ProjectModule` SQLModels in
  `backend/app/modules/projects/model.py` per data-model.md §"Entity: Project" and §"Entity:
  ProjectModule". Both classes carry the `__table_args__` CHECK constraints documented in
  data-model.md so they hold under `SQLModel.metadata.create_all` (used by the test fixture)
  as well as alembic. Path: `backend/app/modules/projects/model.py`.
- [ ] T006 Create alembic revision `backend/alembic/versions/20260504_project.py` per
  data-model.md §"Migration outline". `revision = "20260504_project"`,
  `down_revision = "20260504_client"`. Upgrade creates `project` and `project_module` tables,
  the FKs (`ON DELETE RESTRICT`), the indexes (`ix_project_client_id`,
  `ix_project_is_active`, `ix_project_module_project_id`,
  `ix_project_module_assigned_developer_id`, `ix_project_module_is_active`), and the CHECK
  constraints (`ck_project_total_amount_positive`, `ck_project_date_range`,
  `ck_project_status`, `ck_project_module_progress_range`,
  `ck_project_module_share_range`, `ck_project_module_status`). Downgrade reverses in
  reverse order. Path: `backend/alembic/versions/20260504_project.py`.

### Schemas (FR-006, FR-012, FR-018, FR-020)

- [ ] T007 [P] Implement the eight Pydantic v2 schemas in
  `backend/app/modules/projects/schema.py` per data-model.md §"Schemas":
  `ProjectStatus`, `ModuleStatus` (Literals); `ProjectCreate` (with `_date_range` model
  validator); `ProjectUpdate` (with `_at_least_one_field` validator and
  `status: Literal["active"] | None` only — no `pending`, no `completed`); `ProjectRead`;
  `ModuleCreate`; `ModuleUpdate` (with `_at_least_one_field` validator); `ModuleProgressUpdate`
  (closed schema with only `progress`); `ModuleRead`; `ModuleProgressSummary`;
  `ProjectProgressResponse`; type aliases `ProjectListResponse`, `ModuleListResponse`. All
  schemas use `ConfigDict(extra="forbid")` (FR-018). Path:
  `backend/app/modules/projects/schema.py`.

### Repository helpers (R5)

- [ ] T008 Implement `backend/app/modules/projects/repository.py`. Narrow DB-only helpers,
  each one SQL statement (no business logic):
  - `create_project(session, **fields) -> Project`
  - `get_project_by_id(session, id) -> Project | None` — filters `is_active = TRUE`.
  - `list_projects(session) -> list[Project]` — admin/manager view; filters
    `is_active = TRUE`; `order_by(Project.id)`.
  - `list_projects_for_user(session, user_id) -> list[Project]` — developer view; joins
    `project_module` and filters `assigned_developer_id = :user_id AND project_module.is_active
    = TRUE AND project.is_active = TRUE`; distinct.
  - `get_project_for_user(session, project_id, user_id) -> Project | None` — same join, used
    by the developer-visibility filter on `GET /projects/{id}`.
  - `update_project(session, project, **fields) -> Project` — sets fields, bumps
    `updated_at`, commits.
  - `soft_delete_project(session, project) -> None` — sets `is_active = False`, bumps
    `updated_at`, commits.
  - `create_module(session, **fields) -> ProjectModule`.
  - `get_module_by_id(session, id) -> ProjectModule | None` — filters `is_active = TRUE`.
  - `list_active_modules(session, project_id) -> list[ProjectModule]` — filters by
    project, `is_active = TRUE`; `order_by(id)`.
  - `update_module(session, module, **fields) -> ProjectModule` — sets fields, bumps
    `updated_at` on both module AND its parent project (FR-017).
  - `soft_delete_module(session, module) -> None` — sets `is_active = False`, bumps
    `updated_at` on both module and parent project.
  - `sum_active_module_shares(session, project_id, *, exclude_module_id=None) -> Decimal` —
    `SELECT COALESCE(SUM(share_percentage), 0)` filtered by project, `is_active = TRUE`,
    optionally excluding one module id (FR-011). Returns `Decimal`.
  - `count_assignments(session, user_id) -> int` — for FR-009-related upstream visibility
    (used optionally by US2 list).
  Path: `backend/app/modules/projects/repository.py`.

### Service exception types (R6, contracts/access-control-matrix.md §"Service-layer exception → HTTP mapping")

- [ ] T009 [P] Declare the typed service exceptions at the top of
  `backend/app/modules/projects/service.py`:
  ```python
  class ProjectNotFoundError(Exception): pass
  class ModuleNotFoundError(Exception): pass
  class ClientNotActiveError(Exception): ...
  class DeveloperNotEligibleError(Exception): ...
  class ShareCapExceededError(Exception):
      def __init__(self, *, current: Decimal, requested: Decimal) -> None: ...
  class ActivationGateError(Exception):
      def __init__(self, *, current: Decimal) -> None: ...
  class IllegalStatusTransitionError(Exception): pass
  class CompletedProjectFrozenError(Exception): pass
  class ProgressNotPermittedError(Exception): pass
  class DeveloperNotAssignedError(Exception): pass
  class DateRangeError(Exception): pass
  ```
  Each carries the canonical detail string from the access-control matrix's exception map.
  Path: `backend/app/modules/projects/service.py`.

### Dependencies stub (no edit) + conftest import (FR-027 / test bootstrap)

- [ ] T010 [P] Confirm `backend/app/modules/projects/dependencies.py` stays as the empty
  docstring stub. **Do not create new dependencies here.**
- [ ] T011 [P] Add a single import line to `backend/tests/conftest.py` so
  `SQLModel.metadata.create_all` picks up the new tables under the test fixture:
  `from app.modules.projects.model import Project, ProjectModule  # noqa: F401`.
  No fixture changes required for the foundational phase; per-story fixtures
  (`seed_client`, `seed_project_pending`, `seed_project_active_with_modules`) are added in
  the relevant test files using factory-style closures. Path: `backend/tests/conftest.py`.

**Checkpoint**: tables migratable, schemas import, repository helpers callable, service
exceptions declared. **User stories may now begin in parallel on test files; implementation
tasks within `service.py` and `routes.py` serialise.**

---

## Phase 3: User Story 1 — Admin/manager creates a project (Priority: P1) 🎯 MVP

**Goal** (spec.md US1): admin or manager `POST /projects` → 201; developer → 403; bad
client_id / bad date range / unknown field / negative total_amount → 422; status is always
`pending` on create.

**Independent Test**: seed users + 1 active client. Admin POST → 201 with
`status:"pending"`, `company_share:"30.00"`, `developer_share:"70.00"`. Manager POST → 201.
Developer POST → 403. POST with non-existent `client_id` → 422 with FR-005 detail.

### Tests for US1 (write FIRST, must FAIL before implementation)

- [ ] T012 [P] [US1] Contract test for `POST /projects` covering all US1 acceptance scenarios
  in `backend/tests/test_projects_create.py`: 201 + correct shape for admin and manager;
  403 for developer; 401 missing token; 422 missing required field; 422 unknown field
  (FR-018); 422 client_id non-existent; 422 client_id soft-deleted; 422
  `end_date < start_date` (FR-006); 422 `total_amount <= 0`; 422 client-supplied
  `company_share`/`developer_share`/`status`/`id`. Path:
  `backend/tests/test_projects_create.py`.

### Implementation for US1

- [ ] T013 [US1] Implement `create_project(session, *, payload: ProjectCreate, requester) ->
  ProjectRead` in `backend/app/modules/projects/service.py`:
  - Read client via `clients.repository.get_client_by_id`; missing or `is_active=False` →
    raise `ClientNotActiveError("client_id does not reference an active client")`.
  - Build kwargs: payload fields + server-set `company_share=Decimal("30.00")`,
    `developer_share=Decimal("70.00")`, `status="pending"`, `is_active=True`.
  - Call `repository.create_project(...)`.
  - Return `ProjectRead.model_validate(project)`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T014 [US1] Implement `POST /projects` route in
  `backend/app/modules/projects/routes.py`. `Depends(require_any("admin","manager"))`,
  calls service. Maps `ClientNotActiveError` → 422 + detail. Status 201. Path:
  `backend/app/modules/projects/routes.py`.

**Checkpoint**: `pytest tests/test_projects_create.py` is green.

---

## Phase 4: User Story 2 — list/read with developer-visibility filter (Priority: P1)

**Goal** (spec.md US2): admin/manager see every active project; developer sees only projects
with at least one assigned active module (FR-008); per-id 404 for non-existent / not-visible.

**Independent Test**: seed admin + manager + 2 developers; seed 2 projects (P1 with a Dev1
module, P2 untouched). Admin/manager `GET /projects` → both. Dev1 → [P1]. Dev2 → []. Dev2
`GET /projects/{P1_id}` → 404. Dev1 `GET /projects/{P1_id}` → 200.

### Tests for US2 (write FIRST, must FAIL before implementation)

- [ ] T015 [P] [US2] Contract test for `GET /projects` and `GET /projects/{id}` in
  `backend/tests/test_projects_read.py` covering: admin/manager see all; developer sees only
  assigned; developer 404 on unassigned id; admin/manager 404 on missing/soft-deleted id;
  401 token missing. Path: `backend/tests/test_projects_read.py`.

### Implementation for US2

- [ ] T016 [US2] Implement `list_projects(session, *, requester) -> list[ProjectRead]` and
  `get_project(session, *, project_id: int, requester) -> ProjectRead` in
  `backend/app/modules/projects/service.py`:
  - `list_projects`: if `requester.role == "developer"` → call
    `repository.list_projects_for_user`; else `repository.list_projects`.
  - `get_project`: if `requester.role == "developer"` → call `get_project_for_user`; else
    `get_project_by_id`. `None` → raise `ProjectNotFoundError`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T017 [US2] Implement `GET /projects` and `GET /projects/{id}` routes in
  `backend/app/modules/projects/routes.py`. Both use `Depends(get_current_user)` (per-row
  visibility lives in the service). `ProjectNotFoundError` → 404. Path:
  `backend/app/modules/projects/routes.py`.

**Checkpoint**: `pytest tests/test_projects_read.py` is green.

---

## Phase 5: User Story 3 — update + activation gate (Priority: P1)

**Goal** (spec.md US3): admin/manager `PATCH /projects/{id}` to rename, change dates, change
total_amount, OR transition `pending → active`. Activation gate (FR-013): sum of active
modules' shares must equal exactly 70.00. Backwards transitions (FR-015) and
`status="completed"` from clients (FR-014) → 422.

**Independent Test**: seed admin + project + 3 modules summing to 70%. Admin PATCH
`{name:"X"}` → 200. Manager PATCH → 200. Developer PATCH → 403. Empty body → 422. Bad date
range → 422. PATCH `{status:"active"}` → 200. PATCH `{status:"active"}` on under-allocated
project → 422 with current-sum detail. PATCH `{status:"pending"}` or `{"completed"}` on
active project → 422.

### Tests for US3 (write FIRST, must FAIL before implementation)

- [ ] T018 [P] [US3] Contract test for `PATCH /projects/{id}` in
  `backend/tests/test_projects_update.py` covering all US3 acceptance scenarios: rename;
  manager-allowed; developer-403; empty body 422; non-existent id 404; bad date range 422;
  total_amount<0 422; client-supplied `company_share`/`developer_share` 422; activation at
  exactly 70 → 200; activation at 60 → 422 with detail mentioning `60.00`; activation at
  70.5 → 422 (DB CHECK / Pydantic catches before this); backwards transitions 422;
  `status="completed"` from client 422; unknown field 422. Path:
  `backend/tests/test_projects_update.py`.

### Implementation for US3

- [ ] T019 [US3] Implement `update_project(session, *, project_id, patch, requester) ->
  ProjectRead` in `backend/app/modules/projects/service.py`:
  - Lookup project via `repository.get_project_by_id`; miss → `ProjectNotFoundError`.
  - If `patch.status` is set:
    - If `project.status != "pending"` → raise `IllegalStatusTransitionError`.
    - Sum active module shares; if `sum != Decimal("70.00")` → raise
      `ActivationGateError(current=sum)`.
    - Set `status="active"` in the field bundle.
  - If `patch.start_date` or `patch.end_date` provided, compute the merged pair and verify
    `end_date >= start_date`; otherwise raise `DateRangeError`.
  - Call `repository.update_project` with the merged fields (excluding unset).
  - Return `ProjectRead.model_validate(project)`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T020 [US3] Implement `PATCH /projects/{id}` route. `Depends(require_any("admin",
  "manager"))`. Maps `ProjectNotFoundError`→404, and
  `ActivationGateError | IllegalStatusTransitionError | DateRangeError`→422 (each carries
  the canonical detail). Path: `backend/app/modules/projects/routes.py`.

**Checkpoint**: `pytest tests/test_projects_update.py` is green.

---

## Phase 6: User Story 4 — module CRUD with share-cap (Priority: P1)

**Goal** (spec.md US4): admin/manager `POST /projects/{id}/modules` and `PATCH /modules/{id}`;
admin `DELETE /modules/{id}`. Cap check on every write (FR-010). Cap check on PATCH excludes
the module's own current share (FR-011). Wrong-role assignee → 422 (FR-009).
Module mutation on completed project → 422 (FR-016). DELETE frees share (FR-023) and
triggers auto-completion check.

**Independent Test**: seed admin + manager + project + 2 developers. POST module
`share_percentage:30` → 201. POST another `share_percentage:30` → 201 (cumulative 60).
POST another `share_percentage:11` → 422 with `current:60.00, requested:11.00`. POST module
with admin user as `assigned_developer_id` → 422 with FR-009 detail. PATCH module to
`share_percentage:30` (same value) → 200 (no self-collision; FR-011). DELETE first module
(admin) → 204; sum drops to 30; new POST `share_percentage:40` → 201.

### Tests for US4 (write FIRST, must FAIL before implementation)

- [ ] T021 [P] [US4] Contract test for module CRUD in `backend/tests/test_modules_crud.py`:
  POST happy path (admin, manager); developer → 403; cap-equal 70 → 201; cap-exceed → 422
  with detail; wrong-role assignee → 422; soft-deleted developer → 422; non-existent project
  id → 404; module-create on completed project → 422; PATCH happy path; PATCH no-op share →
  200; PATCH wrong-role assignee → 422; PATCH developer → 403; DELETE admin → 204; DELETE
  manager → 403; DELETE frees share for re-use; DELETE on completed project → 422 (mutation
  blocked). Path: `backend/tests/test_modules_crud.py`.

### Implementation for US4

- [ ] T022 [US4] Implement `create_module(session, *, project_id, payload, requester) ->
  ModuleRead` in service.py:
  - Lookup project via `get_project_by_id`; miss → `ProjectNotFoundError`.
  - If `project.status == "completed"` → `CompletedProjectFrozenError("cannot mutate modules
    on a completed project")`.
  - Lookup developer via `users.repository.get_user_by_id`; if missing OR `role !=
    "developer"` OR `is_active=False` → `DeveloperNotEligibleError("assigned_developer_id
    must reference an active user with role=developer")`.
  - Compute `current = repository.sum_active_module_shares(project_id)`. If
    `current + payload.share_percentage > Decimal("70.00")` → `ShareCapExceededError(current,
    payload.share_percentage)`.
  - Build kwargs: payload fields + `progress=0`, `status="pending"`, `is_active=True`.
  - Call `repository.create_module`.
  - **No auto-completion check needed at create time** (a fresh module is always at 0).
  - Return `ModuleRead.model_validate(module)`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T023 [US4] Implement `update_module(session, *, module_id, patch, requester) ->
  ModuleRead` in service.py:
  - Lookup module; miss → `ModuleNotFoundError`. Lookup parent project.
  - If `project.status == "completed"` → `CompletedProjectFrozenError`.
  - If `patch.assigned_developer_id` set → developer-eligibility check (FR-009).
  - If `patch.share_percentage` set → compute
    `current = sum_active_module_shares(project_id, exclude_module_id=module_id)` (FR-011),
    raise `ShareCapExceededError` if `current + patch.share_percentage > 70`.
  - `repository.update_module(...)` (bumps both updated_ats per FR-017).
  - Call `_maybe_autocomplete_project(project)` (in case the rename / reassign / share
    change unlocked the all-100 state — defensive; share PATCH doesn't change progress, but
    the helper is a noop in that case so keep the invocation uniform across all module
    write paths).
  - Return `ModuleRead.model_validate(module)`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T024 [US4] Implement `delete_module(session, *, module_id) -> None` in service.py:
  - Lookup module; miss → `ModuleNotFoundError`. Lookup parent project.
  - If `project.status == "completed"` → `CompletedProjectFrozenError` (FR-016 — completed
    is mutation-frozen, including delete).
  - Call `repository.soft_delete_module`.
  - Call `_maybe_autocomplete_project(project)` (FR-014: deleting an in-flight module can
    leave the remaining active set all-at-100 → flip to completed).
  Path: `backend/app/modules/projects/service.py`.
- [ ] T025 [US4] Implement the helper
  `_maybe_autocomplete_project(session, project) -> None` in service.py (private,
  underscore-prefixed; called from T023, T024, and T029):
  - Read active modules; if there are any AND every one has `progress == 100` AND
    `project.status == "active"`, call
    `repository.update_project(project, status="completed")`.
  - Otherwise no-op.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T026 [US4] Implement `POST /projects/{id}/modules`, `PATCH /modules/{id}`, and
  `DELETE /modules/{id}` routes in `backend/app/modules/projects/routes.py`:
  - POST: `Depends(require_any("admin","manager"))`, status 201.
  - PATCH: `Depends(require_any("admin","manager"))`.
  - DELETE: `Depends(require_admin)`, status 204.
  - Map exceptions per access-control-matrix.md table.
  Path: `backend/app/modules/projects/routes.py`.

**Checkpoint**: `pytest tests/test_modules_crud.py` is green.

---

## Phase 7: User Story 5 — developer progress + auto-completion (Priority: P1)

**Goal** (spec.md US5): admin/manager/assigned-developer `PATCH /modules/{id}/progress`. Status
derivation (FR-020). Active-only mutation (FR-021). Developer ownership (FR-019).
Auto-completion (FR-014).

**Independent Test**: seed admin + project + 3 dev1 modules + 1 dev2 module summing to 70%.
Activate. Dev2 PATCH dev1's module → 403. Dev1 PATCH own module to 50 → 200, status
in_progress. Dev1 PATCH all three to 100 → 200. Dev2 PATCH last to 100 → 200; project flips
to completed. Subsequent PATCH on any module → 422 (project completed; FR-021).

### Tests for US5 (write FIRST, must FAIL before implementation)

- [ ] T027 [P] [US5] Contract test for `PATCH /modules/{id}/progress` in
  `backend/tests/test_modules_progress.py`: developer self → 200; developer non-self → 403;
  admin/manager any → 200; non-existent id → 404; progress 101 / -1 → 422 (Pydantic);
  unknown field / empty body → 422; pending project → 422 with FR-021 detail; completed
  project → 422; 100/100/50 → 100/100/100 chain → project flips to completed; status
  derivation matrix (0=pending, 1..99=in_progress, 100=completed). Path:
  `backend/tests/test_modules_progress.py`.

### Implementation for US5

- [ ] T028 [US5] Implement `_derive_module_status(progress: int) -> ModuleStatus` helper in
  service.py: `0 → "pending"`, `1..99 → "in_progress"`, `100 → "completed"`. Path:
  `backend/app/modules/projects/service.py`.
- [ ] T029 [US5] Implement `update_module_progress(session, *, module_id, patch, requester)
  -> ModuleRead` in service.py:
  - Lookup module; miss → `ModuleNotFoundError`. Lookup parent project.
  - If `project.status != "active"` → `ProgressNotPermittedError("cannot update progress on
    a non-active project")`.
  - If `requester.role == "developer"` AND `requester.id != module.assigned_developer_id`
    → `DeveloperNotAssignedError`.
  - Compute new status via `_derive_module_status(patch.progress)`.
  - Call `repository.update_module(module, progress=patch.progress, status=<derived>)`.
  - Call `_maybe_autocomplete_project(project)` (FR-014 — main hot path).
  - Return `ModuleRead.model_validate(module)`.
  Path: `backend/app/modules/projects/service.py`.
- [ ] T030 [US5] Implement `PATCH /modules/{id}/progress` route. `Depends(get_current_user)`
  (the ownership check lives in the service). Map
  `ModuleNotFoundError`→404, `DeveloperNotAssignedError`→403,
  `ProgressNotPermittedError`→422. Path: `backend/app/modules/projects/routes.py`.

**Checkpoint**: `pytest tests/test_modules_progress.py` is green.

---

## Phase 8: User Story 6 — aggregate progress (Priority: P2)

**Goal** (spec.md US6): `GET /projects/{id}/progress` returns simple arithmetic mean of
active modules' `progress` values, or 0.0 if no active modules. Visibility from FR-008
applies. Soft-deleted modules excluded (FR-023).

### Tests for US6 (write FIRST, must FAIL before implementation)

- [ ] T031 [P] [US6] Contract test for `GET /projects/{id}/progress` in
  `backend/tests/test_projects_progress.py` (US6 portion): two modules at 50 and 100 →
  progress=75.0 + module summaries; no modules → 0.0; soft-deleted module excluded;
  developer assigned → 200; developer unassigned → 404; missing id → 404; 401 token missing.
  Path: `backend/tests/test_projects_progress.py`.

### Implementation for US6

- [ ] T032 [US6] Implement `compute_progress(session, *, project_id, requester) ->
  ProjectProgressResponse` in service.py:
  - Lookup project respecting visibility (`get_project_by_id` for admin/manager,
    `get_project_for_user` for developer); miss → `ProjectNotFoundError`.
  - Read `modules = repository.list_active_modules(project_id)`.
  - If empty → `progress = 0.0` and `modules = []`.
  - Else → `progress = round(sum(m.progress for m in modules) / len(modules), 1)` (simple
    arithmetic mean; FR-022 is presentational).
  - Build module summaries (id, name, progress, share_percentage).
  Path: `backend/app/modules/projects/service.py`.
- [ ] T033 [US6] Implement `GET /projects/{id}/progress` route.
  `Depends(get_current_user)`. Map `ProjectNotFoundError`→404. Path:
  `backend/app/modules/projects/routes.py`.

**Checkpoint**: US6 portion of `tests/test_projects_progress.py` is green.

---

## Phase 9: User Story 7 — soft-delete project (Priority: P2)

**Goal** (spec.md US7): admin `DELETE /projects/{id}` → 204 + `is_active=False`; reads
return 404. Manager/developer 403. (Module-soft-delete is in US4.)

### Tests for US7 (write FIRST, must FAIL before implementation)

- [ ] T034 [P] [US7] Add soft-delete tests to `backend/tests/test_projects_progress.py` (or
  split into `test_projects_delete.py` — same file is acceptable since the cross-cutting
  test file is small). Cover: admin DELETE → 204; manager DELETE → 403; developer DELETE
  → 403; subsequent `GET /projects/{id}` → 404; subsequent `GET /projects` excludes; missing
  id 404; idempotent re-delete 404; 401 token missing.

### Implementation for US7

- [ ] T035 [US7] Implement `delete_project(session, *, project_id) -> None` in service.py:
  lookup project via `get_project_by_id`; miss → `ProjectNotFoundError`. Call
  `repository.soft_delete_project`. Path: `backend/app/modules/projects/service.py`.
- [ ] T036 [US7] Implement `DELETE /projects/{id}` route. `Depends(require_admin)`. Map
  `ProjectNotFoundError`→404. Status 204. Path: `backend/app/modules/projects/routes.py`.

**Checkpoint**: full `pytest tests/test_projects_progress.py` is green.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Hardening + audit gates + the cross-cutting state-machine sweep.

- [ ] T037 [P] Add `backend/scripts/audit_projects_imports.sh` per research.md R7. Mirror
  of `audit_clients_imports.sh`: greps `backend/app/modules/projects/**.py` and **fails** on
  any `from app.modules.{auth.service,auth.repository,users.service,payments}` or any
  import from a future module. Allow-list (FR-027): `app.modules.auth.dependencies`,
  `app.modules.auth.schema`, `app.modules.users.repository`,
  `app.modules.clients.repository`. Same exit-code contract; printed status line `OK:
  projects module imports only allow-listed modules` on success. Path:
  `backend/scripts/audit_projects_imports.sh`.
- [ ] T038 [P] Add minimal projects-event logging in service.py: log "project created" with
  id; "project updated" with id + changed-keys; "project activated" with id + sum;
  "project auto-completed" with id; "project soft-deleted" with id; "module created"
  / "module updated" / "module deleted" with ids; "share-cap guard fired" with current +
  requested; "activation-gate guard fired" with current; "progress updated" with module
  id + new value + derived status. Use the project's existing logger.
- [ ] T039 [P] Walk `quickstart.md` Steps 1–7 manually against a non-prod `DATABASE_URL`.
  *(May be deferred analogously to features 002–004; the pytest suite covers the in-process
  equivalent end-to-end.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — no upstream deps.
- **Foundational (Phase 2)** — depends on Setup. **Blocks every user story.**
- **US1..US7 (Phases 3..9)** — all depend on Foundational. They share `service.py` and
  `routes.py`, so the **implementation tasks within those files serialise**.
- **Polish (Phase 10)** — T037 depends only on Foundational; T038 depends on every service
  write path being in place; T039 depends on the entire feature shipping.

### User Story Dependencies

- **US1** depends on Phase 2.
- **US2** depends on Phase 2.
- **US3** depends on Phase 2 + at least one module-create path in test fixtures (the
  activation-gate test seeds modules); the test file may use the repository directly to
  seed modules without depending on US4 routes, OR US3 tests can depend on US4 implementation.
  Recommended: US3 tests use the API once US4 routes ship (i.e., merge order is US4 before
  US3 finishes activation-gate tests). Alternative: US3 tests seed modules via repository
  helpers in fixtures, decoupling US3 from US4 routes.
- **US4** depends on Phase 2 (project create from US1 must already work for the test to seed
  a parent project — so US4 effectively depends on US1).
- **US5** depends on US4 (modules must exist).
- **US6** depends on US4 (modules to aggregate).
- **US7** depends on US1 (project to delete) and at minimum on US4 if the share-re-use
  check is asserted.

### Within Each User Story

- Tests first (write, run, see them fail).
- Service before route.
- All routes go in one file (`routes.py`) → routes serialise across US1–US7.
- All service surfaces go in one file (`service.py`) → services serialise across US1–US7.

### Parallel Opportunities

- **Phase 1**: T001–T004 are all `[P]`.
- **Phase 2**: T007 (schema), T009 (service exceptions), T010 (deps stub audit), T011
  (conftest) are on different files and can run in parallel after T005/T006/T008. T005 →
  T008 sequential (model declared before repository helpers reference fields).
- **Phases 3..9**: each story's test file is `[P]`. **Implementation tasks within a story
  serialise on `service.py` and `routes.py`.** Across stories, test files can be drafted in
  parallel; merge order on `service.py` and `routes.py` is US1 → US2 → US3 → US4 → US5 →
  US6 → US7.
- **Phase 10**: T037, T038, T039 are all `[P]` (different files / external).

### Same-file serialisation summary

| File                                              | Tasks (serial within)                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `backend/app/modules/projects/service.py`         | T009 → T013 → T016 → T019 → T022 → T023 → T024 → T025 → T028 → T029 → T032 → T035 → T038    |
| `backend/app/modules/projects/routes.py`          | T014 → T017 → T020 → T026 → T030 → T033 → T036                                              |
| `backend/app/modules/projects/repository.py`      | T008                                                                                        |
| `backend/app/modules/projects/model.py`           | T005                                                                                        |
| `backend/app/modules/projects/schema.py`          | T007                                                                                        |
| `backend/app/modules/projects/dependencies.py`    | T010 (audit only — file unchanged)                                                          |
| `backend/alembic/versions/20260504_project.py`    | T006                                                                                        |
| `backend/scripts/audit_projects_imports.sh`       | T037                                                                                        |
| `backend/tests/conftest.py`                       | T011                                                                                        |

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 + US5 — all P1)

1. Phase 1: Setup (T001..T004).
2. Phase 2: Foundational (T005..T011) — **non-negotiable substrate**.
3. Phase 3: US1 (T012..T014).
4. Phase 4: US2 (T015..T017).
5. Phase 5+6 interleaved (US3 needs US4 to exist for activation-gate seeding):
   - US4 implementation (T021..T026) — modules CRUD becomes functional.
   - US3 implementation (T018..T020) — activation gate uses the now-functional module
     create.
6. Phase 7: US5 (T027..T030) — full progress + auto-completion lifecycle.
7. **STOP and VALIDATE**: `uv run pytest backend/tests/`; manually walk
   `quickstart.md` Steps 1–5. The system has MVP project-management value at this point.

### Incremental Delivery

1. Setup + Foundational → migration applied; substrate ready.
2. + US1 → admins/managers can create projects.
3. + US2 → read surface with developer-visibility filter.
4. + US4 → modules exist and obey the cap.
5. + US3 → activation gate flows.
6. + US5 → developers can report progress; auto-completion fires.
7. + US6 → aggregate progress endpoint.
8. + US7 → admin soft-delete on project.
9. + Polish → audit script becomes CI-enforced; logging in place.

---

## Notes

- **uv only** — no `pip`, no manual `venv`.
- **No file is overwritten in Setup** — Phase 1 is pure audit. The first file *edited* by
  this feature is `projects/model.py` in T005; the first file *created* is the alembic
  revision in T006.
- **`backend/app/main.py` is NOT edited.** `MODULE_REGISTRY` already includes
  `("projects", "/projects")`; `/modules/{id}*` paths are mounted by the same router using
  full-path operation decorators — they are not separate registry entries.
- **`backend/app/modules/projects/dependencies.py` stays as the empty docstring stub.**
- The `Project` and `ProjectModule` SQLModels **live only in `projects/model.py`**
  (FR-001 / FR-028). The new `audit_projects_imports.sh` (T037) backs the reverse direction.
- All write paths set `updated_at` explicitly via the repository (FR-017). Module writes
  bump BOTH the module's `updated_at` and the parent project's `updated_at`.
- **Decimal arithmetic everywhere** for shares and money — no `float`. Pydantic `Decimal`
  fields, SQLAlchemy `Numeric`, comparison via Decimal (`>`, `<=`, `==`). The progress
  aggregator (FR-022) is the one exception: it returns `float`, deliberately, because it is
  a presentational figure (R10).
- **Auto-completion is invoked from four service paths**: T023 (PATCH module), T024
  (DELETE module), T025 (the helper itself), T029 (PATCH progress). Test ownership across
  these is in `test_modules_crud.py` and `test_modules_progress.py`.
- The 401→403→404→422→2xx response ordering (per
  `contracts/access-control-matrix.md` §"Ordering") is enforced by the order of guards in
  `routes.py` and `service.py`.
- Commit cadence: commit after each user-story phase ships green tests. Use one PR per
  phase for review focus, or one PR for the full feature.

---

**Total tasks**: 39 (T001..T039).

**Next step**: run `/sp.implement projects` to execute these tasks in dependency order, or
pick any independent `[P]` task to begin immediately.

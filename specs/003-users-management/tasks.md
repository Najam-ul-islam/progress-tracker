# Tasks: Users Management

**Feature**: `003-users-management`
**Branch**: `003-users-management`
**Input**: Design documents from `/specs/003-users-management/`
**Prerequisites**: `plan.md` (✅), `spec.md` (✅), `research.md` (✅), `data-model.md` (✅),
`contracts/openapi.yaml` (✅), `contracts/access-control-matrix.md` (✅), `quickstart.md` (✅)

**Tests**: Spec acceptance scenarios + SC-001..SC-007 demand integration tests. Test tasks are
**included** below (TDD-friendly: each user story phase has its tests written before the
implementation tasks for that story).

**Organization**: Tasks are grouped by user story so each story can be implemented and shipped
independently. Within each story, the order is `tests → schema → repository → service →
dependencies → routes → wiring`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on other in-flight tasks → safe to parallelise.
- **[Story]**: Maps task to user story. `US1` = `/users/me`, `US2` = read/list,
  `US3` = `PATCH /users/{id}`, `US4` = `PATCH /users/{id}/status`, `US5` = `/users/developers`.
  Setup / Foundational / Polish phases carry no story label.
- Every task includes an absolute or repo-relative file path.

## Path Conventions

This is a `backend/` + `frontend/` monorepo. **All tasks in this feature live under `backend/`.**
Repo-relative paths are written explicitly; from the repo root they are
`backend/app/...`, `backend/tests/...`, `backend/alembic/...`, `backend/scripts/...`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the runtime + dev dependencies are wired through `uv` and that the
six-file scaffolding under `backend/app/modules/users/` is intact. **No file is overwritten
in this phase.**

- [X] T001 [P] Verify required runtime deps are already declared in `backend/pyproject.toml`
  (`fastapi`, `sqlmodel`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `alembic`,
  `python-jose[cryptography]`, `passlib[bcrypt]`, `psycopg2-binary`, `uvicorn[standard]`).
  All are present (feature 002). Audit only — no edit unless a package is missing, in which
  case run `uv add <pkg>` from `backend/`.
- [X] T002 [P] Smoke-import the two libraries this feature touches directly through uv to
  prove the env is healthy: `uv run --project backend python -c "import fastapi; from sqlmodel import SQLModel"`.
  Failure → fix the env before any further task. **Non-destructive — no files touched.**
- [X] T003 [P] Confirm the six-file scaffolding already exists in `backend/app/modules/users/`
  (`__init__.py`, `model.py`, `schema.py`, `repository.py`, `service.py`, `dependencies.py`,
  `routes.py`). They do — this task is the audit; do not overwrite the populated ones
  (`model.py`, `repository.py`) and do not pre-empt the empty ones.
- [X] T004 [P] Confirm the users router is already mounted at prefix `/users` in
  `backend/app/main.py` via the existing module registry. Verify only — do not edit.

**Checkpoint**: Dependencies are present, env imports cleanly, scaffolding is whole, router is
mounted. No app code edited.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ship the cross-cutting substrate every user story (US1..US5) consumes — the two
new `User` columns, the alembic revision, the four Pydantic schemas, the four new repository
helpers, and the test fixtures. **No user-story endpoint work begins until this phase is
complete.**

⚠️ **CRITICAL**: This phase must be merged before US1..US5 task work starts. It contains the
non-negotiable substrate (model columns, migration, schemas, repository helpers, fixtures).

### Model + migration (FR-002, FR-010)

- [X] T005 Extend `User` SQLModel in `backend/app/modules/users/model.py` per data-model.md:
  add `is_active: bool = Field(default=True, nullable=False)` and `updated_at: datetime =
  Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)`. **Do NOT modify
  any existing field, do NOT change `__table_args__`.** ADR-0003 still holds — `User` lives
  only here. Path: `backend/app/modules/users/model.py`.
- [X] T006 Create alembic revision
  `backend/alembic/versions/20260503_add_is_active_and_updated_at_to_user.py`
  per data-model.md "Migration outline": `op.add_column("user", sa.Column("is_active",
  sa.Boolean(), nullable=False, server_default=sa.true()))` and `op.add_column("user",
  sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
  server_default=sa.func.current_timestamp()))`. `down_revision = "20260502_user"`. Downgrade
  drops `updated_at` then `is_active`. Path:
  `backend/alembic/versions/20260503_add_is_active_and_updated_at_to_user.py`.

### Schemas (FR-011, FR-012, FR-017, FR-018)

- [X] T007 [P] Implement the four Pydantic v2 schemas in
  `backend/app/modules/users/schema.py` per data-model.md §"Schemas":
  - `UserRead` — `model_config = ConfigDict(from_attributes=True, extra="forbid")`; fields
    `id, name, email, role (Literal), is_active, created_at, updated_at`. **No
    `password_hash`** (FR-017, SC-006).
  - `UserUpdate` — `extra="forbid"`; `name | None`, `role | None` (Literal), `is_active |
    None`. `@model_validator(mode="after")` rejects all-None patches with a 422-ready
    `ValueError` (FR-011).
  - `UserStatusUpdate` — `extra="forbid"`; `is_active: bool` required.
  - `UserListResponse = list[UserRead]` (type alias).
  Path: `backend/app/modules/users/schema.py`.

### Repository extensions (FR-001, R4)

- [X] T008 Extend `backend/app/modules/users/repository.py` with four new helpers per
  research.md R4. **Do NOT touch the existing `get_user_by_email`, `get_user_by_id`,
  `create_user`** (feature 002 contract). Add:
  - `list_users(session) -> list[User]` — `select(User).order_by(User.id)`.
  - `list_developers(session) -> list[User]` — `select(User).where(User.role ==
    "developer", User.is_active == True).order_by(User.id)`.
  - `update_user(session, user, **fields) -> User` — sets each `**fields` attribute on
    `user`, sets `user.updated_at = datetime.now(timezone.utc)` (FR-010), then `session.add
    + commit + refresh + return`. Caller is responsible for having looked up the user.
  - `count_active_admins(session, *, exclude_id: int | None = None) -> int` — `select(
    func.count()).select_from(User).where(User.role == "admin", User.is_active == True)`,
    optionally `where(User.id != exclude_id)`.
  Path: `backend/app/modules/users/repository.py`.

### Service exception types (R5, contracts/access-control-matrix.md)

- [X] T009 [P] Declare the typed service exceptions at the top of
  `backend/app/modules/users/service.py` (file is currently empty / stub): `class
  UserNotFoundError(Exception)`, `class ForbiddenError(Exception)`, `class
  LastAdminError(Exception)` (carries the specific message — last-admin-demote vs
  last-admin-deactivate), `class SelfDeactivationError(Exception)`. These map to HTTP via
  `routes.py` (T020/T021/T022/T024/T025). Path: `backend/app/modules/users/service.py`.

### Test fixtures (R6)

- [X] T010 [P] Extend `backend/tests/conftest.py` with three thin role wrappers and one token
  helper, **without modifying** the existing `seed_user` factory (feature 002 contract):
  - `seed_admin(session)` → `seed_user(session, role="admin", email="admin@test.local")`.
  - `seed_manager(session)` → `seed_user(session, role="manager", email="manager@test.local")`.
  - `seed_developer(session)` → `seed_user(session, role="developer", email="dev@test.local")`.
  - `make_token(user) -> str` — calls `app.core.security.create_access_token(user_id=user.id,
    email=user.email, role=user.role)`. Saves boilerplate across the five new test files.
  Path: `backend/tests/conftest.py`.

**Checkpoint**: `User` carries the two new columns; alembic head is `20260503_user_is_active_updated_at`;
`uv run --project backend pytest tests/` (the existing 17 cases) is still green; the schemas
import; `count_active_admins` and friends are callable; new fixtures exist. **User stories may
now begin in parallel.**

---

## Phase 3: User Story 1 — Read my own profile (Priority: P1) 🎯 MVP

**Goal** (from spec.md US1): Any authenticated user (admin, manager, or developer) calls
`GET /users/me` with a valid bearer token and receives their own profile record.

**Independent Test**: With only US1 implemented, an integration test seeds one user (any
role), calls `GET /users/me` with a token minted for that user, and asserts HTTP 200 +
response equals the seeded user **with no `password_hash`**.

### Tests for User Story 1 (write FIRST, must FAIL before implementation)

- [X] T011 [P] [US1] Contract test for `GET /users/me` covering all four US1 acceptance
  scenarios in `backend/tests/test_users_me.py`: 200 + correct shape for admin / manager /
  developer; 401 with the canonical `auth.dependencies.get_current_user` body when the
  `Authorization` header is missing; the FR-021 case (token refers to a deleted user → 401).
  Each 200-body assertion includes `"password_hash" not in response.json()` (FR-017,
  SC-006). Path: `backend/tests/test_users_me.py`.

### Implementation for User Story 1

- [X] T012 [US1] Implement `get_user_profile(session, *, target_id, requester) -> UserRead`
  in `backend/app/modules/users/service.py`. For US1 the route passes `target_id =
  requester.id`; the function looks up via `users.repository.get_user_by_id`, raises
  `UserNotFoundError` on miss, and returns `UserRead.model_validate(user)`. **Will be reused
  by US2**: when `requester.role == "developer"` and `target_id != requester.id`, raise
  `ForbiddenError` *before* the lookup (research.md R5: avoids id-probing leak). Path:
  `backend/app/modules/users/service.py`.
- [X] T013 [US1] Implement `GET /users/me` in `backend/app/modules/users/routes.py`:
  `requester: User = Depends(get_current_user)`, return `UserRead.model_validate(requester)`.
  No service call needed — the dependency *is* the data source for `/me`. **No DB access in
  this route.** Path: `backend/app/modules/users/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_users_me.py` is green. US1 is
end-to-end functional and demoable on its own (open Swagger, log in via
`/auth/login`, click Authorize, call `GET /users/me`).

---

## Phase 4: User Story 2 — Admin/managers list and read other users (Priority: P1)

**Goal** (from spec.md US2): An admin or manager calls `GET /users` or `GET /users/{id}` and
receives the requested user record(s). Developers may read only themselves through `/users/{id}`;
they receive 403 on `/users` and on any other `id`.

**Independent Test**: Seed three users (admin, manager, developer). Login as admin → `GET
/users` returns three; `GET /users/{any_id}` returns the row. Login as manager → identical.
Login as developer → `GET /users` is 403; `GET /users/{own_id}` is 200; `GET /users/{any_other}`
is 403; non-existent id is 403 for developer (not 404, FR-019 + access-control-matrix
ordering rule), 404 for admin/manager.

### Tests for User Story 2 (write FIRST, must FAIL before implementation)

- [X] T014 [P] [US2] Contract test for `GET /users` and `GET /users/{id}` in
  `backend/tests/test_users_read.py` covering every cell of the access-control-matrix row for
  both endpoints: list (admin 200 / manager 200 / developer 403); by-id (admin 200 self +
  other / manager 200 self + other / admin 404 missing / manager 404 missing / developer 200
  self / developer 403 other / developer 403 missing — id-probing protection). Each 200-body
  assertion sweeps `"password_hash" not in body` (SC-006). Path:
  `backend/tests/test_users_read.py`.

### Implementation for User Story 2

- [X] T015 [US2] Implement `list_users(session) -> list[UserRead]` in
  `backend/app/modules/users/service.py`: calls `users.repository.list_users` and maps to
  `UserRead`. Defence-in-depth role check is unnecessary here — the route uses
  `Depends(require_any("admin", "manager"))`. Path:
  `backend/app/modules/users/service.py`.
- [X] T016 [US2] Extend `get_user_profile` (T012) so the developer-self-only rule is enforced
  *before* the repository lookup (research.md R5 correction): if `requester.role ==
  "developer" and target_id != requester.id`, raise `ForbiddenError`. Admin/manager fall
  through to lookup → `UserNotFoundError` on miss. **Same file as T012 — must run after
  T012.** Path: `backend/app/modules/users/service.py`.
- [X] T017 [US2] Implement `GET /users` and `GET /users/{id}` in
  `backend/app/modules/users/routes.py` per `contracts/access-control-matrix.md` §"Route-to-
  dependency wiring":
  - `GET /users` — `Depends(require_any("admin","manager"))`, calls `service.list_users`,
    returns `list[UserRead]`.
  - `GET /users/{id}` — `Depends(get_current_user)` (no role gate at the route — service
    enforces dev-self-only). Catches `UserNotFoundError` → 404, `ForbiddenError` → 403.
  **No DB access in this route, no role checks beyond `Depends`.** Path:
  `backend/app/modules/users/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_users_read.py` is green. Admins
and managers have their read surface; developers are correctly walled off.

---

## Phase 5: User Story 3 — Admin updates a user's profile and role (Priority: P1)

**Goal** (from spec.md US3): An admin calls `PATCH /users/{id}` with one or more of
`{name, role, is_active}`. Validation, persistence, `updated_at` bump, return the updated
record.

**Independent Test**: Seed admin + developer. Admin PATCH `{name:"X"}` → 200 +
`updated_at` advanced. Admin PATCH `{role:"superuser"}` → 422. Admin PATCH `{}` → 422.
Admin PATCH `{email:"x@y"}` → 422 (extra-fields-forbidden). Admin PATCH non-existent id
→ 404. Manager PATCH any → 403. Developer PATCH any → 403.

### Tests for User Story 3 (write FIRST, must FAIL before implementation)

- [X] T018 [P] [US3] Contract test for `PATCH /users/{id}` in
  `backend/tests/test_users_update.py` covering all seven US3 acceptance scenarios: 200 on
  name change with `updated_at > created_at`; 200 on role change; 422 on invalid role enum;
  403 for manager; 403 for developer (even on self); 422 on empty body; 404 on missing id;
  422 on `{email: …}` (FR-012). Each 200-body asserts no `password_hash` (SC-006). Path:
  `backend/tests/test_users_update.py`.

### Implementation for User Story 3

- [X] T019 [US3] Implement `update_user_profile(session, *, target_id, patch: UserUpdate,
  requester) -> UserRead` in `backend/app/modules/users/service.py` per research.md R5:
  - Lookup `user_to_update = repository.get_user_by_id(session, target_id)`; raise
    `UserNotFoundError` on miss.
  - If `patch.role == "admin"` is *not* the case AND `user_to_update.role == "admin"`
    AND `(patch.role and patch.role != "admin")` (i.e. demoting an admin) → call
    `repository.count_active_admins(session, exclude_id=target_id)`; if `0` → raise
    `LastAdminError("cannot demote the last remaining admin")`.
  - If `patch.is_active is False` AND `user_to_update.role == "admin"` AND
    `user_to_update.is_active is True` → same count-and-check; raise `LastAdminError(
    "cannot deactivate the last remaining admin")` if the count would drop to zero.
  - Apply via `repository.update_user(session, user_to_update, **patch.model_dump(
    exclude_none=True))`. Return `UserRead.model_validate(user)`.
  Empty-patch / invalid-role rejection happens at the Pydantic layer (T007); this service
  function never sees them. **Same file as T012/T016 — must run after both.** Path:
  `backend/app/modules/users/service.py`.
- [X] T020 [US3] Implement `PATCH /users/{id}` in `backend/app/modules/users/routes.py`:
  `Depends(require_admin)`, call `service.update_user_profile`. Map `UserNotFoundError` →
  404, `LastAdminError` → 409 with the exception's message in `{"detail": str(exc)}`.
  Pydantic-422 is automatic. **No DB access in this route.** **Same file as T013/T017 —
  must run after T017.** Path: `backend/app/modules/users/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_users_update.py` is green.
Admins can mutate any user's profile / role; the last-admin guard fires correctly.

---

## Phase 6: User Story 4 — Admin activates/deactivates a user (Priority: P2)

**Goal** (from spec.md US4): Admin calls `PATCH /users/{id}/status` with `{is_active:
bool}`. Flip the flag, bump `updated_at`. FR-013 (deactivated → 401 on login) closes the
loop.

**Independent Test**: Seed admin + developer. Admin deactivates dev → 200, dev
`/auth/login` → 401 (byte-identical to wrong-password). Admin reactivates → 200, dev login
→ 200. Admin tries to deactivate self when last active admin → 409. Manager / developer
PATCH → 403.

### Tests for User Story 4 (write FIRST, must FAIL before implementation)

- [X] T021 [P] [US4] Contract test for `PATCH /users/{id}/status` in
  `backend/tests/test_users_status.py` covering all four US4 acceptance scenarios + the
  cross-cutting FR-013 login bridge: 200 deactivate; **`POST /auth/login` for the
  deactivated user returns 401 with body byte-identical to wrong-password (SC-005)**;
  reactivate → 200 → login → 200; manager 403; developer 403; self-deactivate-as-last-admin
  → 409. Each 200-body asserts no `password_hash` (SC-006). Path:
  `backend/tests/test_users_status.py`.

### Implementation for User Story 4

- [X] T022 [US4] Implement `change_user_status(session, *, target_id, patch:
  UserStatusUpdate, requester) -> UserRead` in `backend/app/modules/users/service.py` per
  research.md R5:
  - Lookup; raise `UserNotFoundError` on miss.
  - If `requester.id == target_id and patch.is_active is False` → raise
    `SelfDeactivationError("cannot deactivate yourself")` (FR-014 second leg).
  - If `patch.is_active is False and user.role == "admin" and user.is_active is True` →
    `count_active_admins(session, exclude_id=target_id)`; if `0` → raise `LastAdminError(
    "cannot deactivate the last remaining admin")`.
  - Apply via `repository.update_user(session, user, is_active=patch.is_active)`. Return
    `UserRead.model_validate(user)`. **Same file as T019 — must run after T019.** Path:
  `backend/app/modules/users/service.py`.
- [X] T023 [US4] Add the FR-013 bridge to `backend/app/modules/auth/service.py`. Inside
  `authenticate_user`, **after** the `verify_password` check succeeds, add:
  `if not user.is_active: raise InvalidCredentialsError`. One line. **Do NOT change the
  exception type, do NOT change the message** — preserves SC-005 byte-identical 401
  envelope. Path: `backend/app/modules/auth/service.py`.
- [X] T024 [US4] Implement `PATCH /users/{id}/status` in
  `backend/app/modules/users/routes.py`: `Depends(require_admin)`, call
  `service.change_user_status`. Map `UserNotFoundError` → 404, `LastAdminError` and
  `SelfDeactivationError` → 409. **Same file as T013/T017/T020 — must run after T020.**
  Path: `backend/app/modules/users/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_users_status.py` is green.
Deactivation works, reactivation works, last-admin guard works, FR-013 login bridge holds.

---

## Phase 7: User Story 5 — List developers for project assignment (Priority: P2)

**Goal** (from spec.md US5): Admin or manager calls `GET /users/developers` and receives
every user with `role=="developer" AND is_active==true`.

**Independent Test**: Seed one admin, one manager, two active developers, one inactive
developer. Admin/manager → 200 with two users. Developer → 403. No developers seeded → 200
with empty list (not 404).

### Tests for User Story 5 (write FIRST, must FAIL before implementation)

- [X] T025 [P] [US5] Contract test for `GET /users/developers` in
  `backend/tests/test_users_developers.py` covering all three US5 acceptance scenarios: 200
  with exactly the two active developers (filter excludes admin, manager, inactive
  developer); 403 for developer caller; 200 + empty array when no developers exist. Each
  200-body asserts no `password_hash` (SC-006). Path:
  `backend/tests/test_users_developers.py`.

### Implementation for User Story 5

- [X] T026 [US5] Implement `list_developers(session) -> list[UserRead]` in
  `backend/app/modules/users/service.py`: calls `users.repository.list_developers` (already
  filters by role + active) and maps to `UserRead`. **Same file as T019/T022 — must run
  after T022.** Path: `backend/app/modules/users/service.py`.
- [X] T027 [US5] Implement `GET /users/developers` in
  `backend/app/modules/users/routes.py`: `Depends(require_any("admin","manager"))`, calls
  `service.list_developers`, returns `list[UserRead]`. **Same file as T013/T017/T020/T024 —
  must run after T024.** Path: `backend/app/modules/users/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_users_developers.py` is green.
The full users module is feature-complete. All five stories ship.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening + audit gates. None of these block US1..US5 functionally; all of them
back the spec's measurable success criteria.

- [X] T028 [P] Add cross-cutting last-admin-guard test
  `backend/tests/test_users_last_admin_guard.py` (FR-014, SC-005 of this feature). Three
  scenarios: (a) seed exactly one admin + one developer; admin tries `PATCH /users/{admin_id}`
  with `{role:"manager"}` → 409 + row unchanged; (b) same setup; admin tries `PATCH
  /users/{admin_id}/status` with `{is_active:false}` → 409 + row unchanged; (c) seed two
  admins; the second demote/deactivate succeeds because count would still be ≥ 1. Path:
  `backend/tests/test_users_last_admin_guard.py`.
- [X] T029 [P] Add a sweep test `backend/tests/test_users_no_password_hash_leak.py` (SC-006
  of this feature) that walks every 2xx response from every users endpoint (`/users/me`,
  `/users`, `/users/{id}`, `/users/developers`, `PATCH /users/{id}`, `PATCH
  /users/{id}/status`) and asserts the substring `"password_hash"` does not appear in any
  response body. Path: `backend/tests/test_users_no_password_hash_leak.py`.
- [X] T030 [P] Add `backend/scripts/audit_users_imports.sh` per research.md R7. Mirror of
  `audit_auth_imports.sh`: greps `backend/app/modules/users/**.py` for `from app.modules.auth`
  and **allows only** `from app.modules.auth.dependencies` (infrastructure). Any import from
  `app.modules.auth.service`, `.repository`, or `.schema` (business logic) fails the script
  with exit 1. Same exit-code contract as the two existing audit scripts. Path:
  `backend/scripts/audit_users_imports.sh`.
- [X] T031 [P] Add minimal users-event logging in `backend/app/modules/users/service.py`:
  log "user updated" with id+changed-keys on success, "user deactivated" / "user reactivated"
  on status flip, "last-admin guard fired" with target id on `LastAdminError`. **Never log
  `password_hash`** — that field is never seen by this layer anyway. Use the project's
  existing logger; no new logging library. Path: `backend/app/modules/users/service.py`.
- [X] T032 Walk `quickstart.md` Steps 1–7 manually (`uv run --project backend uvicorn
  app.main:app --reload` against a non-prod `DATABASE_URL`; seed three users via
  `/auth/register`; walk every user story via curl as documented; run all three audit
  scripts; sanity-check `/docs`). Assert SC-001 (median `/users/me` < 200 ms), SC-006 (no
  `password_hash` anywhere). **Verification gate; no file is created or edited by this task.**
  *(May be deferred analogously to feature 002's T015/T035 if `backend/.env` still points at
  shared infra. The pytest suite covers the in-process equivalent end-to-end.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — no upstream deps; can begin immediately.
- **Foundational (Phase 2)** — depends on Setup. **Blocks every user story.**
- **US1..US5 (Phases 3..7)** — all depend on Foundational. They share `service.py` and
  `routes.py`, so the **implementation tasks within those files serialise** even though
  their test files are `[P]`.
- **Polish (Phase 8)** — T028 depends on US3+US4 (last-admin paths in both); T029 depends on
  every story (sweeps every 2xx); T030 depends only on Foundational; T031 can land any time
  after T019 / T022; T032 depends on the entire feature shipping.

### User Story Dependencies

- **US1 (`/users/me`)** — depends only on Phase 2 (model+schemas+fixtures).
- **US2 (read/list)** — depends on Phase 2 + reuses `get_user_profile` from US1 (T016
  extends T012).
- **US3 (`PATCH /users/{id}`)** — depends on Phase 2 + adds new service surface; reuses
  the repository helpers from T008 and the schemas from T007.
- **US4 (`PATCH /users/{id}/status`)** — depends on Phase 2 + reuses the
  `count_active_admins` repo helper from T008. T023 (FR-013 bridge in `auth/service.py`)
  is independent of users-module ordering and can land any time after Phase 2.
- **US5 (`/users/developers`)** — depends on Phase 2 only; orthogonal to US3/US4
  semantically but serialises on the shared `service.py` / `routes.py` files.

### Within Each User Story

- Tests first (write, run, see them fail).
- Service before route.
- All routes go in one file (`routes.py`) → routes serialise across US1–US5.
- All service surfaces go in one file (`service.py`) → services serialise across US1–US5.

### Parallel Opportunities

- **Phase 1**: T001..T004 are all `[P]` — audit tasks on different files.
- **Phase 2**: T007 (schema), T009 (service exceptions stub), T010 (conftest extensions) are
  on different files and can run in parallel after T005/T006/T008. T005 → T008 sequential
  (model must declare new columns before repository helpers reference them). T006 (alembic)
  is independent of T005 in code but logically pairs with it; safe to run in parallel.
- **Phase 3..7**: each story's test file (T011, T014, T018, T021, T025) is `[P]` — different
  test files; **the implementation tasks within a story serialise on `service.py` and
  `routes.py`**. Across stories, the test files can be drafted in parallel by separate
  developers; merge order on `service.py` and `routes.py` is US1 → US2 → US3 → US4 → US5.
- **Phase 8**: T028, T029, T030, T031 are `[P]` — three test files, one shell script, one
  service-edit (logging). T032 is the manual gate.

### Same-file serialisation summary

| File                                            | Tasks (serial within)              |
| ----------------------------------------------- | ---------------------------------- |
| `backend/app/modules/users/service.py`          | T009 → T012 → T015 → T016 → T019 → T022 → T026 → T031 |
| `backend/app/modules/users/routes.py`           | T013 → T017 → T020 → T024 → T027 |
| `backend/app/modules/users/repository.py`       | T008                                |
| `backend/app/modules/users/model.py`            | T005                                |
| `backend/app/modules/users/schema.py`           | T007                                |
| `backend/app/modules/auth/service.py`           | T023                                |
| `backend/tests/conftest.py`                     | T010                                |

---

## Parallel Example: User Story 1

```bash
# Independent file → safe to launch in parallel:
Task: "Contract test for GET /users/me in backend/tests/test_users_me.py"               # T011

# Then sequential (shared service.py / routes.py with later stories):
Task: "get_user_profile in backend/app/modules/users/service.py"                        # T012  (after Phase 2)
Task: "GET /users/me route in backend/app/modules/users/routes.py"                      # T013  (after T012)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Phase 1: Setup (T001..T004).
2. Phase 2: Foundational (T005..T010) — **non-negotiable substrate**.
3. Phase 3: US1 `/users/me` (T011..T013) — first demoable slice.
4. Phase 4: US2 read/list (T014..T017) — admin/manager surface.
5. Phase 5: US3 `PATCH /users/{id}` (T018..T020) — full role-mutation power.
6. **STOP and VALIDATE**: run `uv run --project backend pytest backend/tests/`; manually walk
   the US1–US3 portions of `quickstart.md` (Steps 1–5 except US4/US5). The system has
   MVP-level user-management value at this point — the admin can fully operate user state
   for downstream features.

### Incremental Delivery

1. Setup + Foundational → migration applied, schemas + fixtures ready.
2. + US1 → every authenticated user has identity (`/users/me`).
3. + US2 → admins/managers have a read surface.
4. + US3 → admins can mutate role / name / is_active in one endpoint.
5. + US4 → dedicated activate/deactivate endpoint + the FR-013 login bridge.
6. + US5 → developer roster (used by future projects/tasks modules).
7. + Polish → SC-005/SC-006 + FR-014/FR-020 audits become CI-enforced.

### Parallel Team Strategy

After Phase 2 merges and US1 (T012/T013) lands:

- Developer A: US2 (T014..T017) — owns next turn on `service.py` and `routes.py`.
- Developer B: US3 (T018..T020) — picks up after A on the shared files.
- Developer C: US4 (T021..T024) — picks up after B; T023 (auth bridge) is independent and
  can land in parallel.
- Developer D: US5 (T025..T027) — picks up last on the shared files.
- Developer E: Phase 8 polish (T028..T031) — entirely in `[P]` files, can run alongside
  US3/US4/US5.

---

## Notes

- **uv only** — no `pip`, no manual `venv`. Every Python invocation goes through `uv run
  --project backend …` from repo root, or `uv run …` from inside `backend/`.
- **No file is overwritten in Setup** — Phase 1 is pure audit. The first file *edited* by
  this feature is `users/model.py` in T005; the first file *created* is the alembic revision
  in T006.
- The `User` SQLModel **lives only in `users/`** (ADR-0003 / FR-001 / SC-007). T005 extends
  it in place; no other module redefines or shadows it. The new `audit_users_imports.sh`
  (T030) backs the reverse direction (users may import only `auth.dependencies`).
- All write paths set `updated_at` explicitly via the repository (FR-010) — the DB-level
  default exists only to backfill existing rows during the migration (research.md R1 / data-
  model.md). No DB trigger maintains this column.
- All response bodies exclude `password_hash` (FR-017, SC-006). The `UserRead` schema simply
  does not declare the field; T029 sweeps every 2xx body to enforce.
- Last-admin guard (FR-014) fires inside the service layer with a transactional count
  (research.md R4). Both `update_user_profile` (T019) and `change_user_status` (T022) call
  `count_active_admins(exclude_id=target_id)`.
- FR-013 is one line in `auth.service.authenticate_user` (T023). Same `InvalidCredentialsError`
  the wrong-password path raises → byte-identical 401 envelope (SC-005 from feature 002 still
  holds).
- The 401→403→404→422→409→200 response ordering (per `contracts/access-control-matrix.md`
  §"Ordering") is enforced by the order of guards/lookups in routes.py and service.py;
  individual tests assert the correct status for each case.
- Commit cadence: commit after each user-story phase ships green tests, not after every
  individual task. Use one PR per phase for review focus, or one PR for the full feature.
- Do not skip test tasks — the spec's success criteria (SC-001..SC-007) are testable claims;
  every one is mapped to a test file above.

---

**Total tasks**: 32 (T001..T032).

**Next step**: run `/sp.implement users` to execute these tasks in dependency order, or pick
any independent `[P]` task to begin immediately.

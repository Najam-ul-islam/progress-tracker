# Tasks: Clients Management

**Feature**: `004-clients-management`
**Branch**: `004-clients-management` (currently authored on `003-users-management`)
**Input**: Design documents from `/specs/004-clients-management/`
**Prerequisites**: `plan.md` (âœ…), `spec.md` (âœ…), `research.md` (âœ…), `data-model.md` (âœ…),
`contracts/openapi.yaml` (âœ…), `contracts/access-control-matrix.md` (âœ…), `quickstart.md` (âœ…)

**Tests**: Spec acceptance scenarios + SC-001..SC-007 demand integration tests. Test tasks are
**included** below (TDD-friendly: each user story phase has its tests written before the
implementation tasks for that story).

**Organization**: Tasks are grouped by user story so each story can be implemented and shipped
independently. Within each story, the order is `tests â†’ schema â†’ repository â†’ service â†’
routes â†’ wiring`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on other in-flight tasks â†’ safe to parallelise.
- **[Story]**: Maps task to user story. `US1` = `POST /clients` (create), `US2` = read/list,
  `US3` = `PATCH /clients/{id}` (update), `US4` = `DELETE /clients/{id}` (soft-delete).
  Setup / Foundational / Polish phases carry no story label.
- Every task includes an absolute or repo-relative file path.

## Path Conventions

This is a `backend/` + `frontend/` monorepo. **All tasks in this feature live under `backend/`.**
Repo-relative paths are written explicitly; from the repo root they are
`backend/app/...`, `backend/tests/...`, `backend/alembic/...`, `backend/scripts/...`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the runtime + dev dependencies are wired through `uv` and that the
six-file scaffolding under `backend/app/modules/clients/` is intact. **No file is overwritten
in this phase.**

- [X] T001 [P] Verify required runtime deps are already declared in `backend/pyproject.toml`
  (`fastapi`, `sqlmodel`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `alembic`,
  `python-jose[cryptography]`, `passlib[bcrypt]`, `psycopg2-binary`, `uvicorn[standard]`,
  `email-validator` transitively). All are present (features 002/003). Audit only â€” no edit
  unless a package is missing, in which case run `uv add <pkg>` from `backend/`. **No new
  dependency is added by this feature** (R2: phone regex is pure-Python).
- [X] T002 [P] Smoke-import the libraries this feature touches directly through uv to prove
  the env is healthy: `uv run --project backend python -c "import fastapi; from sqlmodel import SQLModel; from pydantic import EmailStr"`.
  Failure â†’ fix the env before any further task. **Non-destructive â€” no files touched.**
- [X] T003 [P] Confirm the six-file scaffolding already exists in `backend/app/modules/clients/`
  (`__init__.py`, `model.py`, `schema.py`, `repository.py`, `service.py`, `dependencies.py`,
  `routes.py`). They do â€” this task is the audit; do not overwrite the populated `routes.py`
  router-only stub and do not pre-empt the empty ones.
- [X] T004 [P] Confirm the clients router is already mounted at prefix `/clients` in
  `backend/app/main.py:18-28` via the existing `MODULE_REGISTRY`. Verify only â€” **do not edit
  `main.py`**. The brief's Phase 7 ("Register routes in main.py") is a no-op for this feature
  (same pattern as features 002/003).

**Checkpoint**: Dependencies are present, env imports cleanly, scaffolding is whole, router is
mounted. No app code edited.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ship the cross-cutting substrate every user story (US1..US4) consumes â€” the
`Client` SQLModel, the alembic revision (table + two partial unique indexes), the four
Pydantic schemas, the seven repository helpers, and the typed service exceptions. **No
user-story endpoint work begins until this phase is complete.**

âš ï¸ **CRITICAL**: This phase must merge before US1..US4 task work starts. It contains the
non-negotiable substrate (model, migration, schemas, repository helpers, exceptions).

### Model + migration (FR-002, FR-013)

- [X] T005 Implement `Client` SQLModel in `backend/app/modules/clients/model.py` per
  data-model.md Â§"Entity: `Client`". Ten columns: `id` (PK), `name` (str, 1..120),
  `email` (str, 320), `phone` (str, 40), `company_name` (str | None, 200), `address`
  (str | None, 500), `notes` (str | None, Text), `is_active` (bool, default True),
  `created_at` (datetime, tz=True, default `datetime.now(timezone.utc)`),
  `updated_at` (datetime, tz=True, default `datetime.now(timezone.utc)`). ADR-0003 still
  holds â€” `Client` lives only here. Path: `backend/app/modules/clients/model.py`.
- [X] T006 Create alembic revision
  `backend/alembic/versions/20260504_create_client_table.py` per data-model.md Â§"Migration
  outline". `revision = "20260504_client"`, `down_revision = "20260503_user_is_active_updated_at"`.
  Upgrade creates the `client` table (10 columns, all the right types and NOT NULLs) plus
  two partial unique indexes (`ix_client_email_active`, `ix_client_phone_active`) using the
  dialect-prefixed `postgresql_where=sa.text("is_active = TRUE")` and
  `sqlite_where=sa.text("is_active = 1")` kwargs (R1, R8). Downgrade drops the two indexes
  then the table. Path: `backend/alembic/versions/20260504_create_client_table.py`.

### Schemas (FR-007, FR-008, FR-011, FR-015)

- [X] T007 [P] Implement the four Pydantic v2 schemas in
  `backend/app/modules/clients/schema.py` per data-model.md Â§"Schemas":
  - `_PHONE_RE = re.compile(r"^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$")` at module top.
  - `ClientCreate` â€” `extra="forbid"`; `name (1..120)`, `email: EmailStr`, `phone (8..40)`,
    `company_name | None (â‰¤200)`, `address | None (â‰¤500)`, `notes | None`. `field_validator`
    on `email` lowercases + strips; `field_validator` on `phone` enforces `_PHONE_RE`.
  - `ClientUpdate` â€” `extra="forbid"`; every field optional; `email`/`phone` validators
    skip when `None`; `model_validator(mode="after")` rejects all-None patches with a
    422-ready `ValueError` (FR-011).
  - `ClientRead` â€” `model_config = ConfigDict(from_attributes=True, extra="forbid")`;
    fields `id, name, email, phone, company_name, address, notes, is_active, created_at,
    updated_at`.
  - `ClientListResponse = list[ClientRead]` (type alias).
  Path: `backend/app/modules/clients/schema.py`.

### Repository helpers (FR-009, FR-010, FR-013, FR-014, R4)

- [X] T008 Implement `backend/app/modules/clients/repository.py` per research.md R4. Seven
  narrow helpers, no business logic, each one SQL statement:
  - `create_client(session, **fields) -> Client` â€” inserts; on `IntegrityError` whose
    constraint name matches `ix_client_email_active` or `ix_client_phone_active`, rolls
    back the session and re-raises as `DuplicateClientError(field="email"|"phone")`
    (imported from `clients.service` to avoid circular â€” define exception in `service.py`,
    import here at function scope, or define a `clients.errors` module if cleaner).
  - `get_client_by_id(session, id) -> Client | None` â€” `select(Client).where(Client.id ==
    id, Client.is_active == True).limit(1)`. Soft-deleted rows are not returned (FR-014).
  - `list_clients(session) -> list[Client]` â€” `select(Client).where(Client.is_active ==
    True).order_by(Client.id)`.
  - `find_active_client_by_email(session, email) -> Client | None` â€”
    `select(Client).where(Client.email == email, Client.is_active == True).limit(1)`.
  - `find_active_client_by_phone(session, phone) -> Client | None` â€” same shape for
    `phone`.
  - `update_client(session, client, **fields) -> Client` â€” sets each `**fields` attribute
    on `client`, sets `client.updated_at = datetime.now(timezone.utc)` (FR-013), then
    `session.add + commit + refresh + return`. Caller is responsible for the lookup. On
    `IntegrityError` from the partial indexes, same translation as `create_client`.
  - `soft_delete_client(session, client) -> None` â€” sets `client.is_active = False`,
    bumps `updated_at`, commits.
  Path: `backend/app/modules/clients/repository.py`.

### Service exception types (R5, contracts/access-control-matrix.md Â§"Service-layer exception â†’ HTTP mapping")

- [X] T009 [P] Declare the typed service exceptions at the top of
  `backend/app/modules/clients/service.py` (file is currently the empty docstring stub):
  ```python
  class ClientNotFoundError(Exception):
      """Raised when a client lookup misses or the row is soft-deleted."""

  class DuplicateClientError(Exception):
      """Raised when a uniqueness collision is detected (proactively or by the DB index).

      Carries `.field` in {"email", "phone"} so the route emits the right 409 message.
      """

      def __init__(self, *, field: str) -> None:
          super().__init__(f"client with this {field} already exists")
          self.field = field
  ```
  These map to HTTP via `routes.py` (T013/T017/T020/T023). Path:
  `backend/app/modules/clients/service.py`.

### Dependencies stub (no edit)

- [X] T010 [P] Confirm `backend/app/modules/clients/dependencies.py` stays as the empty
  docstring stub. This feature has no clients-specific FastAPI `Depends()` factory beyond
  what `auth.dependencies` already provides (`get_current_user`, `require_admin`,
  `require_any`). **Do not create new dependencies here** (default policy: smallest viable
  diff). Path: `backend/app/modules/clients/dependencies.py`.

**Checkpoint**: `Client` table is migratable, schemas import, repository helpers are
callable, service exceptions are declared. **User stories may now begin in parallel on test
files; implementation tasks within `service.py` and `routes.py` serialise.**

---

## Phase 3: User Story 1 â€” Admin/manager creates a client (Priority: P1) ðŸŽ¯ MVP

**Goal** (from spec.md US1): An admin or manager calls `POST /clients` with a closed body
and receives the created client (201). Developers receive 403. Duplicate `email` or `phone`
returns 409. Bad phone / missing fields / unknown fields return 422.

**Independent Test**: With only US1 implemented, an integration test seeds three users
(admin, manager, developer). Admin POST â†’ 201 with `is_active=true` and `id` populated.
Manager POST â†’ 201. Developer POST â†’ 403. Second POST with same email â†’ 409. Second POST
with same phone â†’ 409. POST with phone `5555550100` (no `+`) â†’ 422. POST with extra field
`is_vip:true` â†’ 422.

### Tests for User Story 1 (write FIRST, must FAIL before implementation)

- [X] T011 [P] [US1] Contract test for `POST /clients` covering all US1 acceptance scenarios
  in `backend/tests/test_clients_create.py`: 201 + correct shape for admin and manager;
  403 for developer; 401 with the canonical `auth.dependencies.get_current_user` body when
  the `Authorization` header is missing; 409 on duplicate email; 409 on duplicate phone;
  422 on bad phone; 422 on missing required field; 422 on unknown field (FR-015). Each
  201-body assertion includes `"is_active": True` and the `email` echoed back lowercased.
  Path: `backend/tests/test_clients_create.py`.

### Implementation for User Story 1

- [X] T012 [US1] Implement `create_client(session, *, payload: ClientCreate, requester:
  User) -> ClientRead` in `backend/app/modules/clients/service.py` per research.md R5:
  - Look up `find_active_client_by_email(payload.email)`; if hit â†’ raise
    `DuplicateClientError(field="email")`.
  - Look up `find_active_client_by_phone(payload.phone)`; if hit â†’ raise
    `DuplicateClientError(field="phone")`.
  - Call `repository.create_client(session, **payload.model_dump())`. If the DB raises
    `DuplicateClientError`, propagate (route handles identically).
  - Return `ClientRead.model_validate(client)`.
  Path: `backend/app/modules/clients/service.py`.
- [X] T013 [US1] Implement `POST /clients` in `backend/app/modules/clients/routes.py` per
  `contracts/access-control-matrix.md` Â§"Route-to-dependency wiring":
  `Depends(get_session)`, `Depends(require_any("admin","manager"))`, calls
  `service.create_client(session, payload=payload, requester=requester)`. Catches
  `DuplicateClientError` â†’ 409 with `{"detail": f"client with this {exc.field} already exists"}`.
  **No DB access in this route, no role checks beyond `Depends`.** Returns
  `ClientRead`, status 201. Path: `backend/app/modules/clients/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_clients_create.py` is green.
US1 is end-to-end functional and demoable on its own (open Swagger, log in via
`/auth/login`, click Authorize, call `POST /clients`).

---

## Phase 4: User Story 2 â€” Admin/manager lists and reads clients (Priority: P1)

**Goal** (from spec.md US2): An admin or manager calls `GET /clients` or `GET /clients/{id}`
and receives the requested client record(s). Developers receive 403 on both. Soft-deleted
ids return 404 (FR-019).

**Independent Test**: Seed three users (admin, manager, developer); seed two active
clients via the API. Admin â†’ `GET /clients` returns two; `GET /clients/{id}` returns the
row. Manager â†’ identical. Developer â†’ 403 on both. Non-existent id (admin/manager) â†’ 404.

### Tests for User Story 2 (write FIRST, must FAIL before implementation)

- [X] T014 [P] [US2] Contract test for `GET /clients` and `GET /clients/{id}` in
  `backend/tests/test_clients_read.py` covering every cell of the access-control-matrix
  rows for both endpoints: list (admin 200 / manager 200 / developer 403); by-id (admin
  200 / manager 200 / admin 404 missing / developer 403 even on existing id â€” id-probing
  protection). 401 row sweep on both endpoints. Path:
  `backend/tests/test_clients_read.py`.

### Implementation for User Story 2

- [X] T015 [US2] Implement `get_client(session, *, client_id: int) -> ClientRead` in
  `backend/app/modules/clients/service.py`: calls `repository.get_client_by_id`; `None` â†’
  raise `ClientNotFoundError`. Returns `ClientRead.model_validate(client)`. **Same file as
  T012 â€” must run after T012.** Path: `backend/app/modules/clients/service.py`.
- [X] T016 [US2] Implement `list_clients(session) -> list[ClientRead]` in
  `backend/app/modules/clients/service.py`: calls `repository.list_clients` and maps to
  `ClientRead`. Defence-in-depth role check is unnecessary â€” the route uses
  `Depends(require_any("admin","manager"))`. **Same file as T012/T015 â€” must run after
  T015.** Path: `backend/app/modules/clients/service.py`.
- [X] T017 [US2] Implement `GET /clients` and `GET /clients/{id}` in
  `backend/app/modules/clients/routes.py` per `contracts/access-control-matrix.md`:
  - `GET /clients` â€” `Depends(require_any("admin","manager"))`, calls
    `service.list_clients`, returns `list[ClientRead]`.
  - `GET /clients/{id}` â€” `Depends(require_any("admin","manager"))`, calls
    `service.get_client`. Catches `ClientNotFoundError` â†’ 404 with
    `{"detail":"Client not found"}`.
  **No DB access in this route, no role checks beyond `Depends`.** **Same file as T013 â€”
  must run after T013.** Path: `backend/app/modules/clients/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_clients_read.py` is green.
Admins and managers have their read surface; developers are correctly walled off.

---

## Phase 5: User Story 3 â€” Admin/manager updates a client (Priority: P1)

**Goal** (from spec.md US3): An admin or manager calls `PATCH /clients/{id}` with one or
more of `{name, email, phone, company_name, address, notes}`. Validation, persistence,
`updated_at` bump, return the updated record.

**Independent Test**: Seed admin + manager + developer + two clients. Admin PATCH
`{name:"X"}` â†’ 200 + `updated_at` advanced. Manager PATCH `{notes:"..."}` â†’ 200. Admin
PATCH `{}` â†’ 422. Admin PATCH `{is_vip:true}` â†’ 422 (extra forbidden). Admin PATCH
non-existent id â†’ 404. Developer PATCH any â†’ 403. **Cross-row uniqueness**: Admin attempts
to change client A's email to client B's active email â†’ 409.

### Tests for User Story 3 (write FIRST, must FAIL before implementation)

- [X] T018 [P] [US3] Contract test for `PATCH /clients/{id}` in
  `backend/tests/test_clients_update.py` covering all US3 acceptance scenarios: 200 on
  name change with `updated_at > created_at`; 200 on manager updating notes; 422 on empty
  body (FR-011); 422 on extra field (FR-015); 422 on bad phone format (FR-008); 404 on
  missing id (FR-019); 403 for developer; **409 cross-row email collision**; **409
  cross-row phone collision**; 200 when patching a client's email to its own current
  email (no false-positive). Path: `backend/tests/test_clients_update.py`.

### Implementation for User Story 3

- [X] T019 [US3] Implement `update_client(session, *, client_id: int, patch: ClientUpdate)
  -> ClientRead` in `backend/app/modules/clients/service.py` per research.md R5:
  - Lookup `client = repository.get_client_by_id(session, client_id)`; raise
    `ClientNotFoundError` on miss.
  - For each of `email` / `phone` actually present in the patch (`patch.model_dump(
    exclude_unset=True)` keys), call the matching `find_active_*` lookup; if the result
    is not None AND its `.id != client_id` â†’ raise `DuplicateClientError(field=...)`.
  - Apply via `repository.update_client(session, client, **patch.model_dump(
    exclude_unset=True))`. Return `ClientRead.model_validate(client)`.
  Empty-patch / extra-field / bad-phone rejection happens at the Pydantic layer (T007);
  this service function never sees them. **Same file as T012/T015/T016 â€” must run after
  T016.** Path: `backend/app/modules/clients/service.py`.
- [X] T020 [US3] Implement `PATCH /clients/{id}` in `backend/app/modules/clients/routes.py`:
  `Depends(require_any("admin","manager"))`, call `service.update_client`. Map
  `ClientNotFoundError` â†’ 404, `DuplicateClientError` â†’ 409 with the same envelope as
  T013. Pydantic-422 is automatic. **No DB access in this route.** **Same file as T013/T017
  â€” must run after T017.** Path: `backend/app/modules/clients/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_clients_update.py` is green.
Admins and managers can patch clients; cross-row uniqueness is enforced.

---

## Phase 6: User Story 4 â€” Admin soft-deletes a client (Priority: P2)

**Goal** (from spec.md US4): Admin calls `DELETE /clients/{id}`. Flip `is_active` to false,
bump `updated_at`, return 204. Manager and developer receive 403. Re-deleting an
already-soft-deleted id returns 404 (rows are invisible to lookups).

**Independent Test**: Seed admin + manager + developer + one client. Manager DELETE â†’ 403.
Developer DELETE â†’ 403. Admin DELETE â†’ 204; subsequent `GET /clients/{id}` â†’ 404; `GET
/clients` does not include the row; re-DELETE â†’ 404. **Email/phone re-use after soft
delete**: a fresh POST with the soft-deleted client's email â†’ 201 (uniqueness applies only
to active rows; FR-009 + R1).

### Tests for User Story 4 (write FIRST, must FAIL before implementation)

- [X] T021 [P] [US4] Contract test for `DELETE /clients/{id}` in
  `backend/tests/test_clients_delete.py` covering all US4 acceptance scenarios: 204 admin
  delete; 403 manager; 403 developer; subsequent `GET /clients/{id}` 404; subsequent `GET
  /clients` excludes the row; re-DELETE 404 (idempotency-as-not-found); 401 when token
  missing. Path: `backend/tests/test_clients_delete.py`.

### Implementation for User Story 4

- [X] T022 [US4] Implement `delete_client(session, *, client_id: int) -> None` in
  `backend/app/modules/clients/service.py` per research.md R5:
  - Lookup `client = repository.get_client_by_id(session, client_id)`; raise
    `ClientNotFoundError` on miss (covers idempotent re-delete because soft-deleted rows
    are invisible to the lookup).
  - Call `repository.soft_delete_client(session, client)`.
  **Same file as T012/T015/T016/T019 â€” must run after T019.** Path:
  `backend/app/modules/clients/service.py`.
- [X] T023 [US4] Implement `DELETE /clients/{id}` in
  `backend/app/modules/clients/routes.py`: `Depends(require_admin)`, call
  `service.delete_client`. Map `ClientNotFoundError` â†’ 404. Returns status 204 with no
  body. **Same file as T013/T017/T020 â€” must run after T020.** Path:
  `backend/app/modules/clients/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_clients_delete.py` is green.
Admins can soft-delete; soft-deleted rows are invisible; manager/developer cannot delete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening + audit gates + the cross-cutting Edge Case sweep. None of these
block US1..US4 functionally; all of them back the spec's measurable success criteria.

- [X] T024 [P] Add cross-cutting uniqueness/edge-case test
  `backend/tests/test_clients_uniqueness.py` covering the spec's three
  uniqueness-flavoured Edge Cases: (a) **re-use after soft delete** â€” POST â†’ DELETE â†’
  POST same email/phone â†’ 201 (uniqueness applies only to active rows; R1); (b)
  **cross-row PATCH collision** â€” two active clients A, B; PATCH A's email to B's email
  â†’ 409 + A's row unchanged; (c) **email casing** â€” POST `Foo@Bar.com`, then POST
  `foo@bar.com` â†’ 409 (proves the `field_validator` lowercases on input). Path:
  `backend/tests/test_clients_uniqueness.py`.
- [X] T025 [P] Add `backend/scripts/audit_clients_imports.sh` per research.md R7. Mirror
  of `audit_users_imports.sh`: greps `backend/app/modules/clients/**.py` and **fails** on
  any `from app.modules.{users,projects,payments}` or `import app.modules.{users,projects,
  payments}`. From `app.modules.auth` it allows only `app.modules.auth.dependencies` and
  `app.modules.auth.schema` (the role `Literal` source-of-truth; R3). Same exit-code
  contract as the three existing audit scripts; printed status line `OK: clients module
  only imports app.modules.auth.{dependencies,schema}` on success. Path:
  `backend/scripts/audit_clients_imports.sh`.
- [X] T026 [P] Add minimal clients-event logging in `backend/app/modules/clients/service.py`:
  log "client created" with id on success of `create_client`; "client updated" with id +
  changed-keys on success of `update_client`; "client soft-deleted" with id on success of
  `delete_client`; "duplicate client guard fired" with field on `DuplicateClientError`.
  Use the project's existing logger; no new logging library. **Same file as
  T012/T015/T016/T019/T022 â€” must run after T022.** Path:
  `backend/app/modules/clients/service.py`.
- [ ] T027 Walk `quickstart.md` Steps 1â€“7 manually (`uv run --project backend uvicorn
  app.main:app --reload` against a non-prod `DATABASE_URL`; seed three users via
  `/auth/register`; walk every user story via curl as documented; run all four audit
  scripts; sanity-check `/docs`). Assert SC-001 (median `POST /clients` < 200 ms under
  the SQLite test fixture is the equivalent in-process metric). **Verification gate; no
  file is created or edited by this task.** *(May be deferred analogously to features
  002/003 if `backend/.env` still points at shared infra; the pytest suite covers the
  in-process equivalent end-to-end.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** â€” no upstream deps; can begin immediately.
- **Foundational (Phase 2)** â€” depends on Setup. **Blocks every user story.**
- **US1..US4 (Phases 3..6)** â€” all depend on Foundational. They share `service.py` and
  `routes.py`, so the **implementation tasks within those files serialise** even though
  their test files are `[P]`.
- **Polish (Phase 7)** â€” T024 depends on US1+US3+US4 (re-use after delete spans all
  three); T025 depends only on Foundational; T026 depends on US4 (logs every write
  path); T027 depends on the entire feature shipping.

### User Story Dependencies

- **US1 (`POST /clients`)** â€” depends only on Phase 2 (model+migration+schemas+repo+exceptions).
- **US2 (read/list)** â€” depends on Phase 2; orthogonal to US1 but serialises on the
  shared `service.py` / `routes.py` files.
- **US3 (`PATCH /clients/{id}`)** â€” depends on Phase 2; reuses the cross-row uniqueness
  pattern from US1 with the `exclude_id` twist. Serialises on `service.py` / `routes.py`.
- **US4 (`DELETE /clients/{id}`)** â€” depends on Phase 2; serialises on `service.py` /
  `routes.py`.

### Within Each User Story

- Tests first (write, run, see them fail).
- Service before route.
- All routes go in one file (`routes.py`) â†’ routes serialise across US1â€“US4.
- All service surfaces go in one file (`service.py`) â†’ services serialise across US1â€“US4.

### Parallel Opportunities

- **Phase 1**: T001..T004 are all `[P]` â€” audit tasks on different files.
- **Phase 2**: T007 (schema), T009 (service exceptions stub), T010 (dependencies-stub
  audit) are on different files and can run in parallel after T005/T006/T008. T005 â†’ T008
  sequential (model must declare columns before repository helpers reference them). T006
  (alembic) is independent of T005 in code but logically pairs with it; safe to run in
  parallel.
- **Phase 3..6**: each story's test file (T011, T014, T018, T021) is `[P]` â€” different
  test files; **the implementation tasks within a story serialise on `service.py` and
  `routes.py`**. Across stories, the test files can be drafted in parallel by separate
  developers; merge order on `service.py` and `routes.py` is US1 â†’ US2 â†’ US3 â†’ US4.
- **Phase 7**: T024 and T025 are `[P]` â€” one test file, one shell script. T026 is the
  service-edit (logging). T027 is the manual gate.

### Same-file serialisation summary

| File                                              | Tasks (serial within)                                   |
| ------------------------------------------------- | ------------------------------------------------------- |
| `backend/app/modules/clients/service.py`          | T009 â†’ T012 â†’ T015 â†’ T016 â†’ T019 â†’ T022 â†’ T026          |
| `backend/app/modules/clients/routes.py`           | T013 â†’ T017 â†’ T020 â†’ T023                               |
| `backend/app/modules/clients/repository.py`       | T008                                                    |
| `backend/app/modules/clients/model.py`            | T005                                                    |
| `backend/app/modules/clients/schema.py`           | T007                                                    |
| `backend/app/modules/clients/dependencies.py`     | T010 (audit only â€” file unchanged)                       |
| `backend/alembic/versions/20260504_create_client_table.py` | T006                                          |
| `backend/scripts/audit_clients_imports.sh`        | T025                                                    |

---

## Parallel Example: User Story 1

```bash
# Independent file â†’ safe to launch in parallel:
Task: "Contract test for POST /clients in backend/tests/test_clients_create.py"          # T011

# Then sequential (shared service.py / routes.py with later stories):
Task: "create_client in backend/app/modules/clients/service.py"                          # T012  (after Phase 2)
Task: "POST /clients route in backend/app/modules/clients/routes.py"                     # T013  (after T012)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 â€” all P1)

1. Phase 1: Setup (T001..T004).
2. Phase 2: Foundational (T005..T010) â€” **non-negotiable substrate**.
3. Phase 3: US1 `POST /clients` (T011..T013) â€” first demoable slice.
4. Phase 4: US2 read/list (T014..T017) â€” admin/manager surface.
5. Phase 5: US3 `PATCH /clients/{id}` (T018..T020) â€” full mutation power.
6. **STOP and VALIDATE**: run `uv run --project backend pytest backend/tests/`; manually
   walk the US1â€“US3 portions of `quickstart.md` (Steps 1â€“5 except US4). The system has
   MVP-level client-management value at this point â€” the admin can fully operate the
   active-client surface for downstream features (`projects`, `payments`).

### Incremental Delivery

1. Setup + Foundational â†’ migration applied, schemas + repo helpers + exceptions ready.
2. + US1 â†’ admins/managers can create clients.
3. + US2 â†’ admins/managers have a read surface.
4. + US3 â†’ admins/managers can mutate any field with cross-row uniqueness enforcement.
5. + US4 â†’ admin-only soft-delete; soft-deleted rows free email/phone for re-use.
6. + Polish â†’ R1/R7 audits become CI-enforced; cross-cutting Edge Cases pinned.

### Parallel Team Strategy

After Phase 2 merges and US1 (T012/T013) lands:

- Developer A: US2 (T014..T017) â€” owns next turn on `service.py` and `routes.py`.
- Developer B: US3 (T018..T020) â€” picks up after A on the shared files.
- Developer C: US4 (T021..T023) â€” picks up after B on the shared files.
- Developer D: Phase 7 polish (T024..T026) â€” entirely in `[P]` files, can run alongside
  US3/US4.

---

## Notes

- **uv only** â€” no `pip`, no manual `venv`. Every Python invocation goes through `uv run
  --project backend â€¦` from repo root, or `uv run â€¦` from inside `backend/`.
- **No file is overwritten in Setup** â€” Phase 1 is pure audit. The first file *edited* by
  this feature is `clients/model.py` in T005; the first file *created* is the alembic
  revision in T006.
- **`backend/app/main.py` is NOT edited by this feature.** The `MODULE_REGISTRY` at
  `app/main.py:18-28` already lists `("clients", "/clients")` â€” same pattern as
  features 002/003. The brief's Phase 7 ("Register routes in main.py") is a no-op.
- **`backend/app/modules/clients/dependencies.py` stays as the empty docstring stub.**
  This feature has no clients-specific `Depends()` factory beyond what
  `auth.dependencies` already provides. T010 is an audit, not an edit.
- The `Client` SQLModel **lives only in `clients/`** (ADR-0003 / FR-001). T005 creates it
  there; no other module redefines or shadows it. The new `audit_clients_imports.sh`
  (T025) backs the reverse direction (clients may import only `auth.dependencies` and
  `auth.schema`).
- All write paths set `updated_at` explicitly via the repository (FR-013) â€” the DB-level
  default exists only to satisfy NOT NULL during the migration's initial table creation.
  No DB trigger maintains this column.
- **Uniqueness applies only to active rows** (R1). The two partial unique indexes
  (`ix_client_email_active`, `ix_client_phone_active`) are filtered by `is_active = TRUE`
  on Postgres and `is_active = 1` on SQLite. The service performs a proactive read-then-
  write; the index is the ultimate guard against races. The repository translates
  `IntegrityError` into `DuplicateClientError(field=...)` so the route emits the same 409
  envelope in both cases.
- **Phone validation is regex-only** (R2). No `phonenumbers` dependency. Phones are
  stored as submitted; uniqueness sees `+1 415 555 0101` and `+14155550101` as different
  strings â€” accepted MVP trade-off, recorded as ADR candidate.
- All response bodies use `ClientRead` which has `extra="forbid"` â€” no field leaks to the
  wire that the schema does not declare.
- The 401â†’403â†’404â†’422â†’409â†’2xx response ordering (per
  `contracts/access-control-matrix.md` Â§"Ordering") is enforced by the order of guards
  in routes.py and service.py; individual tests assert the correct status for each case.
- Commit cadence: commit after each user-story phase ships green tests, not after every
  individual task. Use one PR per phase for review focus, or one PR for the full feature.
- Do not skip test tasks â€” the spec's success criteria (SC-001..SC-007) are testable
  claims; every one is mapped to a test file above.

---

**Total tasks**: 27 (T001..T027).

**Next step**: run `/sp.implement clients` to execute these tasks in dependency order, or
pick any independent `[P]` task to begin immediately.


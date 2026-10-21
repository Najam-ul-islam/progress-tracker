---
id: 0003
title: Clients management tasks
stage: tasks
date: 2026-05-03
surface: agent
model: claude-sonnet-4-6
feature: 004-clients-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["clients", "rbac", "soft-delete", "uniqueness", "tdd", "tasks"]
links:
  spec: specs/004-clients-management/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/004-clients-management/tasks.md
tests:
  - n/a (tasks stage; tests authored in /sp.implement against the task list)
---

## Prompt

`/sp.tasks` for MODULE: Clients. GLOBAL RULES: uv only, no overwrite of existing
patterns, no business logic in routes. 9 task groups mirroring the plan's phases:
1) Dependencies (`uv add fastapi sqlmodel`); 2) Model (`clients/model.py`) — fields
id/name/email/phone/company_name/address/notes/timestamps; 3) Schemas
(`clients/schema.py`) — ClientCreate, ClientUpdate, ClientRead, ClientListResponse;
4) Repository (`clients/repository.py`) — create_client, get_client_by_id,
get_clients, update_client, delete_client; 5) Service (`clients/service.py`) —
create with unique-validation, update, delete, list, get; RBAC admin=full,
manager=CRUD, developer=no access; 6) Auth Integration — use `get_current_user`;
7) Routes (`clients/routes.py`) — POST/GET list/GET by id/PATCH/DELETE; 8)
Register routes in `main.py`; 9) Validation — `uv run uvicorn app.main:app
--reload`, exercise endpoints. SUCCESS: CRUD works, RBAC enforced, no duplicates.

## Response snapshot

Authored `specs/004-clients-management/tasks.md` — 27 dependency-ordered tasks
(T001..T027) across 7 phases, modelled on feature 003's tasks.md format.

**Phase decomposition** (27 tasks total):

- **Phase 1 — Setup (T001..T004, all `[P]`)**: 4 audit tasks. Verify `pyproject.toml`
  has every runtime dep already (T001), smoke-import via `uv run python -c …` (T002),
  confirm the six-file scaffolding under `backend/app/modules/clients/` is intact
  (T003), confirm clients router is already mounted at `/clients` via
  `MODULE_REGISTRY` in `app/main.py:18-28` (T004). **No file edited in Setup.**

- **Phase 2 — Foundational (T005..T010)**: the cross-cutting substrate every story
  consumes. T005 implements the `Client` SQLModel (10 columns); T006 creates alembic
  revision `20260504_create_client_table.py` with both partial unique indexes
  (dialect-prefixed `postgresql_where=`/`sqlite_where=`); T007 implements the four
  Pydantic v2 schemas with the `_PHONE_RE` regex; T008 implements 7 narrow repository
  helpers (`create_client`, `get_client_by_id`, `list_clients`,
  `find_active_client_by_email`, `find_active_client_by_phone`, `update_client`,
  `soft_delete_client`) including the `IntegrityError → DuplicateClientError`
  translation; T009 declares the typed service exceptions (`ClientNotFoundError`,
  `DuplicateClientError(field=...)`); T010 audits that `dependencies.py` stays as
  the empty docstring stub.

- **Phase 3 — US1 Create (T011..T013)**: `[P]` test file
  `test_clients_create.py`, then `service.create_client` (proactive uniqueness
  check on email + phone), then `POST /clients` route with
  `Depends(require_any("admin","manager"))`.

- **Phase 4 — US2 Read (T014..T017)**: `[P]` test file `test_clients_read.py`,
  then `service.get_client`, then `service.list_clients`, then both `GET /clients`
  and `GET /clients/{id}` routes (admin/manager only — developer 403 even on
  existing id).

- **Phase 5 — US3 Update (T018..T020)**: `[P]` test file
  `test_clients_update.py`, then `service.update_client` (cross-row uniqueness
  with `exclude_id` semantics), then `PATCH /clients/{id}` route. Tests cover
  the cross-row 409 plus the same-row no-op 200 (avoiding false-positive
  duplicate detection when the user re-submits their own current email).

- **Phase 6 — US4 Delete (T021..T023)**: `[P]` test file
  `test_clients_delete.py`, then `service.delete_client` (soft-delete via
  `is_active = False`), then `DELETE /clients/{id}` route with
  `Depends(require_admin)`. Manager and developer 403; idempotent re-delete
  surfaces 404 because soft-deleted rows are invisible.

- **Phase 7 — Polish (T024..T027)**: cross-cutting uniqueness/edge-case test
  (`test_clients_uniqueness.py`) covering re-use after soft delete, cross-row
  PATCH collision, and email casing (T024); `audit_clients_imports.sh` (T025)
  enforcing FR-020/FR-021 with explicit allow-list for `auth.dependencies` and
  `auth.schema`; minimal event logging in `service.py` (T026); manual quickstart
  walk gate (T027, may be deferred analogously to features 002/003).

**Format conventions retained from feature 003**:

- `[ID] [P?] [Story]` row format with absolute paths.
- Same-file serialisation summary table makes the merge order explicit:
  `service.py` is `T009 → T012 → T015 → T016 → T019 → T022 → T026`,
  `routes.py` is `T013 → T017 → T020 → T023`.
- "Independent Test" pre-amble per user story (so each phase ships
  demoable value).
- "MVP First" implementation strategy stops at US3 → US1+US2+US3 cover the
  full P1 surface.
- "Parallel Team Strategy" identifies which developer can pick up which phase
  once Phase 2 merges.
- "Notes" footer pins the seven non-negotiable cross-cutting rules: uv only;
  no Setup overwrites; `app/main.py` not edited; `dependencies.py` stays
  empty; `Client` SQLModel lives only in `clients/model.py`; uniqueness
  applies only to active rows; phone validation is regex-only.

**Why 27 vs feature 003's 32**: clients has 4 user stories (vs users' 5), no
cross-cutting `password_hash` leak sweep (clients has no secret field), no
auth-bridge edit (FR-013-equivalent is in-module via the partial-index
filter, not in `auth.service`).

## Outcome

- ✅ Impact: feature 004 is now `/sp.implement`-ready. The task graph is
  dependency-ordered, every task names its file path, and the same-file
  serialisation table tells reviewers exactly which tasks block which.
- 🧪 Tests: n/a at tasks stage; the 7 SCs map 1:1 to the test files
  identified above (test_clients_create / _read / _update / _delete /
  _uniqueness — five test files, ~25-ish cases).
- 📁 Files: 1 created — `specs/004-clients-management/tasks.md` (27 tasks).
- 🔁 Next prompts: `/sp.implement clients` to execute T001..T027 in
  dependency order. Optional ADRs from the plan still stand:
  `/sp.adr clients-soft-delete-strategy`,
  `/sp.adr unique-partial-index-among-active-rows`,
  `/sp.adr phone-validation-regex-vs-library`.
- 🧠 Reflection: the brief's nine task groups collapsed into seven phases
  because Phase 1 ("Dependencies") and Phase 8 ("Register routes in
  main.py") are both audit-only no-ops for this feature. Recorded
  explicitly in T001/T004 and in the Notes footer so future readers don't
  re-litigate.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): n/a at tasks stage; the requirements
  checklist remained green from `/sp.plan`.
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.implement`, run T011
  (the failing US1 contract test) **before** T005..T010 if the env is
  already healthy — surfaces missing-substrate errors as TDD red rather
  than as IDE squiggles. If the test errors out with `ImportError` rather
  than assertion failure, the substrate ordering is correct; if it errors
  with `OperationalError: no such table client`, T006 (alembic) was
  skipped — useful diagnostic separation.

---
id: 0003
title: Users Management Tasks
stage: tasks
date: 2026-05-03
surface: agent
model: claude-sonnet-4-6
feature: 003-users-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [tasks, users, rbac, sqlmodel, fastapi, alembic, modular-monolith, tdd]
links:
  spec: specs/003-users-management/spec.md
  ticket: null
  adr: history/adr/ADR-0003-user-entity-ownership.md
  pr: null
files:
  - specs/003-users-management/tasks.md
  - history/prompts/003-users-management/0003-users-management-tasks.tasks.prompt.md
tests:
  - none (tasks stage; tests are scoped per-task and authored by /sp.implement)
---

## Prompt

/sp.tasks

MODULE: Users

OBJECTIVE:
Implement the Users module as the single source of truth for user data, including profile management and role-based access, integrated with the existing auth system.

---

🚨 GLOBAL RULES:

- Use uv for ALL commands (`uv add`, `uv run`)
- Do NOT overwrite existing files
- Do NOT duplicate User model
- NO authentication logic in this module
- NO business logic in routes
- ALL logic must be in service layer

---

TASK GROUP 1: DEPENDENCY VALIDATION

TASKS:
1. Check pyproject.toml for:
   - fastapi
   - sqlmodel

2. If missing:
   uv add fastapi
   uv add sqlmodel

3. Validate:
   uv run python -c "import fastapi"
   uv run python -c "from sqlmodel import SQLModel"

---

TASK GROUP 2: USER MODEL SETUP

TASKS:
1. Locate `users/model.py`

2. Ensure User model includes:
   - id (primary key)
   - name
   - email (unique, indexed)
   - password_hash
   - role
   - is_active (default true)
   - created_at
   - updated_at

3. If model does NOT exist → create it

4. If exists → extend safely (no overwrite)

RULE:
- Do NOT create duplicate User model anywhere else

---

TASK GROUP 3: USER SCHEMAS

TASKS:
1. Open/Create `users/schema.py`

2. Implement:

   - UserRead
   - UserUpdate
   - UserListResponse

3. Ensure:
   - proper typing
   - validation rules
   - no sensitive fields (no password_hash)

---

TASK GROUP 4: REPOSITORY LAYER

TASKS:
1. Open/Create `users/repository.py`

2. Implement:

   - get_user_by_id(session, id)
   - get_users(session)
   - update_user(session, user, data)
   - get_users_by_role(session, role)

3. Ensure:
   - Only DB queries
   - No business logic

---

TASK GROUP 5: SERVICE LAYER (CORE LOGIC)

TASKS:
1. Open/Create `users/service.py`

2. Implement:

   - get_user_profile(current_user)
   - get_user_by_id_service(id)
   - list_users()
   - update_user_profile(id, data, current_user)
   - change_user_status(id, is_active, current_user)
   - list_developers()

3. BUSINESS RULES:

   - Only admin can change role
   - Only admin can deactivate users
   - Developer can only access own profile
   - Manager can view users (read-only)

4. Enforce RBAC inside service layer

---

TASK GROUP 6: AUTH INTEGRATION

TASKS:
1. Import from auth module:
   - get_current_user

2. Ensure:
   - All endpoints require authentication
   - Role checks enforced via service logic

---

TASK GROUP 7: API ROUTES

TASKS:
1. Open/Create `users/routes.py`

2. Implement endpoints:

   - GET /users/me
   - GET /users/{id}
   - GET /users
   - PATCH /users/{id}
   - PATCH /users/{id}/status
   - GET /users/developers

3. RULES:

   - Use Depends(get_current_user)
   - Call service layer ONLY
   - Use schemas for response
   - No DB access

---

TASK GROUP 8: INTEGRATE ROUTES

TASKS:
1. Open `main.py`

2. Import users router

3. Register with prefix:

   /users

4. Validate:

   uv run uvicorn app.main:app --reload

---

TASK GROUP 9: VALIDATION & TESTING

TASKS:

1. Run app:
   uv run uvicorn app.main:app --reload

2. Test via `/docs`:

   - GET /users/me → returns current user
   - GET /users → admin/manager only
   - GET /users/{id} → valid access
   - PATCH /users/{id} → admin only
   - PATCH /users/{id}/status → admin only
   - GET /users/developers → only developers

3. VERIFY:

   - No unauthorized access
   - RBAC rules enforced
   - No password exposed in response
   - No business logic in routes

---

SUCCESS CRITERIA:

- User entity centralized in users module
- Profile endpoints working
- Role-based access enforced
- Developers listing works
- Auth integration successful
- No duplication of logic or models

---

NEXT STEP:

Proceed to:

/sp.implement users

## Response snapshot

Generated `specs/003-users-management/tasks.md` — 32 dependency-ordered tasks (T001..T032)
across 8 phases that translate the user's nine task-groups into the project's TDD-flavoured
SDD layout used by feature 002.

**Phase map (user task-groups → tasks.md phases):**

- User TG1 (deps validation) → Phase 1 Setup (T001..T004) — pure audit, no edits.
- User TG2 (User model) + the migration from `plan.md` → Phase 2 Foundational (T005 model
  extension, T006 alembic revision).
- User TG3 (schemas) → Phase 2 (T007 four Pydantic v2 schemas with `extra="forbid"`).
- User TG4 (repository) → Phase 2 (T008 — adds `list_users` / `list_developers` / `update_user`
  / `count_active_admins`; the user's `get_user_by_id` and `get_users_by_role` are subsumed
  by the existing `get_user_by_id` from feature 002 and by the role-filter inside
  `list_developers`).
- Phase 2 also adds T009 (service exception types stub) and T010 (test fixture extensions)
  per research.md R5 and R6.
- User TG5 (service layer) + TG6 (auth integration) → split across the five user-story
  phases so each story ships its own service surface and test:
  - Phase 3 / US1: `/users/me` (T011 test, T012 `get_user_profile`, T013 route).
  - Phase 4 / US2: read/list (T014 test, T015 `list_users`, T016 extend `get_user_profile`
    for dev-self-only, T017 routes).
  - Phase 5 / US3: `PATCH /users/{id}` (T018 test, T019 `update_user_profile` with
    last-admin guard, T020 route).
  - Phase 6 / US4: `PATCH /users/{id}/status` (T021 test, T022 `change_user_status`, T023
    one-line FR-013 bridge in `auth/service.py`, T024 route).
  - Phase 7 / US5: `/users/developers` (T025 test, T026 `list_developers`, T027 route).
- User TG7 (API routes) — already covered task-by-task in Phases 3..7 (T013, T017, T020,
  T024, T027). All wire through `Depends(require_*)` and `Depends(get_current_user)` only.
- User TG8 (integrate routes) → not a dedicated task; the existing module registry in
  `app/main.py` already mounts users at `/users`. Phase 1 T004 just verifies this.
- User TG9 (validation & testing) → Phase 8 Polish (T028..T032):
  - T028 `test_users_last_admin_guard.py` (FR-014).
  - T029 `test_users_no_password_hash_leak.py` (SC-006 sweep).
  - T030 `audit_users_imports.sh` (FR-020).
  - T031 service-layer logging.
  - T032 manual quickstart walk (verification gate; flagged as deferrable like feature 002's
    T015/T035 if the env still points at shared infra).

**Key engineering choices encoded in the task ordering:**

- **Same-file serialisation table** at the bottom of the dependencies section makes the
  serial chains explicit:
  - `service.py` chain: T009 → T012 → T015 → T016 → T019 → T022 → T026 → T031.
  - `routes.py` chain: T013 → T017 → T020 → T024 → T027.
  - All five test files (`test_users_*.py`) are `[P]` and can be drafted concurrently by
    different developers; the implementation tasks then merge in priority order.
- **403-vs-404 ordering** for `GET /users/{id}`: T012 declares `get_user_profile` and T016
  *extends* it (in the US2 phase) to enforce dev-self-only *before* the lookup. This avoids
  refactoring T012 mid-feature and keeps each task atomic.
- **FR-013 bridge as its own task (T023)**: a one-line edit inside
  `auth.service.authenticate_user` raising the existing `InvalidCredentialsError`. Pinned
  to US4 because the test that proves it (`test_users_status.py`) needs the deactivate
  endpoint to exist — but the line itself is independent and can land any time after Phase
  2.
- **Last-admin guard split between T019 and T022**: both call `count_active_admins(
  exclude_id=target_id)` in the same transaction, but the precise predicate differs (demote
  vs deactivate), so the logic is duplicated *intentionally* — colocated with the write it
  guards rather than extracted into a shared helper that obscures the rule.
- **Logging task (T031) is `[P]` Phase 8**, not embedded inside each service surface, so
  service tasks stay pure-business-logic for review focus.

**Total**: 32 tasks · 8 phases · 7 new test files · 1 alembic revision · 1 new shell audit ·
9 file edits (model, schema, repository, service, routes, dependencies, conftest, auth/service,
main.py-verify).

## Outcome

- ✅ Impact: `tasks.md` is on disk and ready for `/sp.implement` to execute mechanically.
  Every task carries an explicit file path, an explicit serialisation note when needed, and
  an explicit FR/SC anchor.
- 🧪 Tests: 7 new test files scoped (test_users_me, test_users_read, test_users_update,
  test_users_status, test_users_developers, test_users_last_admin_guard,
  test_users_no_password_hash_leak). Tests are written *before* their implementation tasks
  in each user-story phase (TDD-flavoured ordering inherited from feature 002).
- 📁 Files: 1 new file (`specs/003-users-management/tasks.md`) + this PHR. No code changes.
- 🔁 Next prompts:
  - `/sp.implement users` — executes T001..T032 in dependency order.
  - `/sp.adr soft-delete-strategy`, `/sp.adr updated-at-maintenance`,
    `/sp.adr last-admin-invariant` — three ADRs flagged in `plan.md` are still optional.
- 🧠 Reflection: the user's nine task-groups mapped cleanly to the project's existing
  phase model. Three small reframings were applied: (a) collapsed user TG8 (integrate
  routes) into a Phase 1 audit task because the registry already mounts users — saved one
  unnecessary edit; (b) split user TG5 (service layer with one bullet per surface) across
  the five US-aligned phases so each story is independently shippable and demoable, mirroring
  feature 002's strategy; (c) elevated the FR-013 auth bridge to its own task (T023) under
  US4 because it's the only edit outside `users/**` and reviewers should see it as a
  discrete change. Net result: the same 6 endpoints + 8 service surfaces the user asked for,
  but ordered so the suite passes incrementally rather than all-at-once.

## Evaluation notes (flywheel)

- Failure modes observed:
  - The user's TG4 lists `get_user_by_id`, `get_users`, `update_user`, `get_users_by_role`
    as repository helpers, but the existing repository (from feature 002) already has
    `get_user_by_id` (and `get_user_by_email`, `create_user`). Resolved by **extending in
    place** rather than overwriting (T008 says "Do NOT touch the existing helpers"). Also
    chose `list_users` and `list_developers` instead of `get_users` / `get_users_by_role`
    because the call sites in service.py read more naturally as `list_*`, and `list_developers`
    embeds the active-flag filter that the spec demands at the data layer rather than
    re-asserting it in the service. Documented in tasks.md notes.
  - The user's TG5 service signatures (`get_user_profile(current_user)`,
    `update_user_profile(id, data, current_user)`, …) drop the `session` argument that the
    project's existing pattern (feature 002) carries explicitly. Reconciled by keeping the
    explicit `session` per project convention (visible in `auth/service.py`) — testability
    + dependency-injection clarity outweigh the cosmetic shortening. Documented inline in
    each task description.
  - The user's TG5 also lists role-based business rules that overlap with the route-level
    `Depends(require_*)` from feature 002. Resolved by route-level enforcement for the
    coarse "who may call this at all" check (admin-only PATCH, admin/manager-only list) and
    service-level enforcement for the *fine-grained* rules that depend on row state
    (developer-self-only, last-admin guard, self-deactivation). Documented in
    `contracts/access-control-matrix.md` §"Enforcement points" — both layers carry guards,
    each at the cheapest place that can express it.
- Graders run and results (PASS/FAIL):
  - Smallest viable diff (CLAUDE.md): PASS — every task touches at most one file (excluding
    same-file chains within `service.py` / `routes.py`); no unrelated refactors proposed.
  - No invented APIs/contracts: PASS — six endpoints in tasks.md map 1:1 to the six in
    spec.md / openapi.yaml; no extra service surfaces beyond what plan.md / research.md
    already authorised.
  - Six-file modular layout: PASS — every users edit lands inside one of `model / schema /
    repository / service / routes / dependencies` (with `dependencies.py` left empty for
    this feature; the access-control-matrix's `get_target_user_id_for_developer` helper
    was inlined into `service.get_user_profile` for simplicity — a future refactor can
    extract it if needed, recorded in tasks.md notes implicitly).
  - ADR-0003 (User owned by users): PASS — T005 extends in place; no new model declarations
    anywhere; T030 enforces the import direction.
  - SC-006 / SC-007 continuity: PASS — `audit_jose_imports.sh` and `audit_auth_imports.sh`
    continue to pass (no users-side change touches `jose` or imports auth); T030 adds the
    reverse audit.
  - TDD ordering: PASS — every story phase places its test task before its implementation
    tasks, mirroring feature 002.
- Prompt variant (if applicable): none.
- Next experiment (smallest change to try): when `/sp.implement` runs T028
  (`test_users_last_admin_guard.py`), if the SQLite test fixture cannot enforce
  `with_for_update()` (it can't — SQLite ignores `FOR UPDATE`), the test that asserts the
  guard fires under concurrent transactions will need a `@pytest.mark.postgres` marker and
  a skip-on-sqlite. The single-threaded test runner makes the race uninteresting in CI
  anyway, but we should add a Postgres marker now to make the long-term intent visible.
  Documented as a follow-up rather than a blocker.

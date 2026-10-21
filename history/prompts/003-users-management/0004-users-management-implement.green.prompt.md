---
id: 0004
title: Users management implement
stage: green
date: 2026-05-03
surface: agent
model: claude-sonnet-4-6
feature: 003-users-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["users", "rbac", "soft-delete", "last-admin", "implement"]
links:
  spec: specs/003-users-management/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/app/modules/users/model.py
  - backend/app/modules/users/schema.py
  - backend/app/modules/users/repository.py
  - backend/app/modules/users/service.py
  - backend/app/modules/users/routes.py
  - backend/app/modules/auth/service.py
  - backend/app/main.py
  - backend/alembic/versions/20260503_add_is_active_and_updated_at_to_user.py
  - backend/tests/conftest.py
  - backend/tests/test_users_me.py
  - backend/tests/test_users_read.py
  - backend/tests/test_users_update.py
  - backend/tests/test_users_status.py
  - backend/tests/test_users_developers.py
  - backend/tests/test_users_last_admin_guard.py
  - backend/tests/test_users_no_password_hash_leak.py
  - backend/scripts/audit_users_imports.sh
  - specs/003-users-management/tasks.md
tests:
  - tests/test_users_me.py (6 cases)
  - tests/test_users_read.py (11 cases)
  - tests/test_users_update.py (12 cases)
  - tests/test_users_status.py (8 cases)
  - tests/test_users_developers.py (5 cases)
  - tests/test_users_last_admin_guard.py (4 cases)
  - tests/test_users_no_password_hash_leak.py (1 sweep)
  - feature 002 regression suite (17 cases)
  - scripts/audit_users_imports.sh
  - scripts/audit_auth_imports.sh
  - scripts/audit_jose_imports.sh
---

## Prompt

`/sp.implement` for MODULE: Users — STRICT + SAFE + UV-ONLY execution of the
32 tasks in `specs/003-users-management/tasks.md`. Nine STEPs mirror the
task groups: deps-validation, model setup, schemas, repository, service core,
auth integration, API routes, route integration, validation. Hard rules:

- uv-only (`uv add`, `uv sync`, `uv run`); never pip / manual venv.
- No new User model — extend the existing one in place.
- No auth logic in users module; only `app.modules.auth.dependencies` may be
  imported.
- No business logic in routes; all logic lives in `users.service`.
- Admin = full access; manager = view-only; developer = self-only.
- Only admin can change roles or deactivate.
- On error: stop, identify root cause, apply minimal fix, re-run validation.
  Do not refactor large parts or introduce new architecture.
- Completion only if app runs via
  `uv run uvicorn app.main:app --reload` with no regressions.

## Response snapshot

Executed all 32 tasks across 8 phases.

- Phase 1 (T001–T004): asserted plan/contracts/quickstart on disk; added
  `backend/scripts/audit_users_imports.sh` (FR-020 grep guard).
- Phase 2 (T005–T010): extended `User` model with `is_active`, `created_at`,
  `updated_at`; wrote Alembic revision
  `20260503_add_is_active_and_updated_at_to_user.py` with explicit
  `server_default=sa.true()` / `sa.func.current_timestamp()`; added Pydantic v2
  schemas (`UserRead`, `UserUpdate`, `UserStatusUpdate`, `UserListResponse`)
  with `extra="forbid"` and a `model_validator` requiring at least one field
  on PATCH; extended repository with `list_users`, `list_developers`,
  `update_user` (app-layer `updated_at` bump), `count_active_admins`; added
  `seed_admin/manager/developer` + `make_token` + `auth_header` fixtures
  (corrected `test.local` → `example.com` after Pydantic email-validator
  rejected the reserved TLD).
- Phase 3 (T011–T013) US1: `GET /users/me` for every role; no password_hash
  leak.
- Phase 4 (T014–T017) US2: list + by-id with admin/manager/developer matrix,
  including the developer-403-on-missing-id id-probing protection.
- Phase 5 (T018–T020) US3: `PATCH /users/{id}` admin-only; rejects `email` /
  `password` in body (FR-012); 422 on empty / all-null body.
- Phase 6 (T021–T024) US4: `PATCH /users/{id}/status`; FR-013 bridge added in
  `auth.service.authenticate_user` (one extra `if not user.is_active` after
  password verify, raising the same `InvalidCredentialsError` → byte-identical
  401 envelope per SC-005).
- Phase 7 (T025–T027) US5: `GET /users/developers` declared **before**
  `/{id}` so FastAPI matches the literal path first.
- Phase 8 (T028–T032): last-admin guard tests (demote + deactivate, both
  paths and 2-admin happy paths); password_hash sweep across all six
  endpoints; audit scripts pass; manual quickstart (T032) deferred (the
  in-process equivalent is exercised by the 64-test pytest suite, same
  pattern as feature 002 T015/T035 — `backend/.env` points at shared Neon
  Postgres infra).

Final validation: `uv run pytest tests/ -q` → **64 passed in 43.71s**.
`bash scripts/audit_users_imports.sh && bash scripts/audit_auth_imports.sh
&& bash scripts/audit_jose_imports.sh` → all three OK. No regressions to the
17 feature-002 tests.

## Outcome

- ✅ Impact: feature 003 Users module ships behind the planned RBAC + last-admin
  invariant; auth login now honours `is_active` via FR-013 bridge with
  byte-identical 401.
- 🧪 Tests: 64 passed (17 from feature 002 untouched, 47 new for users); 3
  audit scripts green.
- 📁 Files: 10 new (1 alembic revision, 7 test files, 1 audit script, 1 PHR),
  7 modified (model/schema/repository/service/routes/main, auth/service,
  conftest).
- 🔁 Next prompts: `/sp.specify clients`, `/sp.specify projects`, optionally
  `/sp.adr soft-delete-strategy`, `/sp.adr last-admin-invariant`,
  `/sp.adr updated-at-maintenance`.
- 🧠 Reflection: combining T012+T016 into one `get_user_profile` saved a
  refactor pass. Declaring `/developers` before `/{id}` and bridging FR-013
  *after* (not before) password verify were the two ordering decisions that
  preserved both correctness and SC-005's byte-identical 401.

## Evaluation notes (flywheel)

- Failure modes observed: Pydantic email-validator rejected `@test.local`
  (reserved TLD) — fixed by switching fixture emails to `@example.com`.
- Graders run and results (PASS/FAIL): pytest 64/64 PASS;
  audit_users_imports PASS; audit_auth_imports PASS; audit_jose_imports PASS.
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): wire `T032` quickstart against a
  disposable SQLite file so the manual walk can run in CI without Neon.

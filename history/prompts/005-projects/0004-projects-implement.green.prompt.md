---
id: 0004
title: Implement projects module GREEN
stage: green
date: 2026-05-07
surface: agent
model: claude-sonnet-4-6
feature: 005-projects
branch: 005-projects
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [projects, modules, rbac, share-cap, soft-delete, activation-gate]
links:
  spec: specs/005-projects/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/app/modules/projects/model.py
  - backend/app/modules/projects/schema.py
  - backend/app/modules/projects/repository.py
  - backend/app/modules/projects/service.py
  - backend/app/modules/projects/routes.py
  - backend/app/main.py
  - backend/alembic/versions/20260504_create_project_table.py
  - backend/tests/conftest.py
  - backend/tests/_projects_helpers.py
  - backend/tests/test_projects_create.py
  - backend/tests/test_projects_read.py
  - backend/tests/test_projects_update.py
  - backend/tests/test_modules_crud.py
  - backend/tests/test_modules_progress.py
  - backend/tests/test_projects_progress.py
  - backend/scripts/audit_projects_imports.sh
tests:
  - backend/tests/test_projects_create.py (13 passed)
  - backend/tests/test_projects_read.py (7 passed)
  - backend/tests/test_projects_update.py (12 passed)
  - backend/tests/test_modules_crud.py (20 passed)
  - backend/tests/test_modules_progress.py (11 passed)
  - backend/tests/test_projects_progress.py (11 passed)
  - full sweep (178 passed)
---

## Prompt

/sp.implement

MODULE: Projects

OBJECTIVE:
Implement Projects module safely with uv, enforcing share logic and RBAC.

---

MODE:
STRICT + SAFE + UV-ONLY

---

RULES:

- DO NOT overwrite files
- DO NOT break existing modules
- USE uv only
- NO business logic in routes
- ALL logic in service layer

---

EXECUTION:

1. Dependencies
- uv add fastapi sqlmodel (if missing)

2. Models
- create/extend Project + ProjectModule

3. Schemas
- add only if missing

4. Repository
- DB-only operations

5. Service

Implement:

- create_project
- add_module
- assign_developer
- update_module_progress
- calculate_project_progress

ENFORCE:

- share ≤ 70%
- valid client_id
- developer role = developer
- progress 0–100

6. Routes

- implement endpoints
- use Depends(get_current_user)

7. Integration
- register router (/projects)

---

VALIDATION:

Run:
uv run uvicorn app.main:app --reload

Test:

- create project
- add modules
- assign devs
- update progress
- share overflow → fail
- developer access control

---

ERROR RULE:

- STOP on error
- fix minimal
- re-run

---

DONE IF:

- project + modules working
- progress calculated
- share logic enforced
- RBAC correct
- app runs successfully

---

NEXT:
/sp.specify payments

## Response snapshot

Implemented the Projects module across all 8 phases, strictly preserving
existing modules and using `uv` only.

- Models: `Project` (13 cols) + `ProjectModule` (11 cols) with CHECK
  constraints for status, progress range, share range, total>0, end>=start.
  FKs use `ON DELETE RESTRICT` (soft-delete keeps the row alive).
- Alembic revision `20260504_project` chained on `20260504_client`.
- Schemas: 8 Pydantic v2 models, all `extra="forbid"`. `ProjectUpdate.status`
  is `Literal["active"] | None` so only the manual transition is reachable
  through the API. Date-range merge validated in the service.
- Repository: 13 single-statement helpers; `update_module` bumps both module
  and parent project `updated_at` (FR-017).
- Service: 11 typed exceptions mapped to the canonical 401→403→404→422
  ladder; `_CAP = Decimal("70.00")`, `_maybe_autocomplete_project` invoked
  from every module write path; activation gate enforces sum == 70.00.
- Routes: TWO routers in one file — `router` for `/projects/*` and
  `modules_router` for `/modules/*`, since each `MODULE_REGISTRY` entry maps
  to a single prefix. `app.main.register_modules` got a 4-line conditional
  to mount the second router under `/modules`.
- Tests: 6 new files, 74 cases total covering US1-US7. SQLite Date columns
  required Python `date` objects (initial gotcha — strings are rejected).
- Audit script `audit_projects_imports.sh` enforces FR-027: only
  `clients.repository` / `users.repository` / `auth.dependencies` /
  `auth.schema` may be imported from siblings.
- Smoke test: `uvicorn app.main:app` boots cleanly; `/openapi.json` lists
  all 6 path templates / 10 endpoints (`/projects`, `/projects/{id}`,
  `/projects/{id}/progress`, `/projects/{id}/modules`, `/modules/{id}`,
  `/modules/{id}/progress`).

Final test sweep: **178 passed, 10 warnings in 120.63s**.

## Outcome

- ✅ Impact: Projects + modules CRUD, share-cap dual gate, activation gate, derived module status, auto-completion of project, soft-delete, per-row dev visibility, FR-027 import allow-list — all live and green.
- 🧪 Tests: 178 passed (74 new for projects/modules, 104 prior auth/clients/users untouched).
- 📁 Files: 16 created/modified — 5 module files, 1 alembic, 1 conftest one-liner, 1 main.py 4-line edit, 1 helper, 6 test files, 1 audit script.
- 🔁 Next prompts: `/sp.specify payments` (per user's NEXT directive).
- 🧠 Reflection: Two-router-one-file pattern was the smallest viable diff; resisted the temptation to generalize `MODULE_REGISTRY` to support multiple prefixes since only this module needs it today.

## Evaluation notes (flywheel)

- Failure modes observed: SQLite Date column rejects ISO strings — must pass `datetime.date` objects from helpers; first iteration of the audit grep didn't recognize `from app.modules.X import repository` form (fixed in second pass).
- Graders run and results (PASS/FAIL): pytest sweep PASS (178/178); FR-027 audit PASS; uvicorn smoke PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): consider extending `MODULE_REGISTRY` schema to take a list of `(router, prefix)` tuples if a third module ever needs dual prefixes.

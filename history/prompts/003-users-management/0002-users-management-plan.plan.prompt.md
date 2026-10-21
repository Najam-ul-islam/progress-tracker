---
id: 0002
title: Users Management Plan
stage: plan
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 003-users-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [plan, users, rbac, sqlmodel, fastapi, alembic, modular-monolith]
links:
  spec: specs/003-users-management/spec.md
  ticket: null
  adr: history/adr/ADR-0003-user-entity-ownership.md
  pr: null
files:
  - specs/003-users-management/plan.md
  - specs/003-users-management/research.md
  - specs/003-users-management/data-model.md
  - specs/003-users-management/contracts/openapi.yaml
  - specs/003-users-management/contracts/access-control-matrix.md
  - specs/003-users-management/quickstart.md
  - history/prompts/003-users-management/0002-users-management-plan.plan.prompt.md
tests:
  - none (plan stage; tests enumerated in plan + quickstart, written by /sp.tasks → /sp.implement)
---

## Prompt

/sp.plan

MODULE: Users

OBJECTIVE:
Implement the Users module as the single source of truth for the User entity, including profile management, role handling, and developer listing, integrated safely into the existing uv-based modular system.

---

EXECUTION MODE:

- Modular architecture (model → repository → service → routes)
- Non-destructive (extend existing code only)
- uv-only commands
- RBAC enforced via auth dependencies

---

PHASE 1: DEPENDENCY VALIDATION

GOALS:
Ensure required dependencies already exist.

REQUIRED:
- fastapi
- sqlmodel

TASKS:
- Inspect pyproject.toml
- If missing → install using:
  uv add <package>

OUTPUT:
- Dependencies ready

---

PHASE 2: USER MODEL CREATION / VALIDATION

GOALS:
Ensure User model exists and is correct

LOCATION:
- users/model.py

REQUIRED FIELDS:
- id (primary key)
- name
- email (unique, indexed)
- password_hash
- role
- is_active (default true)
- created_at
- updated_at

TASKS:
- If model does NOT exist → create
- If exists → extend safely

RULE:
- Do NOT duplicate model
- Do NOT break existing auth integration

OUTPUT:
- User model finalized

---

PHASE 3: SCHEMA DESIGN

GOALS:
Define API schemas

SCHEMAS:
- UserRead
- UserUpdate
- UserListResponse

TASKS:
- Implement in users/schema.py
- Add validation rules

OUTPUT:
- Clean API contract

---

PHASE 4: REPOSITORY LAYER

GOALS:
Abstract DB operations

TASKS:
- Create users/repository.py

Implement:
- get_user_by_id()
- get_users()
- update_user()
- get_users_by_role()

RULE:
- Only DB operations
- No business logic

OUTPUT:
- Repository ready

---

PHASE 5: SERVICE LAYER

GOALS:
Implement business logic and RBAC rules

TASKS:
- Create users/service.py

Implement:

- get_user_profile()
- list_users()
- update_user_profile()
- change_user_status()
- list_developers()

BUSINESS RULES:
- Only admin can change roles
- Only admin can deactivate users
- Developer can only view own profile
- Manager can view users (read-only)

OUTPUT:
- Core logic implemented

---

PHASE 6: RBAC INTEGRATION

GOALS:
Integrate with auth module

TASKS:
- Use auth/dependencies:
  - get_current_user()

- Enforce role checks inside service layer

OUTPUT:
- Access control working

---

PHASE 7: API ROUTES

GOALS:
Expose user management endpoints

TASKS:
- Create users/routes.py

Endpoints:

- GET /users/me
- GET /users/{id}
- GET /users
- PATCH /users/{id}
- PATCH /users/{id}/status
- GET /users/developers

RULE:
- Call service layer only
- Use schemas
- No DB access

OUTPUT:
- API endpoints ready

---

PHASE 8: INTEGRATION INTO MAIN APP

GOALS:
Register routes

TASKS:
- Import users router in main.py
- Add prefix:

  /users

VALIDATION:
- Run:
  uv run uvicorn app.main:app --reload

OUTPUT:
- Routes visible in /docs

---

PHASE 9: VALIDATION & TESTING

GOALS:
Ensure functionality

TEST CASES:

1. GET /users/me → returns current user
2. GET /users → admin/manager only
3. GET /users/{id} → valid access
4. PATCH /users/{id} → admin only
5. PATCH /users/{id}/status → admin only
6. GET /users/developers → returns only developers

EXECUTION:
- Use Swagger `/docs`

VERIFY:
- RBAC rules enforced
- No unauthorized access
- No data leaks

---

CONSTRAINTS:

- NO authentication logic in this module
- NO duplication of User model
- MUST follow modular structure:
  model → repository → service → routes
- MUST use auth dependencies for protection
- MUST use uv for all commands

---

SUCCESS CRITERIA:

- User entity centralized
- Profile management works
- Role-based restrictions enforced
- Developers listing works
- Seamless integration with auth module

---

NEXT STEP:

Proceed to:

/sp.tasks users

## Response snapshot

Generated the full Phase 0 + Phase 1 planning artefacts for `003-users-management`:

- **`plan.md`** — Summary, Technical Context (Python 3.13 / FastAPI / SQLModel /
  alembic / SQLite-in-mem tests / uv-only), Constitution Check (template
  unfilled → defer to CLAUDE.md default policies + ADR-0003 / SC-006 / SC-007
  continuity, all PASS), Project Structure (six-file users layout filled,
  one-file alembic revision, three test files added on top of the existing
  conftest, one new audit script). All edits explicitly enumerated; only
  cross-module touch is a one-line addition inside `auth.service.authenticate_user`
  for FR-013.
- **`research.md`** — Seven decisions (R1–R7): (R1) one alembic revision adds
  `is_active` and `updated_at` with DB defaults that backfill existing rows;
  (R2) extend `users/model.py` in place; (R3) four Pydantic v2 schemas with
  `extra="forbid"` and a model_validator for the empty-patch case; (R4)
  repository extension — list/update/count helpers + `with_for_update()` for
  the last-admin path; (R5) service-layer business rules with the exact
  exception → HTTP mapping and the FR-013 auth bridge as a single line in
  `authenticate_user`; (R6) three new fixture wrappers + `make_token`; (R7) new
  grep audit script `audit_users_imports.sh` for FR-020. Each decision lists
  alternatives considered and the reason they were rejected.
- **`data-model.md`** — Full column-by-column table for `User` (showing which
  came from feature 002 vs which are NEW), state-transition diagram, FR-by-FR
  enforcement-layer table, full Pydantic v2 class bodies, and the alembic
  upgrade/downgrade outline.
- **`contracts/openapi.yaml`** — OpenAPI 3.1 spec for all six endpoints, with
  named `responses` for 401/403/404/409/422 (explicitly using
  `additionalProperties: false` on every schema to enforce FR-012 from the
  contract side), three named examples for the 409 conflict cases (last-admin
  demote, last-admin deactivate, self-deactivate), and `bearerAuth` security
  scheme.
- **`contracts/access-control-matrix.md`** — Internal contract: the (endpoint ×
  role) RBAC matrix, the canonical 401→403→404→422→409→200 ordering rule, route
  pseudocode showing exactly which `Depends(...)` each endpoint uses, and the
  service-exception → HTTP-status mapping.
- **`quickstart.md`** — Seven-step manual walk: alembic, pytest, uvicorn, seed
  three users via the existing `/auth/register`, log them in, walk every user
  story with curl (including the negative cases for 403/422/409), run the three
  audit scripts, sanity-check `/docs`. Mirrors feature 002's quickstart format.

**Three ADR suggestions** raised in `plan.md`'s "Architectural Decision suggestions"
section, all passing the three-part significance test:

1. *Soft-delete via `is_active` boolean (no hard delete endpoint)*.
2. *`updated_at` maintained at the application layer, not via DB trigger*.
3. *Last-admin guard enforced at service-layer with transactional count*.

None auto-created; the user may opt into any/all/none with `/sp.adr`.

**Constitution Check** is held to CLAUDE.md default policies (the actual
constitution file is still a template). All policies pass on initial check and
on post-design re-evaluation. Complexity Tracking section intentionally empty —
nothing in this plan exceeds the smallest-viable-diff envelope.

**Skipped intentionally**: `update-agent-context.ps1` was not run because this
feature introduces zero new technologies. CLAUDE.md already covers FastAPI /
SQLModel / uv / modular layout from features 001–002.

## Outcome

- ✅ Impact: complete planning artefact set on disk; `/sp.tasks` can mechanically
  translate the plan + 5 user stories + 7 SCs into a dependency-ordered tasks.md.
- 🧪 Tests: none yet — five test files (`test_users_me.py`, `test_users_read.py`,
  `test_users_update.py`, `test_users_status.py`, `test_users_developers.py`)
  plus two cross-cutting tests (`test_users_last_admin_guard.py`,
  `test_users_no_password_hash_leak.py`) are scoped in `plan.md` and will be
  authored by `/sp.tasks` → `/sp.implement`.
- 📁 Files: 6 new files under `specs/003-users-management/` (plan, research,
  data-model, two contracts, quickstart) + this PHR. No code changes.
- 🔁 Next prompts:
  - `/sp.tasks users` — generate the executable tasks.md.
  - Optionally `/sp.adr` for any of the three flagged decisions before tasks.
- 🧠 Reflection: the spec was already very tight, so the plan added value mostly
  by (a) writing FR-013 as a one-line edit in `auth.service.authenticate_user`
  rather than as a duplicated check inside users — preserves SC-005's
  byte-identical 401 envelope from feature 002 by reusing
  `InvalidCredentialsError`; (b) fixing the 403-vs-404 ordering for
  `GET /users/{id}` so developers can't probe id-existence; (c) committing to
  *application-layer* `updated_at` maintenance to keep SQLite-test/Postgres-prod
  parity (DB-trigger approaches diverge); (d) committing to *service-layer*
  last-admin enforcement with `SELECT … FOR UPDATE` rather than a Postgres-only
  partial-index trick. Each of those is a small choice that compounds across
  the whole feature.

## Evaluation notes (flywheel)

- Failure modes observed:
  - The constitution file is still the unfilled template, so the Constitution
    Check section had to fall back to CLAUDE.md default policies. Worth flagging
    as a follow-up: filling in `.specify/memory/constitution.md` with even three
    real principles (e.g., test-first, smallest-viable-diff, no-cross-module-imports)
    would let future plans evaluate against concrete gates instead of the
    default-policy table.
- Graders run and results (PASS/FAIL):
  - Smallest viable diff (CLAUDE.md): PASS — only `users/**`, one `auth/service.py`
    line, one alembic file, one audit script, and the test suite are touched.
  - No invented APIs/contracts: PASS — six endpoints in `plan.md` map 1:1 to the
    six in `spec.md`.
  - No hardcoded secrets: PASS — zero new secrets introduced.
  - Six-file modular layout: PASS — all six files of `users/` are in scope; no
    new files outside the layout.
  - ADR-0003 (User owned by users): PASS — extension in place, no shadowing.
  - SC-006 / SC-007 continuity: PASS — users imports zero JWT/bcrypt symbols and
    only consumes `auth.dependencies` (infrastructure).
- Prompt variant (if applicable): none.
- Next experiment (smallest change to try): if `/sp.tasks` shows that the
  last-admin guard test needs a separate transaction-isolation fixture (because
  SQLite doesn't honour `FOR UPDATE`), add a `pytest` marker `@pytest.mark.postgres`
  and skip on SQLite — better than weakening the guard logic.

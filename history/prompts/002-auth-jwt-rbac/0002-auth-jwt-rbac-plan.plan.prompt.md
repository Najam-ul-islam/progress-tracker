---
id: 0002
title: auth jwt rbac plan
stage: plan
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [auth, jwt, rbac, fastapi, sqlmodel, plan]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/002-auth-jwt-rbac/plan.md
  - specs/002-auth-jwt-rbac/research.md
  - specs/002-auth-jwt-rbac/data-model.md
  - specs/002-auth-jwt-rbac/contracts/openapi.yaml
  - specs/002-auth-jwt-rbac/contracts/role-guards.md
  - specs/002-auth-jwt-rbac/quickstart.md
  - CLAUDE.md
tests:
  - none (plan stage; tests will be defined in /sp.tasks)
---

## Prompt

/sp.plan

MODULE: Authentication

OBJECTIVE:
Implement a secure, modular authentication system using FastAPI, SQLModel, and JWT, fully integrated into the existing uv-based project without breaking current functionality.

---

EXECUTION MODE:

- Modular implementation
- Service-layer driven logic
- uv-only dependency and runtime usage
- Non-destructive integration

---

PHASE 1: DEPENDENCY VALIDATION

GOALS:
Ensure all required authentication dependencies are available.

REQUIRED:
- fastapi
- sqlmodel
- python-jose[cryptography]
- passlib[bcrypt]

OPTIONAL:
- email-validator (for email validation)

TASKS:
- Inspect pyproject.toml
- Install ONLY missing packages using:
  uv add <package>

OUTPUT:
- All auth dependencies available

---

PHASE 2: USER MODEL DEFINITION

GOALS:
Define User table using SQLModel

FIELDS:
- id (primary key)
- name
- email (unique, indexed)
- password_hash
- role
- created_at

TASKS:
- Create or extend `users/model.py`
- Ensure compatibility with SQLModel
- Add proper indexing and constraints

CONSTRAINT:
- Do NOT duplicate existing models
- Extend safely if model already exists

OUTPUT:
- User model ready

---

PHASE 3: SCHEMA DESIGN

GOALS:
Define request/response schemas for authentication

SCHEMAS:
- UserCreate
- UserLogin
- UserRead
- TokenResponse

TASKS:
- Implement in `auth/schema.py`
- Ensure strict validation

OUTPUT:
- Clean API contract schemas

---

PHASE 4: PASSWORD SECURITY

GOALS:
Implement password hashing and verification

TASKS:
- Setup bcrypt hashing using passlib
- Create helper functions:
  - hash_password()
  - verify_password()

LOCATION:
- core/security.py OR auth/service.py

OUTPUT:
- Secure password handling

---

PHASE 5: JWT IMPLEMENTATION

GOALS:
Implement token generation and validation

TASKS:
- Create JWT utility functions:
  - create_access_token()
  - decode_token()
- Use environment variable for secret key
- Define token expiration logic

LOCATION:
- core/security.py

OUTPUT:
- JWT system ready

---

PHASE 6: REPOSITORY LAYER

GOALS:
Abstract database operations

TASKS:
- Create `auth/repository.py`
- Implement:
  - get_user_by_email()
  - create_user()

RULE:
- No business logic here
- Only DB queries

OUTPUT:
- Clean DB access layer

---

PHASE 7: SERVICE LAYER (CORE LOGIC)

GOALS:
Implement authentication business logic

TASKS:
- Create `auth/service.py`
- Implement:
  - register_user()
  - authenticate_user()
  - generate_token()

LOGIC:
- Hash password on registration
- Verify password on login
- Generate JWT on success

OUTPUT:
- Core auth logic complete

---

PHASE 8: AUTH DEPENDENCIES (RBAC)

GOALS:
Enable authentication and role-based access

TASKS:
- Create `auth/dependencies.py`
- Implement:
  - get_current_user()
  - get_current_active_user()
  - role-based guards

OUTPUT:
- Secure route protection

---

PHASE 9: API ROUTES

GOALS:
Expose authentication endpoints

TASKS:
- Create `auth/routes.py`
- Implement endpoints:
  - POST /auth/register
  - POST /auth/login
  - GET /auth/me

RULE:
- Routes must call service layer only
- No direct DB access

OUTPUT:
- Auth API ready

---

PHASE 10: INTEGRATE INTO MAIN APP

GOALS:
Register auth routes in FastAPI app

TASKS:
- Import router in `main.py`
- Include with prefix `/auth`

VALIDATION:
- Run:
  uv run uvicorn app.main:app --reload

OUTPUT:
- Auth endpoints accessible

---

PHASE 11: VALIDATION & TESTING

GOALS:
Ensure system works correctly

TEST CASES:

1. Register user → success
2. Duplicate email → error
3. Login valid → JWT returned
4. Login invalid → error
5. Access protected route → requires token
6. Invalid token → rejected

EXECUTION:

- Run app using:
  uv run uvicorn app.main:app --reload

- Test via `/docs`

OUTPUT:
- Fully working authentication system

---

SECURITY CONSTRAINTS:

- Passwords MUST be hashed
- JWT secret from environment variables
- No sensitive data returned
- Tokens must expire

---

ARCHITECTURE CONSTRAINTS:

- NO business logic in routes
- NO DB access in routes
- MUST follow:
  model → repository → service → routes
- MUST use existing project structure

---

SUCCESS CRITERIA:

- User can register
- User can login and receive JWT
- Protected routes require valid token
- Role-based access works
- No security vulnerabilities

---

NEXT STEP:

Proceed to `/sp.tasks auth` for executable implementation steps.

## Response snapshot

Executed Phase 0 (research) and Phase 1 (design + contracts) of `/sp.plan` for the
`002-auth-jwt-rbac` feature. Inspected the existing `backend/` structure and confirmed the
six-file modular layout is already scaffolded for both `auth` and `users` modules, that
`python-jose[cryptography]`, `passlib[bcrypt]`, `fastapi`, and `sqlmodel` are already declared
in `backend/pyproject.toml`, and that `core/security.py` has `NotImplementedError` stubs ready
to be filled in.

Generated artifacts:

1. `research.md` — 13 decision blocks (R1–R13) covering bcrypt vs argon2, python-jose vs PyJWT,
   JWT claim shape, token expiry default (60 min), JWT_SECRET_KEY hard-fail at boot, email
   normalisation, generic 401 shape, role enum representation, User-table ownership, the
   `get_current_user` + role-guard factory pattern, logging strategy, test stack
   (pytest+SQLite-in-mem), and the alembic migration approach. All NEEDS CLARIFICATION resolved.
2. `data-model.md` — `User` SQLModel field-by-field with DB and Pydantic constraints, the
   transient `AccessToken` claim contract (`sub` / `email` / `role` / `iat` / `exp`, HS256),
   schema-level value objects (`UserCreate`, `UserLogin`, `UserRead`, `TokenResponse`,
   `AuthError`), the alembic migration plan, and a spec-FR ↔ design cross-reference table.
3. `contracts/openapi.yaml` — OpenAPI 3.1 contract for `POST /auth/register`, `POST /auth/login`,
   `GET /auth/me`, modelling the same `UserCreate` / `UserLogin` / `UserRead` / `TokenResponse`
   / `AuthError` shapes plus `bearerAuth` security scheme.
4. `contracts/role-guards.md` — internal Python contract for `get_current_user`, the
   `require_roles(*allowed)` factory, and the `require_admin` / `require_manager` /
   `require_developer` / `require_any` convenience guards. Stable-name guarantees declared.
5. `quickstart.md` — uv-only smoke-test runbook covering env setup, alembic migration,
   uvicorn boot, and curl-driven exercise of US1 → US2 → US3 + a US4 role-guard demo.
6. `plan.md` — final plan with Technical Context, Constitution Check (template-state, treated
   as "no concrete gates yet" with default-policy compliance recorded), Project Structure
   (concrete file map under `backend/app/`), Phase 0/1 artifact index, post-design
   re-evaluation, and three ADR suggestions: JWT signing strategy, password hashing algorithm,
   and User-entity ownership.
7. `CLAUDE.md` — agent context file refreshed via
   `update-agent-context.ps1 -AgentType claude` so future agents see the active stack
   (Python 3.13, FastAPI/SQLModel, Postgres + SQLite-in-mem).

ADR suggestions surfaced (no auto-creation; awaiting user consent):

- 📋 Architectural decision detected: JWT signing strategy (HS256 vs asymmetric).
  Document reasoning and tradeoffs? Run `/sp.adr jwt-signing-strategy`.
- 📋 Architectural decision detected: password hashing algorithm (bcrypt vs argon2).
  Document reasoning and tradeoffs? Run `/sp.adr password-hashing-algorithm`.
- 📋 Architectural decision detected: ownership of the User entity.
  Document reasoning and tradeoffs? Run `/sp.adr user-entity-ownership`.

Stop & Report:

- Branch: `002-auth-jwt-rbac`
- IMPL_PLAN: `D:\progress-tracker\specs\002-auth-jwt-rbac\plan.md`
- Generated: `research.md`, `data-model.md`, `contracts/openapi.yaml`,
  `contracts/role-guards.md`, `quickstart.md`
- Next: run `/sp.tasks` to convert this plan into a dependency-ordered `tasks.md`.

## Outcome

- ✅ Impact: Phase 0/1 plan artifacts complete for the auth feature; ready to drive `/sp.tasks` and downstream implementation without further clarification.
- 🧪 Tests: none (plan-stage); test stack chosen (pytest + TestClient + SQLite-in-mem) and acceptance scenarios mapped from spec ready for `/sp.tasks` decomposition.
- 📁 Files: 6 spec-folder artifacts created/updated (`plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `contracts/role-guards.md`, `quickstart.md`) + `CLAUDE.md` agent context.
- 🔁 Next prompts: `/sp.tasks` for executable task list; optionally `/sp.adr` for the three flagged architectural decisions.
- 🧠 Reflection: Constitution is still the unfilled template, so gates were treated as "no concrete gates yet" with default-policy compliance recorded — once principles are filled in, this plan should be re-checked.

## Evaluation notes (flywheel)

- Failure modes observed: none in this run; create-phr shell script not present (Windows env), used agent-native PHR fallback.
- Graders run and results (PASS/FAIL): not applicable for the planning stage.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): once `/sp.tasks` runs, verify the JWT-claims contract in `data-model.md §2.2` matches what `core/security.py::create_access_token` actually mints — single integration test pinning the claim set is the smallest worthwhile check.

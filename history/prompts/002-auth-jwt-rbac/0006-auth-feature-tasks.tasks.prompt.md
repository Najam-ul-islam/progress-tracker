---
id: 0006
title: Auth Feature Tasks
stage: tasks
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [tasks, auth, jwt, rbac, fastapi, sqlmodel, uv, tdd]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: history/adr/ADR-0001-jwt-signing-strategy.md, history/adr/ADR-0002-password-hashing-algorithm.md, history/adr/ADR-0003-user-entity-ownership.md
  pr: null
files:
  - specs/002-auth-jwt-rbac/tasks.md
  - history/prompts/002-auth-jwt-rbac/0006-auth-feature-tasks.tasks.prompt.md
tests:
  - none yet (tasks.md mandates pytest test files in Phase 2..7; not authored here)
---

## Prompt

/sp.tasks

MODULE: Authentication

OBJECTIVE:
Implement a secure authentication system using FastAPI, SQLModel, JWT (HS256), and bcrypt, following modular architecture and existing project structure.

---

🚨 GLOBAL RULES:

- Use uv for ALL commands (`uv add`, `uv run`)
- Do NOT overwrite existing files
- Do NOT duplicate User model (owned by users module)
- NO business logic in routes
- ALL logic must be in service layer

---

TASK GROUP 1: DEPENDENCY SETUP

TASKS:
1. Check pyproject.toml for required packages:
   - python-jose[cryptography]
   - passlib[bcrypt]

2. If missing → install using:
   uv add python-jose[cryptography]
   uv add passlib[bcrypt]

3. Verify installation:
   uv run python -c "from jose import jwt"
   uv run python -c "from passlib.context import CryptContext"

---

TASK GROUP 2: USER MODEL VALIDATION (USERS MODULE)

TASKS:
1. Locate `users/model.py`
2. Ensure User model includes:
   - id (primary key)
   - name
   - email (unique, indexed)
   - password_hash
   - role
   - created_at

3. IF missing fields → extend safely (do NOT overwrite)

---

TASK GROUP 3: AUTH SCHEMAS

TASKS:
1. Open/Create `auth/schema.py`
2. Implement schemas:

   - UserCreate
     (name, email, password, role)

   - UserLogin
     (email, password)

   - UserRead
     (id, name, email, role)

   - TokenResponse
     (access_token, token_type, user)

3. Add validation (email format, required fields)

---

TASK GROUP 4: PASSWORD SECURITY

TASKS:
1. Open/Create `core/security.py`
2. Implement:

   - password hashing (bcrypt)
   - password verification

   Functions:
   - hash_password(password)
   - verify_password(plain, hashed)

3. Use passlib CryptContext

---

TASK GROUP 5: JWT IMPLEMENTATION

TASKS:
1. In `core/security.py`, implement:

   - create_access_token(data)
   - decode_access_token(token)

2. Requirements:
   - HS256 algorithm
   - include: user_id, email, role
   - expiration time

3. Load SECRET_KEY from environment variables

---

TASK GROUP 6: AUTH REPOSITORY

TASKS:
1. Open/Create `auth/repository.py`
2. Implement:

   - get_user_by_email(session, email)
   - create_user(session, user_data)

3. Use SQLModel session
4. NO business logic here

---

TASK GROUP 7: AUTH SERVICE (CORE LOGIC)

TASKS:
1. Open/Create `auth/service.py`

2. Implement:

   - register_user()
     → validate email uniqueness
     → hash password
     → create user

   - authenticate_user()
     → fetch user
     → verify password

   - login_user()
     → call authenticate_user
     → generate JWT

3. Ensure all logic is here (NOT in routes)

---

TASK GROUP 8: AUTH DEPENDENCIES (RBAC)

TASKS:
1. Open/Create `auth/dependencies.py`

2. Implement:

   - get_current_user()
     → extract token
     → decode JWT
     → fetch user

   - role-based guards (optional basic version)

3. Use FastAPI Depends

---

TASK GROUP 9: AUTH ROUTES

TASKS:
1. Open/Create `auth/routes.py`

2. Implement endpoints:

   - POST /auth/register
   - POST /auth/login
   - GET /auth/me

3. Rules:
   - Call service layer ONLY
   - No direct DB access
   - Use schemas for request/response

---

TASK GROUP 10: INTEGRATE ROUTES

TASKS:
1. Open `main.py`
2. Import auth router
3. Register with prefix:

   /auth

4. Validate app:

   uv run uvicorn app.main:app --reload

---

TASK GROUP 11: ENV CONFIGURATION

TASKS:
1. Ensure `.env` file exists
2. Add:

   SECRET_KEY=your_secret_key
   ACCESS_TOKEN_EXPIRE_MINUTES=60

3. Ensure config loader reads env variables

---

TASK GROUP 12: TESTING & VALIDATION

TASKS:

1. Run app:
   uv run uvicorn app.main:app --reload

2. Test via `/docs`:

   - Register user → success
   - Register duplicate → fail
   - Login valid → JWT returned
   - Login invalid → fail
   - Access /auth/me → requires token

3. Verify:
   - Password is hashed
   - Token contains correct data
   - Unauthorized access blocked

---

SUCCESS CRITERIA:

- User can register and login
- JWT is generated and validated
- Passwords securely hashed
- Protected route works (/auth/me)
- No logic outside service layer
- No duplication of User entity

---

NEXT STEP:

Proceed to:

/sp.implement auth

## Response snapshot

Generated `specs/002-auth-jwt-rbac/tasks.md` (35 tasks across 7 phases) honouring the user's
12-group outline while reorganising by user story per the sp.tasks template:

- **Phase 1 Setup (T001–T005)**: audits — pyproject deps already present, dev test deps via
  `uv add --group dev`, smoke-import `jose` + `passlib`, scaffolding audit, `tests/`
  directory creation. Non-destructive.
- **Phase 2 Foundational (T006–T016)**: Settings + secret-eager-load (FR-010), `.env.example`,
  hash/verify helpers, JWT encode/decode helpers, User SQLModel in `users/`, `users.repository`,
  `auth.repository` thin facade, alembic revision + apply/rollback verification, conftest with
  SQLite-in-mem + dependency override.
- **Phase 3 US1 Register (T017–T021)**: contract test first → `UserCreate`/`UserRead`/`AuthError`
  schemas → `register_user` service → `POST /auth/register` route → router-mount audit.
- **Phase 4 US2 Login (T022–T025)**: contract test → `UserLogin`/`TokenResponse` schemas →
  `authenticate_user` + `login_user` service (single `InvalidCredentialsError` → byte-identical
  401) → `POST /auth/login` route.
- **Phase 5 US3 /auth/me (T026–T028)**: contract test (incl. FR-021 deleted-while-logged-in) →
  `get_current_user` dependency → `GET /auth/me` route.
- **Phase 6 US4 Role guards (T029–T030)**: integration test → `require_any` factory + bound
  `require_admin`/`require_manager`/`require_developer` aliases.
- **Phase 7 Polish (T031–T035)**: minimal auth-event logging (FR-022), CI grep audits for
  SC-006 (no `python-jose` outside `core.security`) and SC-007 (no cross-module imports from
  auth), no-auth-header sweep test for SC-003, manual quickstart walk for SC-001.

Every task carries the strict format `- [ ] Tnnn [P?] [USx?] description with file path`.
Each test file path, schema file path, service path, and route path is explicit. Dependencies
section enumerates phase-level and within-story constraints; parallel opportunities listed per
phase. MVP is the three P1 stories (US1+US2+US3); US4 is P2.

The user's 12-group outline maps onto the tasks.md as follows:
- Group 1 → T001–T003 (deps + smoke import)
- Group 2 → T011 (User SQLModel in users module)
- Group 3 → T018 + T023 (schemas split across US1/US2 phases)
- Group 4 → T009 (password hashing)
- Group 5 → T010 (JWT helpers)
- Group 6 → T012 (users.repository) + T013 (auth.repository facade)
- Group 7 → T019 (register_user) + T024 (authenticate + login_user)
- Group 8 → T027 (get_current_user) + T030 (role guards)
- Group 9 → T020 + T025 + T028 (three routes split across US1/US2/US3)
- Group 10 → T021 (mount audit; router already mounted in main.py)
- Group 11 → T006 (Settings) + T007 (eager load) + T008 (.env.example)
- Group 12 → T017 + T022 + T026 + T029 + T034 + T035 (test files + manual quickstart)

## Outcome

- ✅ Impact: tasks.md created — single artifact; 35 dependency-ordered tasks ready for
  `/sp.implement`. No code or schema changes. Plan/spec/ADRs untouched.
- 🧪 Tests: tasks.md prescribes pytest files in T017 (register), T022 (login), T026 (me), T029
  (role guards), T034 (no-auth sweep). Authoring deferred to implementation.
- 📁 Files: `specs/002-auth-jwt-rbac/tasks.md`, this PHR.
- 🔁 Next prompts: `/sp.implement auth` — execute tasks.md phase by phase, MVP stop after US3.
- 🧠 Reflection: User's 12-group outline was procedural ("install, configure, code, test"); the
  sp.tasks template is user-story-organised. The mapping above proves nothing was dropped:
  every group resolves to one or more numbered tasks under the right phase. Reorganising by
  user story preserves independent demoability — Phase 3 alone ships a registerable user, Phase
  4 adds a usable token, Phase 5 closes the loop.

## Evaluation notes (flywheel)

- Failure modes observed: none on this generation. The tasks.md preserves the user-story
  organisation the template demands while still covering the user's 12 procedural groups, with
  an explicit group→task mapping in the response snapshot for traceability.
- Graders run and results (PASS/FAIL):
  - Every task uses the strict format `- [ ] Tnnn [P?] [USx?] description with file path`:
    PASS (35/35).
  - Setup/Foundational/Polish carry no `[USx]` label; user-story phase tasks all carry one:
    PASS.
  - Each user story has tests *before* implementation tasks: PASS (T017→T018..T021,
    T022→T023..T025, T026→T027..T028, T029→T030).
  - File paths are explicit and absolute-relative: PASS.
  - MVP scope identified (US1+US2+US3 = the three P1 stories): PASS.
  - Parallel opportunities annotated `[P]` per task and summarised per phase: PASS.
- Prompt variant (if applicable): none.
- Next experiment (smallest change to try): if `/sp.implement` is invoked, watch whether
  Developer C (US3) and Developer D (US4) collide on `dependencies.py` — the tasks.md flags
  T030-after-T027 explicitly; if the collision still happens, split the file into
  `dependencies.py` (current-user) + `guards.py` (role guards) in a follow-up ADR rather than
  fighting it in tasks.md.

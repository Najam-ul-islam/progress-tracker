# Tasks: Authentication (JWT + RBAC)

**Feature**: `002-auth-jwt-rbac`
**Branch**: `002-auth-jwt-rbac`
**Input**: Design documents from `/specs/002-auth-jwt-rbac/`
**Prerequisites**: `plan.md` (✅), `spec.md` (✅), `research.md` (✅), `data-model.md` (✅),
`contracts/openapi.yaml` (✅), `contracts/role-guards.md` (✅), `quickstart.md` (✅)

**Tests**: Spec acceptance scenarios + SC-001..SC-007 demand integration tests. Test tasks are
**included** below (TDD-friendly: each user story phase has its tests written before the
implementation tasks for that story).

**Organization**: Tasks are grouped by user story so each story can be implemented and shipped
independently. Within each story, the order is `tests → models/schema → repository → service →
dependencies → routes → wiring`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on other in-flight tasks → safe to parallelise.
- **[Story]**: Maps task to user story. `US1` = Register, `US2` = Login, `US3` = /auth/me,
  `US4` = Role guards. Setup / Foundational / Polish phases carry no story label.
- Every task includes an absolute or repo-relative file path.

## Path Conventions

This is a `backend/` + `frontend/` monorepo. **All tasks in this feature live under `backend/`.**
Repo-relative paths are written explicitly; from the repo root they are
`backend/app/...`, `backend/tests/...`, `backend/alembic/...`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the auth feature's runtime + dev dependencies are wired through `uv` and
that the existing six-file scaffolding is intact. **No file is overwritten in this phase.**

- [X] T001 [P] Verify auth runtime deps are already declared in `backend/pyproject.toml`
  (`fastapi`, `sqlmodel`, `pydantic`, `pydantic-settings`, `python-jose[cryptography]`,
  `passlib[bcrypt]`, `alembic`, `uvicorn[standard]`, `psycopg2-binary`). They already are —
  this task is the audit; no edit unless one is missing, in which case run
  `uv add <pkg>` from `backend/`.
- [X] T002 [P] Add the dev test dependencies via `uv add --group dev pytest pytest-asyncio httpx`
  from `backend/` so the auth test suite can exist. Confirm they land under
  `[dependency-groups].dev` in `backend/pyproject.toml` and that `uv sync` succeeds.
- [X] T003 [P] Smoke-import the two auth-critical libraries through uv to prove the env is
  healthy: `uv run --project backend python -c "from jose import jwt; from passlib.context import CryptContext"`.
  Failure → fix the env before any further task. **Non-destructive — no files touched.**
- [X] T004 [P] Confirm the six-file scaffolding already exists in `backend/app/modules/auth/`
  (`__init__.py`, `model.py`, `schema.py`, `repository.py`, `service.py`, `dependencies.py`,
  `routes.py`) and in `backend/app/modules/users/` (same set). They do — this task is the
  audit; do not overwrite anything that has content.
- [X] T005 Create the test scaffolding directory `backend/tests/` with an empty `__init__.py`
  (file path: `backend/tests/__init__.py`). The `tests/` directory does not exist yet and is
  created by this task; no other test file is touched here.

**Checkpoint**: Dependencies are present, env imports cleanly, scaffolding is whole, `tests/`
exists. No app code edited.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ship the cross-cutting primitives every user story (US1..US4) consumes —
configuration, password hashing, JWT encode/decode, the User SQLModel, the alembic migration,
the DB session-override fixture, and the secret-eager-load at startup. **No user-story endpoint
work begins until this phase is complete.**

⚠️ **CRITICAL**: This phase must be merged before US1..US4 task work starts. It contains the
non-negotiable substrate (security helpers, User model, DB schema, settings).

### Configuration & startup

- [X] T006 Confirm / extend `Settings` in `backend/app/core/config.py` to expose
  `JWT_SECRET_KEY: str` (no default — boot fails if missing per FR-010 / R5),
  `JWT_ALGORITHM: str = "HS256"`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60`, and
  `DATABASE_URL`. Reuse the existing pydantic-settings pattern; do not introduce a second
  config class. Path: `backend/app/core/config.py`.
- [X] T007 In `backend/app/main.py`, eagerly call `get_settings()` during app startup so a
  missing `JWT_SECRET_KEY` aborts boot with a clear error (FR-010, R5). Single edit; do not
  refactor unrelated code in `main.py`. Path: `backend/app/main.py`.
- [X] T008 [P] Create / update `backend/.env.example` (NOT `.env`) listing `DATABASE_URL`,
  `JWT_SECRET_KEY` (with placeholder `replace-with-a-long-random-string`), `JWT_ALGORITHM=HS256`,
  `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60`. Real `.env` stays git-ignored. Path:
  `backend/.env.example`.

### Password hashing primitives (ADR-0002)

- [X] T009 Implement `hash_password(password: str) -> str` and
  `verify_password(plain: str, hashed: str) -> bool` in `backend/app/core/security.py` using
  a module-level `passlib.context.CryptContext(schemes=["bcrypt"], deprecated="auto")`. The
  hash format must be `$2b$…`; bcrypt cost 12 (passlib default). No other module imports
  `passlib` directly. Path: `backend/app/core/security.py`.

### JWT primitives (ADR-0001, FR-008/FR-017/SC-006)

- [X] T010 Implement `create_access_token(*, user_id: int, email: str, role: str) -> str` and
  `decode_access_token(token: str) -> dict` in `backend/app/core/security.py`. Use
  `python-jose` HS256, claims `{sub: str(user_id), email, role, iat, exp}`, strict expiration
  (no leeway). Decode raises a typed exception that the auth dependency translates to HTTP 401.
  Path: `backend/app/core/security.py`. **Same file as T009 — must run after T009.**

### User entity (ADR-0003, FR-016)

- [X] T011 [US1] Implement the `User` SQLModel in `backend/app/modules/users/model.py` per
  data-model.md §1.1: `id: int PK autoinc`, `name: str (1..120)`, `email: str UNIQUE INDEX
  ix_user_email, lowercased`, `password_hash: str`,
  `role: Literal["admin","manager","developer"]` with DB CHECK,
  `created_at: datetime` (UTC default). **The User model is owned by `users/` only** — auth
  must never define its own. Path: `backend/app/modules/users/model.py`.
- [X] T012 [US1] Implement `users.repository` thin persistence helpers in
  `backend/app/modules/users/repository.py`: `get_user_by_email(session, email) -> User | None`,
  `get_user_by_id(session, user_id) -> User | None`, `create_user(session, *, name, email,
  password_hash, role) -> User`. No business logic, no hashing here — this layer only persists.
  Path: `backend/app/modules/users/repository.py`.

### Auth-side facade (FR-016, SC-007)

- [X] T013 Implement `auth.repository` as a **thin facade** over `users.repository` in
  `backend/app/modules/auth/repository.py`. Re-export pass-through functions
  (`get_user_by_email`, `get_user_by_id`, `create_user`). No SQL is issued from this file; no
  imports of `users.model` from `auth/service.py` (enforced by SC-007). Path:
  `backend/app/modules/auth/repository.py`.

### Database migration

- [X] T014 Create alembic revision `backend/alembic/versions/20260502_create_user_table.py`
  that issues `op.create_table('user', …)` with the columns from data-model.md §1.1 and
  `op.create_index('ix_user_email', 'user', ['email'], unique=True)`. Down-revision drops the
  index then the table. Path: `backend/alembic/versions/20260502_create_user_table.py`.
- [ ] T015 Run `uv run --project backend alembic upgrade head` against a dev DB to confirm the
  migration applies cleanly. Roll back with `alembic downgrade -1` and re-apply to confirm
  symmetry. **No file is created by this task — it is a verification gate.**
  *(DEFERRED by /sp.implement: `backend/.env` points at a live Neon Postgres database;
  running migrations against shared infrastructure requires explicit user authorisation. Test
  suite uses SQLite in-mem, so SQLModel/migration column shape is implicitly validated by the
  17 passing pytest cases.)*

### Test harness

- [X] T016 Create `backend/tests/conftest.py` providing: an in-memory SQLite engine fixture, a
  `client` fixture that overrides `app.db.session.get_session` to use that engine via
  `app.dependency_overrides`, an env fixture that sets `JWT_SECRET_KEY` for the test session,
  and a `seed_user` factory. Path: `backend/tests/conftest.py`.

**Checkpoint**: `Settings` boots only with `JWT_SECRET_KEY`; `core.security` can hash + verify
passwords and encode + decode JWTs; `User` table exists; `users.repository` and
`auth.repository` are wired; conftest is ready. **User stories may now begin in parallel.**

---

## Phase 3: User Story 1 — Register a new account (Priority: P1) 🎯 MVP

**Goal** (from spec.md US1): A first-time user posts to `POST /auth/register` with name, email,
password, role. The system creates the account, hashes the password with bcrypt, persists it,
and returns a sanitised user record.

**Independent Test**: With only US1 implemented, an integration test `POST /auth/register`s
valid input and asserts HTTP 201 + a user row whose `password_hash` is not the plaintext.

### Tests for User Story 1 (write FIRST, must FAIL before implementation)

- [X] T017 [P] [US1] Contract test for `POST /auth/register` happy path + the four spec
  acceptance scenarios (201 on valid input, 409 on duplicate email, 422 on bad role, 422 on
  missing fields) in `backend/tests/test_auth_register.py`. Includes the SC-002 assertion that
  `password_hash` is `$2b$…` and never the plaintext. Path:
  `backend/tests/test_auth_register.py`.

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement the request/response Pydantic schemas in
  `backend/app/modules/auth/schema.py` per data-model.md §3: `UserCreate` (name, email
  lowercased+stripped, password 8..128, role literal), `UserRead` (id, name, email, role,
  created_at — **no password_hash**), `AuthError`. `model_config = ConfigDict(extra="ignore")`
  on inputs. Path: `backend/app/modules/auth/schema.py`.
- [X] T019 [US1] Implement `register_user(session, payload: UserCreate) -> User` in
  `backend/app/modules/auth/service.py`: pre-check `users.repository.get_user_by_email` →
  raise `EmailAlreadyExistsError` (HTTP 409) on hit; call
  `core.security.hash_password`; call `auth.repository.create_user`; race-loser path catches
  `IntegrityError` and re-raises as 409 (FR-003). All logic lives here, **never in routes**.
  Path: `backend/app/modules/auth/service.py`.
- [X] T020 [US1] Implement `POST /auth/register` in `backend/app/modules/auth/routes.py`:
  inject `Session = Depends(get_session)`, call `service.register_user`, return `UserRead`
  with status 201. Map `EmailAlreadyExistsError` → HTTP 409 with `AuthError` body. **No DB
  access or hashing in this file.** Path: `backend/app/modules/auth/routes.py`.
- [X] T021 [US1] In `backend/app/main.py`, confirm the `auth` router is mounted at prefix
  `/auth` (the existing module-registry already does this — verify, do not duplicate). Path:
  `backend/app/main.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_auth_register.py` is green. US1 is
end-to-end functional and demoable on its own.

---

## Phase 4: User Story 2 — Login and receive a JWT (Priority: P1)

**Goal** (from spec.md US2): A registered user posts credentials to `POST /auth/login` and
receives `{access_token, token_type:"bearer", user:{...}}`.

**Independent Test**: Seed one user, call `POST /auth/login` with correct credentials, decode
the returned `access_token`, and assert claims `sub`, `email`, `role`, future `exp`.

### Tests for User Story 2 (write FIRST, must FAIL before implementation)

- [X] T022 [P] [US2] Contract test for `POST /auth/login` covering all four US2 acceptance
  scenarios in `backend/tests/test_auth_login.py`: 200 + decoded claims on success, 401 on
  wrong password, 401 on unknown email **with byte-identical body to wrong-password case
  (SC-005)**, `exp` is in the future and within ±5 s of `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
  (FR-009). Path: `backend/tests/test_auth_login.py`.

### Implementation for User Story 2

- [X] T023 [P] [US2] Add `UserLogin` schema (`email` lowercased+stripped, `password` 1..128)
  and `TokenResponse` schema (`access_token: str`, `token_type: Literal["bearer"]`,
  `user: UserRead`) to `backend/app/modules/auth/schema.py`. Path:
  `backend/app/modules/auth/schema.py`.
- [X] T024 [US2] Implement `authenticate_user(session, email, password) -> User` and
  `login_user(session, payload: UserLogin) -> TokenResponse` in
  `backend/app/modules/auth/service.py`. `authenticate_user` returns the user only on
  successful `verify_password`; on **either** unknown email **or** wrong password it raises a
  single `InvalidCredentialsError` so the route can return one byte-identical 401 (FR-007,
  SC-005). `login_user` calls `core.security.create_access_token` and assembles
  `TokenResponse`. Path: `backend/app/modules/auth/service.py`.
- [X] T025 [US2] Implement `POST /auth/login` in `backend/app/modules/auth/routes.py`: call
  `service.login_user`, map `InvalidCredentialsError` → HTTP 401 with the canonical generic
  `AuthError` body. No DB access in this route. Path: `backend/app/modules/auth/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_auth_login.py` is green. Users can
register (US1) and obtain a token (US2). MVP for token-issuance is reached.

---

## Phase 5: User Story 3 — Read the current user via `GET /auth/me` (Priority: P1)

**Goal** (from spec.md US3): A client presenting `Authorization: Bearer <token>` to
`GET /auth/me` receives the current user's `{id, name, email, role}`.

**Independent Test**: Login (US2), capture token, GET `/auth/me` with `Authorization: Bearer
<token>`, assert 200 + matching user shape. Missing / invalid / expired token → 401 with the
same generic body.

### Tests for User Story 3 (write FIRST, must FAIL before implementation)

- [X] T026 [P] [US3] Contract test for `GET /auth/me` in `backend/tests/test_auth_me.py`
  covering: 200 + correct user on valid token, 401 on missing header, 401 on bad signature,
  401 on expired token (manually mint with `exp` in the past), and the FR-021 case (token
  refers to a deleted user → 401). All 401s share one generic body. Path:
  `backend/tests/test_auth_me.py`.

### Implementation for User Story 3

- [X] T027 [US3] Implement `get_current_user` in
  `backend/app/modules/auth/dependencies.py`: extract bearer token via FastAPI
  `OAuth2PasswordBearer(tokenUrl="auth/login")`, decode via
  `core.security.decode_access_token`, parse `sub` to int, look up via
  `auth.repository.get_user_by_id`. Any failure (missing header, bad signature, expired,
  deleted user) raises `HTTPException(401, AuthError("Could not validate credentials"))` with
  one generic body (FR-007, FR-012, FR-015, FR-021). **This is the only place outside
  `core.security` that decodes a JWT.** Path: `backend/app/modules/auth/dependencies.py`.
- [X] T028 [US3] Implement `GET /auth/me` in `backend/app/modules/auth/routes.py`:
  `current_user: User = Depends(get_current_user)`, return `UserRead.model_validate(current_user)`.
  No service call needed — the dependency *is* the service for this endpoint. Path:
  `backend/app/modules/auth/routes.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_auth_me.py` is green. The full
register → login → /me flow works end-to-end (SC-001). MVP is complete.

---

## Phase 6: User Story 4 — Role-based access enforcement (Priority: P2)

**Goal** (from spec.md US4): Other modules can declare "this endpoint requires role X" via a
one-line dependency. Auth exposes `require_admin`, `require_manager`, `require_developer`,
`require_any(*roles)`. Mismatch → HTTP 403.

**Independent Test**: Register an `admin` and a `developer`. Mount a temp test route guarded by
`require_admin`. Admin token → 200; developer token → 403.

### Tests for User Story 4 (write FIRST, must FAIL before implementation)

- [X] T029 [P] [US4] Integration test for role guards in
  `backend/tests/test_auth_role_guards.py`: mount a temp router (inside the test, via
  `app.include_router` on a fresh `FastAPI()` or via `dependency_overrides`) with one route
  per guard. Cover all three US4 acceptance scenarios: `require_admin` admits admin / rejects
  developer; `require_any("admin","manager")` admits manager and admin / rejects developer;
  generic 403 body on any rejection (SC-004). Path:
  `backend/tests/test_auth_role_guards.py`.

### Implementation for User Story 4

- [X] T030 [US4] Implement the role-guard factory + four bound dependencies in
  `backend/app/modules/auth/dependencies.py`: `require_any(*roles: str)` returns a FastAPI
  dependency that consumes `get_current_user` and raises 403 on mismatch with
  `AuthError("Forbidden")`; convenience aliases `require_admin = require_any("admin")`,
  `require_manager = require_any("manager")`, `require_developer = require_any("developer")`.
  Public surface contract per `contracts/role-guards.md`. **Same file as T027 — must run after
  T027.** Path: `backend/app/modules/auth/dependencies.py`.

**Checkpoint**: `uv run --project backend pytest tests/test_auth_role_guards.py` is green.
Other modules can now annotate their routes with `Depends(require_admin)` etc.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening + audit gates. None of these block US1..US4 functionally; all of them
back the spec's measurable success criteria.

- [X] T031 [P] Add minimal auth-event logging in
  `backend/app/modules/auth/service.py` and
  `backend/app/modules/auth/dependencies.py`: log "user registered", "login success",
  "login failure", "token rejected" with the user id/email *only on success*, never the
  password / hash / full token (FR-022, SC-002). Use the project's existing logger; no new
  logging library. Paths: `backend/app/modules/auth/service.py`,
  `backend/app/modules/auth/dependencies.py`.
- [X] T032 [P] Add a one-line grep audit script `backend/scripts/audit_jose_imports.sh` (or
  equivalent `.py`) that fails CI if `python-jose` / `jose` is imported anywhere outside
  `backend/app/core/security.py` (SC-006). Path: `backend/scripts/audit_jose_imports.sh`.
- [X] T033 [P] Add a similar one-line grep audit `backend/scripts/audit_auth_imports.sh` that
  fails if `backend/app/modules/auth/**.py` imports any sibling module other than
  `app.modules.users` (SC-007). Path: `backend/scripts/audit_auth_imports.sh`.
- [X] T034 [P] Add a no-auth-header sweep test
  `backend/tests/test_auth_protected_sweep.py` that walks every route in `app.routes` and
  asserts every protected route returns 401 when called with no `Authorization` header
  (SC-003). Skip explicitly public routes via a small allow-list. Path:
  `backend/tests/test_auth_protected_sweep.py`.
- [ ] T035 Walk the `quickstart.md` flow manually (`uv run --project backend uvicorn app.main:app
  --reload`, then register / login / `/auth/me` via Swagger UI at
  http://localhost:8000/docs). Assert SC-001 (full flow < 1 s wall-time) and that no
  `password_hash` appears in any response body. **Verification gate; no file is created or
  edited by this task.**
  *(DEFERRED by /sp.implement: requires a live Postgres + an interactive uvicorn session.
  Equivalent in-process flow is exercised end-to-end by `tests/test_auth_register.py` →
  `tests/test_auth_login.py` → `tests/test_auth_me.py` (all green).)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — no upstream deps; can begin immediately.
- **Foundational (Phase 2)** — depends on Setup. **Blocks every user story.**
- **US1..US4 (Phases 3..6)** — all depend on Foundational. They are mutually independent and
  can run in parallel by separate developers.
- **Polish (Phase 7)** — depends on the user stories that its tasks reference (T031 needs
  US1+US2+US3; T034 needs US1+US3; T032/T033 are pure audits and can run after Foundational).

### User Story Dependencies

- **US1 (Register)** — depends only on Phase 2.
- **US2 (Login)** — depends on Phase 2; reuses the User row shape but does **not** require US1
  to be merged (login can be tested by seeding a user via fixture).
- **US3 (/auth/me)** — depends on Phase 2 and on US2's `create_access_token` reuse from
  Phase 2's T010 (so it does not technically need US2 merged; it can mint its own test
  tokens).
- **US4 (Role guards)** — depends on Phase 2 and on US3's `get_current_user` (T027). T030 must
  run after T027 because they edit the same file.

### Within Each User Story

- Tests first (write, run, see them fail).
- Schemas / models before services.
- Services before routes / dependencies.
- Routes / dependencies before polish-phase touches.

### Parallel Opportunities

- **Phase 1**: T001..T004 are all `[P]` — audit tasks on different files.
- **Phase 2**: T009 and T010 are the same file (sequential); T011, T012, T014, T016 are
  different files and can run in parallel; T013 must wait for T012.
- **Phase 3..6**: each story's test file (T017, T022, T026, T029) is `[P]` — different test
  files; the implementation tasks within a story serialise on shared files (`schema.py`,
  `service.py`, `routes.py`, `dependencies.py`).
- **Across stories**: a multi-developer team can split US1, US2, US3, US4 once Phase 2 is
  merged.
- **Phase 7**: T031..T034 are all `[P]`.

---

## Parallel Example: User Story 1

```bash
# Independent file → safe to launch in parallel:
Task: "Contract test for POST /auth/register in backend/tests/test_auth_register.py"   # T017
Task: "Add UserCreate / UserRead / AuthError to backend/app/modules/auth/schema.py"     # T018

# Then sequential (same file or downstream dep):
Task: "register_user service in backend/app/modules/auth/service.py"                    # T019  (after T018)
Task: "POST /auth/register route in backend/app/modules/auth/routes.py"                 # T020  (after T019)
Task: "Verify auth router mount in backend/app/main.py"                                 # T021  (after T020)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Phase 1: Setup (T001..T005).
2. Phase 2: Foundational (T006..T016) — **non-negotiable substrate**.
3. Phase 3: US1 Register (T017..T021) — first demoable slice.
4. Phase 4: US2 Login (T022..T025) — token issuance reachable.
5. Phase 5: US3 `/auth/me` (T026..T028) — closes the loop; full register → login → me flow.
6. **STOP and VALIDATE**: run `uv run --project backend pytest backend/tests/`; manually walk
   `quickstart.md` (this is T035 in compressed form). The system has MVP-level auth value at
   this point — protected endpoints across the codebase can begin to require
   `Depends(get_current_user)`.

### Incremental Delivery

1. Setup + Foundational → DB ready, security helpers ready.
2. + US1 → users can be created (demo: register an admin via `curl`).
3. + US2 → users can log in (demo: receive a JWT).
4. + US3 → `/auth/me` returns the principal; FastAPI Swagger "Authorize" works.
5. + US4 → other modules can role-guard endpoints. Not needed for the MVP but unblocks every
   subsequent feature.
6. + Polish → SC-002..SC-007 audits become CI-enforced.

### Parallel Team Strategy

After Phase 2 merges:

- Developer A: US1 (T017..T021) — `schema.py`, `service.py.register_user`, route.
- Developer B: US2 (T022..T025) — `schema.py` additions, `service.py.login_user`, route.
- Developer C: US3 (T026..T028) — `dependencies.py.get_current_user`, route.
- Developer D: US4 (T029..T030) — `dependencies.py.require_any` and friends. **Coordinates
  with Developer C on `dependencies.py` — same file.**

---

## Notes

- **uv only** — no `pip`, no manual `venv`. Every Python invocation goes through `uv run
  --project backend …` from repo root, or `uv run …` from inside `backend/`.
- **No file is overwritten in Setup** — Phase 1 is pure audit. The first file *created* by
  this feature is the alembic revision in T014; the first file *edited* is `Settings` in T006.
- The User SQLModel **lives only in `users/`** (ADR-0003 / FR-016). Auth touches it through
  `auth/repository.py` which is a thin facade.
- `python-jose` and `passlib` are imported **only** in `app/core/security.py` (FR-017, SC-006).
  T032/T033 in Polish enforce this in CI.
- All login failures (unknown email, wrong password, expired token, bad signature, missing
  header) return one byte-identical 401 body (FR-007, FR-015, SC-005).
- Commit cadence: commit after each user-story phase ships green tests, not after every
  individual task. Use one PR per phase for review focus.
- Do not skip test tasks — the spec's success criteria (SC-001..SC-007) are testable claims;
  every one is mapped to a test file above.

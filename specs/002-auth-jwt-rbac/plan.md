# Implementation Plan: Authentication (JWT + RBAC)

**Branch**: `002-auth-jwt-rbac` | **Date**: 2026-05-02 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/002-auth-jwt-rbac/spec.md`

## Summary

Deliver a secure, modular authentication subsystem on top of the existing FastAPI / SQLModel
backend at `backend/app/`. Users register with `{name, email, password, role}`; the system
hashes passwords with bcrypt, persists them in a `users`-owned `User` table, and on `/auth/login`
mints a HS256 JWT containing `sub` / `email` / `role` / `iat` / `exp`. A canonical
`get_current_user` dependency plus role-guard factories (`require_admin`, `require_manager`,
`require_developer`, `require_any`) become the only legal "who is calling" hook for every other
module.

**Technical approach** (validated in [`research.md`](./research.md)):

- Reuse the project's modular six-file layout (`model / schema / repository / service / routes /
  dependencies`) which is already scaffolded under `backend/app/modules/auth/` and
  `backend/app/modules/users/`.
- Put JWT primitives in `app/core/security.py`; configuration in `app/core/config.py`. No other
  module imports `python-jose` directly (FR-017, SC-006).
- The `User` SQLModel is owned by `users/`; `auth/repository.py` is a thin facade calling into
  `users/repository.py` (FR-016, SC-007).
- One alembic revision creates the `user` table with `UNIQUE INDEX ix_user_email`.

## Technical Context

**Language/Version**: Python 3.13 (per `backend/pyproject.toml`'s `requires-python = ">=3.13"`)
**Primary Dependencies**:

- `fastapi >= 0.136.1`, `sqlmodel >= 0.0.38`, `pydantic >= 2.13.3`, `pydantic-settings`
- `python-jose[cryptography] >= 3.5.0` — JWT encode/decode (HS256)
- `passlib[bcrypt] >= 1.7.4` — password hashing
- `alembic >= 1.18.4` — schema migrations
- `uvicorn[standard]` — ASGI server (dev + prod)
- Test deps to add: `pytest`, `pytest-asyncio`, `httpx` (added via `uv add --group dev …`)

**Storage**: PostgreSQL via `psycopg2-binary` for dev/prod (`DATABASE_URL`); SQLite in-memory
for the test suite (FastAPI dependency override).
**Testing**: `pytest` + FastAPI `TestClient`. Test cases enumerated in spec acceptance scenarios
and lifted into `tasks.md` in Phase 2.
**Target Platform**: Linux server (containerised) for prod; Windows 10 + WSL/native for dev.
**Project Type**: web-application backend (`backend/`) + frontend (`frontend/`) monorepo. This
feature only touches `backend/`.
**Performance Goals**: register / login / `/auth/me` round-trip < 1 s wall-clock on a developer
machine (SC-001). bcrypt cost factor 12 ⇒ ~250 ms hash; the rest is DB I/O.
**Constraints**:

- uv-only for dependency and runtime usage (`uv add`, `uv sync`, `uv run …`). No `pip`, no
  manual `venv`, no Poetry.
- Non-destructive integration: existing modules (`clients`, `projects`, …) MUST keep importing
  cleanly; their `routes.py` files already export `router` and stay untouched.
- No business logic in routes; no DB access in routes; routes call services only.
- Six-file layout per module is mandatory: `model / schema / repository / service / routes /
  dependencies`. The auth and users modules already have this scaffolded with module-purpose
  docstrings.

**Scale/Scope**: ≤ ~10k registered users in the medium term; one role per user; access tokens
only (no refresh tokens, no revocation list). Three roles total: `admin`, `manager`, `developer`.

## Constitution Check

The project constitution at `.specify/memory/constitution.md` is currently a **template** —
its principle slots are placeholders (`[PRINCIPLE_1_NAME]`, etc.) and contain no enforced rules
yet. Therefore there are no concrete constitutional gates to evaluate against this feature.

In place of formal gates, this plan is held to the **default policies** in `CLAUDE.md`:

| Default policy                                                  | Status          | Evidence                                                                                                                  |
| --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Smallest viable diff; no unrelated refactors                    | ✅ Pass         | All edits are confined to `backend/app/core/security.py`, `backend/app/main.py`, the `auth` and `users` module folders, and `alembic/versions/`. |
| Don't invent APIs / contracts; clarify if missing               | ✅ Pass         | All NEEDS CLARIFICATION resolved in `research.md`. No invented endpoints — only the three the spec mandates.              |
| No hardcoded secrets; secrets via `.env`                        | ✅ Pass         | `JWT_SECRET_KEY` flows through `Settings`; tests inject a fixture secret via env, never via code.                         |
| Cite existing code with code references; new code in fences     | ✅ Pass         | Plan references `backend/app/core/security.py`, `backend/app/db/session.py`, etc. as code touchpoints.                    |
| Six-file modular layout                                         | ✅ Pass         | Auth and users modules already obey it; this feature only fills empty files.                                              |

If/when the constitution is filled in (e.g., a TDD principle, an observability principle), this
section will be re-evaluated; for now there are no violations to track in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-jwt-rbac/
├── spec.md                  # already exists (input)
├── plan.md                  # this file (/sp.plan output)
├── research.md              # Phase 0 output (/sp.plan)
├── data-model.md            # Phase 1 output (/sp.plan)
├── quickstart.md            # Phase 1 output (/sp.plan)
├── contracts/
│   ├── openapi.yaml         # Phase 1 — HTTP contract for /auth/register, /auth/login, /auth/me
│   └── role-guards.md       # Phase 1 — internal Python contract for get_current_user + guards
├── checklists/              # already exists (spec-quality checklist)
└── tasks.md                 # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 20260502_create_user_table.py        # NEW — Phase 2 task
├── app/
│   ├── main.py                                  # EDIT — eager get_settings() at startup (R5)
│   ├── core/
│   │   ├── config.py                            # EDIT — confirm 60-min JWT default (R4)
│   │   └── security.py                          # IMPLEMENT — hash/verify password, encode/decode JWT
│   ├── db/
│   │   ├── base.py                              # unchanged
│   │   └── session.py                           # unchanged (provides get_session)
│   └── modules/
│       ├── auth/
│       │   ├── __init__.py                      # unchanged
│       │   ├── model.py                         # unchanged (auth-specific value objects only)
│       │   ├── schema.py                        # IMPLEMENT — UserCreate / UserLogin / UserRead / TokenResponse / AuthError
│       │   ├── repository.py                    # IMPLEMENT — thin facade over users.repository
│       │   ├── service.py                       # IMPLEMENT — register_user / authenticate_user / generate_token
│       │   ├── dependencies.py                  # IMPLEMENT — get_current_user + require_roles factory + role guards
│       │   └── routes.py                        # IMPLEMENT — POST /register, POST /login, GET /me
│       └── users/
│           ├── model.py                         # IMPLEMENT — User SQLModel (id, name, email, password_hash, role, created_at)
│           ├── schema.py                        # unchanged for this feature (users module owns its own schemas later)
│           ├── repository.py                    # IMPLEMENT — get_user_by_email, get_user_by_id, create_user
│           ├── service.py                       # unchanged for this feature
│           ├── routes.py                        # unchanged (empty router)
│           └── dependencies.py                  # unchanged
├── pyproject.toml                               # POSSIBLY EDIT — add pytest/httpx via `uv add --group dev`
└── tests/                                       # NEW — test suite created by Phase 2 tasks
    ├── conftest.py                              # NEW — TestClient + SQLite-in-mem fixtures
    ├── test_auth_register.py                    # NEW — US1 acceptance
    ├── test_auth_login.py                       # NEW — US2 acceptance
    ├── test_auth_me.py                          # NEW — US3 acceptance
    └── test_auth_role_guards.py                 # NEW — US4 acceptance
```

**Structure Decision**: This is a monorepo with a clear `backend/` (Python/FastAPI) and
`frontend/` separation. The auth feature lives entirely under `backend/app/modules/auth/` and
`backend/app/modules/users/`, plus the cross-cutting `backend/app/core/security.py`. The
existing module-registry pattern in `backend/app/main.py` already mounts `auth` at `/auth`, so
no main-app surgery beyond the secret-eager-resolution edit is needed.

## Phase 0 → Phase 1 outputs

| Artifact            | Path                                                       | Status       |
| ------------------- | ---------------------------------------------------------- | ------------ |
| Research            | `specs/002-auth-jwt-rbac/research.md`                      | ✅ Complete  |
| Data model          | `specs/002-auth-jwt-rbac/data-model.md`                    | ✅ Complete  |
| HTTP contracts      | `specs/002-auth-jwt-rbac/contracts/openapi.yaml`           | ✅ Complete  |
| Internal contracts  | `specs/002-auth-jwt-rbac/contracts/role-guards.md`         | ✅ Complete  |
| Quickstart          | `specs/002-auth-jwt-rbac/quickstart.md`                    | ✅ Complete  |
| Agent context update| `CLAUDE.md` (preserved manual sections)                    | ✅ Complete  |

## Re-evaluated Constitution Check (post-design)

No new violations introduced by Phase 1 design. All choices stay within the smallest-viable-diff
envelope: nothing is built that the spec or research did not justify; no new modules, no
speculative abstractions, no rewrites of unrelated code.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*(none — section intentionally left empty)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Architectural Decision suggestions

The following Phase 1 choices pass the three-part ADR significance test (long-term impact +
multiple alternatives + cross-cutting scope) and are candidates for ADRs after this plan is
approved. They are **suggestions only** — no ADR is auto-created.

1. **JWT signing strategy: HS256 + single-process secret** — alternatives RS256/EdDSA were
   rejected because the API is the only verifier today. Long-term impact: switching later means
   a key-rotation migration.

   📋 Architectural decision detected: JWT signing strategy (HS256 vs asymmetric).
   Document reasoning and tradeoffs? Run `/sp.adr jwt-signing-strategy`.

2. **Password hashing: bcrypt (passlib) over argon2** — both are in `pyproject.toml`. Choosing
   bcrypt locks the format of `password_hash` rows; migrating later is a per-user
   re-hash-on-login operation.

   📋 Architectural decision detected: password hashing algorithm (bcrypt vs argon2).
   Document reasoning and tradeoffs? Run `/sp.adr password-hashing-algorithm`.

3. **User model owned by `users`, not `auth`** — fixes the cross-module dependency direction
   for the rest of the system (every other module FK's to `user.id` via the users module).

   📋 Architectural decision detected: ownership of the User entity.
   Document reasoning and tradeoffs? Run `/sp.adr user-entity-ownership`.

## Stop & Report

Phase 0 (research) and Phase 1 (design + contracts) are complete.

- **Branch**: `002-auth-jwt-rbac`
- **Plan path**: `specs/002-auth-jwt-rbac/plan.md`
- **Generated artifacts**:
  - `specs/002-auth-jwt-rbac/research.md`
  - `specs/002-auth-jwt-rbac/data-model.md`
  - `specs/002-auth-jwt-rbac/contracts/openapi.yaml`
  - `specs/002-auth-jwt-rbac/contracts/role-guards.md`
  - `specs/002-auth-jwt-rbac/quickstart.md`

**Next step**: run `/sp.tasks` to convert this plan into the executable, dependency-ordered
`tasks.md` for the `auth` feature.

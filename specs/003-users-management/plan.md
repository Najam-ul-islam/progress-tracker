# Implementation Plan: Users Management

**Branch**: `003-users-management` | **Date**: 2026-05-02 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/003-users-management/spec.md`

## Summary

Extend the existing `users` module from "owns the User SQLModel + 3 internal repository
helpers used by `auth`" to "the public users management surface of the SaaS". Add two
columns to the `User` table (`is_active`, `updated_at`), expose six HTTP endpoints under
`/users`, enforce role-based access through the existing `auth.dependencies` (no role
checks invented here), and bridge one new behaviour back into the auth module: a user
whose `is_active` is `false` MUST be rejected at login with the same byte-identical 401
the wrong-password path already returns (FR-013, preserves SC-005 from feature 002).

**Technical approach** (validated in [`research.md`](./research.md)):

- Reuse the project's modular six-file layout under `backend/app/modules/users/`
  (`model / schema / repository / service / routes / dependencies`). All six files
  exist; this feature **fills** them — no new layout, no new patterns.
- Keep the `User` SQLModel as the single source of truth (ADR-0003). Add columns through
  one alembic revision; no other module owns user state.
- Reuse `auth.dependencies.{get_current_user, require_admin, require_any}` as the only
  authorisation primitives. Users module has zero direct knowledge of JWTs or bcrypt.
- One small, surgical edit to `auth.service.authenticate_user` to enforce FR-013, raising
  the same `InvalidCredentialsError` it already raises — preserves SC-005's byte-identical
  401 envelope.
- Test surface: SQLite-in-mem `TestClient` with `dependency_overrides[get_session]`,
  reusing the `conftest.py` fixtures already established by feature 002. Five new test
  files map 1:1 to the five user stories; one cross-cutting "no `password_hash` ever
  leaks" sweep file backs SC-006.

## Technical Context

**Language/Version**: Python 3.13 (per `backend/pyproject.toml` `requires-python = ">=3.13"`)

**Primary Dependencies** (already installed — see `backend/pyproject.toml`):

- `fastapi >= 0.136.1`, `sqlmodel >= 0.0.38`, `pydantic >= 2.13.3`, `pydantic-settings`
- `sqlalchemy` (transitive via SQLModel) — for `CheckConstraint`, `select(...).with_for_update()`
- `alembic >= 1.18.4` — for the `add_is_active_and_updated_at_to_user` revision
- `python-jose`, `passlib[bcrypt]` — **not imported here**; consumed only via
  `auth.dependencies` (preserves SC-006)

**Test deps** (already in dev group via feature 002): `pytest`, `pytest-asyncio`, `httpx`.

**Storage**: PostgreSQL via `psycopg2-binary` for dev/prod (`DATABASE_URL`); SQLite
in-memory + `StaticPool` for the test suite via the same fixtures feature 002 added.

**Testing**: `pytest` + FastAPI `TestClient`. Five integration test files (one per user
story) plus a cross-cutting sweep test for `password_hash` exclusion. Tests run with
`uv run pytest backend/tests/`.

**Target Platform**: Linux server (containerised) for prod; Windows 10 + native Python
for dev.

**Project Type**: web-application backend (`backend/`) + frontend (`frontend/`) monorepo.
This feature only touches `backend/`.

**Performance Goals**: median response time < 200 ms under the SQLite test fixture
(SC-001). The dominant cost in any users endpoint is one or two DB lookups; no hashing,
no token signing, no external I/O. Real-world Postgres budget for the same path is
< 100 ms p95 with proper indexing (`ix_user_email`, PK on `id`).

**Constraints**:

- **uv-only** for dependency and runtime usage (`uv add`, `uv sync`, `uv run …`). No
  `pip`, no manual `venv`. Memory entry: "Project: progress-tracker uses uv only".
- **Non-destructive integration**: existing modules (`auth`, `clients`, `projects`, …)
  MUST keep importing cleanly. The only file outside `users/` that this feature edits
  is `app/modules/auth/service.py` (one new check inside `authenticate_user`).
- **No business logic in routes**; no DB access in routes; routes call services only.
- **Six-file layout per module** is mandatory. All six files exist; this feature fills
  the empty ones (`schema.py`, parts of `service.py`, `routes.py`, `dependencies.py`).
- **Module boundaries**: users may import `auth.dependencies` (infrastructure) but MUST
  NOT import `auth.service`, `auth.repository`, or `auth.schema` (business logic). A
  CI grep audit script is added to enforce this (FR-020).

**Scale/Scope**: ≤ ~10k registered users in the medium term; admin/manager UI lists the
full table without pagination during MVP (`GET /users` returns an unwrapped JSON array).
Three roles total: `admin`, `manager`, `developer`. Last-admin guard (FR-014) is the
only requirement that touches transactional semantics.

## Constitution Check

The project constitution at `.specify/memory/constitution.md` is a **template** — its
principle slots are placeholders (`[PRINCIPLE_1_NAME]`, etc.) and contain no enforced
rules yet. There are no concrete constitutional gates to evaluate against this feature.

In place of formal gates, this plan is held to the **default policies** in `CLAUDE.md`
and to continuity with the auth feature's plan:

| Default policy                                                  | Status      | Evidence                                                                                                      |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| Smallest viable diff; no unrelated refactors                    | ✅ Pass     | Edits confined to `app/modules/users/**`, one method in `app/modules/auth/service.py`, one alembic revision, one new audit script, and the test suite. |
| Don't invent APIs / contracts; clarify if missing               | ✅ Pass     | All endpoints enumerated in spec; contracts in `contracts/openapi.yaml` are 1:1 with US1–US5 acceptance scenarios. Zero `[NEEDS CLARIFICATION]`. |
| No hardcoded secrets; secrets via `.env`                        | ✅ Pass     | This feature adds zero new secrets. The only env-coupled behaviour (FR-013) reuses `auth.service.authenticate_user`'s existing path. |
| Cite existing code; new code in fences                          | ✅ Pass     | Plan references `backend/app/modules/users/model.py`, `backend/app/modules/auth/dependencies.py`, etc. as touchpoints. |
| Six-file modular layout                                         | ✅ Pass     | All six files exist for `users/`; this feature only fills empty ones.                                          |
| ADR-0003 (User owned by users)                                  | ✅ Pass     | `User` SQLModel stays in `users/model.py`; no other module redefines or shadows it.                            |
| SC-006 (jose only in `core.security`)                           | ✅ Pass     | Users module imports zero JWT or bcrypt symbols; `audit_jose_imports.sh` continues to pass.                    |
| SC-007 (auth imports only `users` among siblings)               | ✅ Pass     | Direction is unchanged; users does not import auth's `service`/`repository`/`schema`. New audit script (FR-020) backs the reverse direction. |

If/when the constitution is filled in, this section will be re-evaluated; for now there
are no violations to track in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/003-users-management/
├── spec.md                       # already exists (input)
├── plan.md                       # this file (/sp.plan output)
├── research.md                   # Phase 0 output (/sp.plan)
├── data-model.md                 # Phase 1 output (/sp.plan)
├── quickstart.md                 # Phase 1 output (/sp.plan)
├── contracts/
│   ├── openapi.yaml              # Phase 1 — HTTP contract for the six /users endpoints
│   └── access-control-matrix.md  # Phase 1 — internal contract: who-can-call-what + last-admin invariant
├── checklists/
│   └── requirements.md           # already exists (spec-quality checklist, all PASS)
└── tasks.md                      # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   └── versions/
│       ├── 20260502_create_user_table.py                     # already exists (feature 002)
│       └── 20260503_add_is_active_and_updated_at_to_user.py  # NEW — Phase 2 task
├── app/
│   ├── main.py                                               # unchanged (users router already mounted at /users)
│   ├── core/
│   │   ├── config.py                                         # unchanged
│   │   └── security.py                                       # unchanged (this feature does no JWT/bcrypt work)
│   ├── db/
│   │   ├── base.py                                           # unchanged
│   │   └── session.py                                        # unchanged
│   └── modules/
│       ├── auth/
│       │   ├── service.py                                    # SMALL EDIT — authenticate_user rejects is_active=False (FR-013)
│       │   └── (everything else unchanged)
│       └── users/
│           ├── __init__.py                                   # unchanged
│           ├── model.py                                      # EDIT — add `is_active`, `updated_at` columns to User
│           ├── schema.py                                     # IMPLEMENT — UserRead, UserUpdate, UserStatusUpdate, UserListResponse
│           ├── repository.py                                 # EXTEND — add list_users, list_developers, update_user, count_active_admins
│           ├── service.py                                    # IMPLEMENT — get_user_profile, list_users, list_developers, update_user_profile, change_user_status (with last-admin guard)
│           ├── routes.py                                     # IMPLEMENT — 6 endpoints (GET /me, GET /{id}, GET /, GET /developers, PATCH /{id}, PATCH /{id}/status)
│           └── dependencies.py                               # IMPLEMENT — get_target_user_id_for_developer (helper enforcing developer self-only)
├── scripts/
│   ├── audit_jose_imports.sh                                 # unchanged (still PASS)
│   ├── audit_auth_imports.sh                                 # unchanged (still PASS)
│   └── audit_users_imports.sh                                # NEW — FR-020: users may not import auth.{service,repository,schema}
├── tests/
│   ├── conftest.py                                           # EXTEND — add seed_admin / seed_manager / seed_developer factories on top of existing seed_user
│   ├── test_users_me.py                                      # NEW — US1
│   ├── test_users_read.py                                    # NEW — US2 (list + by-id, all roles)
│   ├── test_users_update.py                                  # NEW — US3 (PATCH /users/{id})
│   ├── test_users_status.py                                  # NEW — US4 (PATCH /users/{id}/status + login-after-deactivate)
│   ├── test_users_developers.py                              # NEW — US5
│   ├── test_users_last_admin_guard.py                        # NEW — FR-014 cross-cutting
│   └── test_users_no_password_hash_leak.py                   # NEW — SC-006 sweep
└── pyproject.toml                                            # unchanged (no new deps)
```

**Structure Decision**: monorepo `backend/`. The users feature lives entirely under
`backend/app/modules/users/` with one cross-cutting edit to
`backend/app/modules/auth/service.py` for FR-013 and one alembic revision under
`backend/alembic/versions/`. The existing module-registry in `backend/app/main.py`
already mounts the users router at `/users`, so no main-app surgery is needed.

## Phase 0 → Phase 1 outputs

| Artifact            | Path                                                            | Status       |
| ------------------- | --------------------------------------------------------------- | ------------ |
| Research            | `specs/003-users-management/research.md`                        | ✅ Complete  |
| Data model          | `specs/003-users-management/data-model.md`                      | ✅ Complete  |
| HTTP contracts      | `specs/003-users-management/contracts/openapi.yaml`             | ✅ Complete  |
| Internal contracts  | `specs/003-users-management/contracts/access-control-matrix.md` | ✅ Complete  |
| Quickstart          | `specs/003-users-management/quickstart.md`                      | ✅ Complete  |
| Agent context update| `CLAUDE.md` (preserved manual sections)                         | ⏭️ Skipped — no new tech introduced; the agent file already covers FastAPI/SQLModel/uv. |

## Re-evaluated Constitution Check (post-design)

No new violations introduced by Phase 1 design. Specifically:

- The single auth-side edit (FR-013 inside `authenticate_user`) is the smallest possible
  change — one `if not user.is_active: raise InvalidCredentialsError` line. It does not
  alter the contract feature 002 established (still raises `InvalidCredentialsError`,
  still returns the same 401 body, still preserves SC-005's byte-identical envelope).
- The new `audit_users_imports.sh` script reinforces SC-007's "auth ↔ users dependency
  direction" rule from the users-module side; it does not introduce a new architectural
  pattern, only a new enforcement point.
- The last-admin guard (FR-014) is implemented at the service layer with a transactional
  count check inside the same DB session — no new locking primitives, just the standard
  SQLAlchemy session semantics already in use.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*(none — section intentionally left empty)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Architectural Decision suggestions

The following Phase 1 choices pass the three-part ADR significance test (long-term
impact + multiple alternatives + cross-cutting scope):

1. **Soft-delete via `is_active` boolean (no hard delete endpoint).** Alternatives —
   tombstone column with timestamp, separate `archived_users` table, hard delete with
   ON DELETE SET NULL — were considered and rejected for MVP. Long-term impact: every
   downstream module (projects, tasks, payments) must filter by `is_active` on lookup,
   and reactivation is a single-column flip rather than an audit-restoration flow.

   📋 Architectural decision detected: soft-delete strategy for users.
   Document reasoning and tradeoffs? Run `/sp.adr soft-delete-strategy`.

2. **`updated_at` maintained at the application layer, not via DB trigger.** Alternative
   — Postgres `updated_at` trigger or SQLAlchemy `onupdate=func.now()` — was rejected to
   keep the test suite (SQLite, no triggers) and the prod DB (Postgres, triggers possible)
   on the same path, and to make the "did this update?" answer fully visible in
   application code. Long-term impact: every write path that mutates a user MUST set
   `updated_at` explicitly, enforced by the repository layer.

   📋 Architectural decision detected: updated_at maintenance strategy (app-layer vs DB-trigger).
   Document reasoning and tradeoffs? Run `/sp.adr updated-at-maintenance`.

3. **Last-admin guard enforced at service-layer with transactional count.** Alternatives —
   DB-level partial-index "exactly-one-admin" constraint, application-layer optimistic
   check without locking, dedicated invariant service — were considered. Long-term
   impact: the rule is colocated with the write that could violate it; future writers of
   `update_user_profile` / `change_user_status` cannot accidentally bypass it because the
   count-and-check lives in the same transaction as the write.

   📋 Architectural decision detected: last-admin invariant enforcement strategy.
   Document reasoning and tradeoffs? Run `/sp.adr last-admin-invariant`.

These are **suggestions only** — no ADR is auto-created. The user may consent to any,
all, or none.

## Stop & Report

Phase 0 (research) and Phase 1 (design + contracts) are complete.

- **Branch**: `003-users-management`
- **Plan path**: `specs/003-users-management/plan.md`
- **Generated artifacts**:
  - `specs/003-users-management/research.md`
  - `specs/003-users-management/data-model.md`
  - `specs/003-users-management/contracts/openapi.yaml`
  - `specs/003-users-management/contracts/access-control-matrix.md`
  - `specs/003-users-management/quickstart.md`

**Next step**: run `/sp.tasks` to convert this plan into the executable,
dependency-ordered `tasks.md` for the `users` feature.

# Implementation Plan: Clients Management

**Branch**: `004-clients-management` (currently authored on
`003-users-management`; rebased to its own branch at commit time) | **Date**:
2026-05-03 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/004-clients-management/spec.md`

## Summary

Stand up the `clients` module: a six-file modular slice that owns the
`Client` SQLModel and exposes five HTTP endpoints under `/clients` with the
RBAC matrix `admin = full`, `manager = create + read + update`,
`developer = denied`. Persist a closed `Client` shape (id, name, email,
phone, company_name?, address?, notes?, is_active, created_at, updated_at)
in a single new alembic revision, with **two partial unique indexes**
(`email`, `phone`) filtered by `is_active = TRUE` so soft-deleted rows free
their identifiers for re-use (Edge Case in spec). Soft-delete via
`is_active = false`; no hard delete endpoint, no reactivation endpoint
(both deferred). Maintain `updated_at` at the application layer (matches
feature 003's R4 decision). Add one CI audit script
(`audit_clients_imports.sh`) that fails the build if `clients/**.py` imports
business logic from `auth`, `users`, `projects`, or `payments` (FR-020 /
FR-021).

**Technical approach** (validated in [`research.md`](./research.md)):

- Reuse the project's modular six-file layout under
  `backend/app/modules/clients/`. All six files exist as empty stubs; this
  feature **fills** them — no new layout, no new patterns.
- New `Client` SQLModel as the single source of truth for the entity.
  `app.modules.projects.client_id` (a future feature) will FK to it; this
  feature sets that up structurally without writing the FK itself.
- Reuse `auth.dependencies.{get_current_user, require_admin, require_any}`
  as the only authorisation primitives. Clients module has zero direct
  knowledge of JWTs or bcrypt. Role `Literal` is imported from
  `app.modules.auth.schema` (one source of truth; no duplication).
- Test surface: SQLite-in-mem `TestClient` with
  `dependency_overrides[get_session]`, reusing the conftest fixtures
  established by features 002/003 (`seed_admin / seed_manager /
  seed_developer / make_token / auth_header`). Five new test files map 1:1
  to the four user stories plus a cross-cutting uniqueness/edge-case file.

## Technical Context

**Language/Version**: Python 3.13 (per `backend/pyproject.toml`
`requires-python = ">=3.13"`)

**Primary Dependencies** (already installed — see `backend/pyproject.toml`):

- `fastapi >= 0.136.1`, `sqlmodel >= 0.0.38`, `pydantic >= 2.13.3`,
  `pydantic-settings`, `email-validator` (transitive via Pydantic).
- `sqlalchemy` (transitive via SQLModel) — for partial-unique
  `Index(..., postgresql_where=, sqlite_where=)`.
- `alembic >= 1.18.4` — for the `20260504_create_client_table` revision.
- `python-jose`, `passlib[bcrypt]` — **not imported here**; consumed only
  via `auth.dependencies` (preserves SC-006).

**No new dependencies are added by this feature.** The phone format check
is a pure-Python regex compiled at import time (R2).

**Test deps** (already in dev group): `pytest`, `pytest-asyncio`, `httpx`.

**Storage**: PostgreSQL via `psycopg2-binary` for dev/prod (`DATABASE_URL`);
SQLite in-memory + `StaticPool` for the test suite via the same fixtures
features 002/003 established. Both engines support partial unique indexes
(R1).

**Testing**: `pytest` + FastAPI `TestClient`. Five integration test files
plus updates to no shared fixture file. Tests run with
`uv run pytest backend/tests/`.

**Target Platform**: Linux server (containerised) for prod; Windows 10 +
native Python for dev.

**Project Type**: web-application backend (`backend/`) + frontend
(`frontend/`) monorepo. This feature only touches `backend/`.

**Performance Goals**: median response time < 200 ms under the SQLite test
fixture (SC-001). The dominant cost in any clients endpoint is one or two
DB lookups (the proactive uniqueness checks plus the insert/update); no
hashing, no token signing, no external I/O.

**Constraints**:

- **uv-only** for dependency and runtime usage (`uv add`, `uv sync`,
  `uv run …`). No `pip`, no manual `venv`. Memory entry: "Project:
  progress-tracker uses uv only".
- **Non-destructive integration**: existing modules (`auth`, `users`,
  `projects`, …) MUST keep importing cleanly. The only files outside
  `clients/` that this feature touches are one new alembic revision and
  one new audit script. **`app/main.py` is not edited** — `clients` is
  already in `MODULE_REGISTRY` at `/clients`.
- **No business logic in routes**; no DB access in routes; routes call
  services only.
- **Six-file layout per module** is mandatory. All six files exist; this
  feature fills `model.py / schema.py / repository.py / service.py /
  routes.py`. `dependencies.py` stays as the empty docstring stub — this
  feature has no clients-specific FastAPI Depends() factory beyond what
  `auth.dependencies` already provides.
- **Module boundaries**: clients may import `auth.dependencies`
  (infrastructure) and `auth.schema` (the role `Literal`, a closed
  contract). It MUST NOT import `auth.service`, `auth.repository`,
  `users.*`, `projects.*`, or `payments.*`. A CI grep audit script
  (`audit_clients_imports.sh`) enforces this (FR-020 / FR-021).

**Scale/Scope**: ≤ ~10k clients in the medium term; admin/manager UI lists
the full table without pagination during MVP (`GET /clients` returns an
unwrapped JSON array). Three RBAC roles: `admin`, `manager`, `developer`.

## Constitution Check

The project constitution at `.specify/memory/constitution.md` is a
**template** — its principle slots are placeholders (`[PRINCIPLE_1_NAME]`,
etc.) and contain no enforced rules yet. There are no concrete
constitutional gates to evaluate against this feature.

In place of formal gates, this plan is held to the **default policies** in
`CLAUDE.md` and to continuity with the auth/users feature plans:

| Default policy                                                  | Status      | Evidence                                                                                                                                                                |
| --------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smallest viable diff; no unrelated refactors                    | ✅ Pass     | Edits confined to `app/modules/clients/**`, one alembic revision, one new audit script, and the test suite. No edits to `auth`, `users`, `core`, or `db`.                |
| Don't invent APIs / contracts; clarify if missing               | ✅ Pass     | All five endpoints enumerated in spec; contracts in `contracts/openapi.yaml` are 1:1 with US1–US4 acceptance scenarios. Zero `[NEEDS CLARIFICATION]`.                    |
| No hardcoded secrets; secrets via `.env`                        | ✅ Pass     | This feature adds zero new secrets. No env-coupled behaviour.                                                                                                            |
| Cite existing code; new code in fences                          | ✅ Pass     | Plan references `backend/app/main.py:18-28` (MODULE_REGISTRY), `backend/app/modules/auth/dependencies.py`, `backend/app/modules/users/repository.py` (pattern reference). |
| Six-file modular layout                                         | ✅ Pass     | All six files exist for `clients/`; this feature fills five and leaves `dependencies.py` as the empty stub.                                                              |
| ADR-0003 spirit (one entity, one module)                        | ✅ Pass     | `Client` SQLModel lives only in `clients/model.py`; no other module redefines or shadows it.                                                                             |
| SC-006 (jose only in `core.security`)                           | ✅ Pass     | Clients module imports zero JWT or bcrypt symbols; `audit_jose_imports.sh` continues to pass.                                                                            |
| SC-007 (auth imports only `users` among siblings)               | ✅ Pass     | Direction is unchanged; clients does not import auth's `service`/`repository`. New audit script (FR-020) backs the reverse direction for clients.                        |

If/when the constitution is filled in, this section will be re-evaluated;
for now there are no violations to track in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/004-clients-management/
├── spec.md                       # already exists (input)
├── plan.md                       # this file (/sp.plan output)
├── research.md                   # Phase 0 output (/sp.plan)
├── data-model.md                 # Phase 1 output (/sp.plan)
├── quickstart.md                 # Phase 1 output (/sp.plan)
├── contracts/
│   ├── openapi.yaml              # Phase 1 — HTTP contract for the five /clients endpoints
│   └── access-control-matrix.md  # Phase 1 — internal RBAC contract
├── checklists/
│   └── requirements.md           # Phase 1 — spec-quality checklist
└── tasks.md                      # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   └── versions/
│       ├── 20260502_create_user_table.py                       # already exists (feature 002)
│       ├── 20260503_add_is_active_and_updated_at_to_user.py    # already exists (feature 003)
│       └── 20260504_create_client_table.py                     # NEW — Phase 2 task
├── app/
│   ├── main.py                                                 # unchanged — clients router already mounted at /clients
│   ├── core/                                                   # unchanged
│   ├── db/                                                     # unchanged
│   └── modules/
│       ├── auth/                                               # unchanged
│       ├── users/                                              # unchanged
│       └── clients/
│           ├── __init__.py                                     # unchanged
│           ├── model.py                                        # IMPLEMENT — Client SQLModel (10 columns)
│           ├── schema.py                                       # IMPLEMENT — ClientCreate, ClientUpdate, ClientRead, ClientListResponse
│           ├── repository.py                                   # IMPLEMENT — create_client, get_client_by_id, list_clients, find_active_*, update_client, soft_delete_client
│           ├── service.py                                      # IMPLEMENT — create_client, get_client, list_clients, update_client, delete_client (uniqueness, soft-delete)
│           ├── routes.py                                       # IMPLEMENT — 5 endpoints (POST, GET list, GET by id, PATCH, DELETE)
│           └── dependencies.py                                 # unchanged (empty stub — no clients-specific Depends needed)
├── scripts/
│   ├── audit_jose_imports.sh                                   # unchanged (still PASS)
│   ├── audit_auth_imports.sh                                   # unchanged (still PASS)
│   ├── audit_users_imports.sh                                  # unchanged (still PASS)
│   └── audit_clients_imports.sh                                # NEW — FR-020 / FR-021 enforcement
├── tests/
│   ├── conftest.py                                             # unchanged — feature 003 fixtures (seed_admin/manager/developer, auth_header) cover RBAC matrix
│   ├── test_clients_create.py                                  # NEW — US1
│   ├── test_clients_read.py                                    # NEW — US2 (list + by-id, all roles)
│   ├── test_clients_update.py                                  # NEW — US3 (PATCH + cross-row uniqueness)
│   ├── test_clients_delete.py                                  # NEW — US4 (DELETE + post-delete reads + idempotency)
│   └── test_clients_uniqueness.py                              # NEW — uniqueness Edge Cases (re-use after soft delete; concurrent insert race via dual session)
└── pyproject.toml                                              # unchanged (no new deps)
```

**Structure Decision**: monorepo `backend/`. The clients feature lives
entirely under `backend/app/modules/clients/` plus one alembic revision and
one audit script. The existing module-registry in `backend/app/main.py:18-28`
already mounts the clients router at `/clients`, so no main-app surgery is
needed (mirrors features 002/003).

## Phase 0 → Phase 1 outputs

| Artifact            | Path                                                            | Status       |
| ------------------- | --------------------------------------------------------------- | ------------ |
| Research            | `specs/004-clients-management/research.md`                      | ✅ Complete  |
| Data model          | `specs/004-clients-management/data-model.md`                    | ✅ Complete  |
| HTTP contracts      | `specs/004-clients-management/contracts/openapi.yaml`           | ✅ Complete  |
| Internal contracts  | `specs/004-clients-management/contracts/access-control-matrix.md` | ✅ Complete |
| Quickstart          | `specs/004-clients-management/quickstart.md`                    | ✅ Complete  |
| Spec-quality checklist | `specs/004-clients-management/checklists/requirements.md`    | ✅ Complete  |
| Agent context update| `CLAUDE.md` (preserved manual sections)                         | ⏭️ Skipped — no new tech introduced; the agent file already covers FastAPI/SQLModel/uv/Pydantic/Alembic. |

## Re-evaluated Constitution Check (post-design)

No new violations introduced by Phase 1 design. Specifically:

- The single new alembic revision is forward-compatible: it creates a brand
  new table with no `data_seed`, no migration of existing rows. The
  partial unique indexes use the dialect-prefixed `*_where` kwargs so the
  revision runs cleanly on both Postgres (prod) and SQLite (tests).
- The audit script `audit_clients_imports.sh` reinforces module boundaries
  from the clients-side; it does not introduce a new pattern, only a new
  enforcement point (mirror of `audit_users_imports.sh`).
- Clients imports `auth.schema` for the role `Literal` — explicitly
  permitted (R3, R7). The audit script encodes the rule.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*(none — section intentionally left empty)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Architectural Decision suggestions

The following Phase 1 choices pass the three-part ADR significance test
(long-term impact + multiple alternatives + cross-cutting scope):

1. **Soft-delete via `is_active` boolean (no hard delete endpoint, no
   reactivation endpoint).** Alternatives — tombstone column with timestamp,
   separate `archived_clients` table, hard delete with `ON DELETE SET NULL`
   — were considered and rejected for MVP. Long-term impact: every
   downstream module (`projects`, `payments`) that FKs to `client.id` must
   filter by `is_active` on lookup, and the table never physically loses
   rows.

   📋 Architectural decision detected: clients soft-delete strategy.
   Document reasoning and tradeoffs? Run
   `/sp.adr clients-soft-delete-strategy`.

2. **Uniqueness enforced via partial unique index `WHERE is_active = TRUE`
   on both `email` and `phone`.** Alternatives — plain unique index +
   write-on-delete email rotation, composite `(email, is_active)` unique,
   no DB-level uniqueness — were considered and rejected (R1). Long-term
   impact: a soft-deleted client's email/phone are immediately re-usable; the
   index lives in two engines (SQLite + Postgres) so test/prod parity is
   preserved.

   📋 Architectural decision detected: unique partial index strategy.
   Document reasoning and tradeoffs? Run
   `/sp.adr unique-partial-index-among-active-rows`.

3. **Phone validation via regex (`^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$`); no
   `phonenumbers` library dependency.** Alternative — adopt
   `phonenumbers` for canonical E.164 normalisation — was rejected for MVP
   (R2). Long-term impact: if duplicate-phone collisions surface in
   practice (`+1 415 555 0101` vs `+14155550101`), the upgrade path is a
   single dependency add plus a migration to canonicalise existing rows.

   📋 Architectural decision detected: phone validation strategy.
   Document reasoning and tradeoffs? Run
   `/sp.adr phone-validation-regex-vs-library`.

These are **suggestions only** — no ADR is auto-created. The user may
consent to any, all, or none.

## Stop & Report

Phase 0 (research) and Phase 1 (design + contracts + checklist) are
complete.

- **Branch (target)**: `004-clients-management` (currently authored on
  `003-users-management`; the user opted to defer the branch cut until 003
  is committed).
- **Plan path**: `specs/004-clients-management/plan.md`
- **Generated artifacts**:
  - `specs/004-clients-management/research.md`
  - `specs/004-clients-management/data-model.md`
  - `specs/004-clients-management/contracts/openapi.yaml`
  - `specs/004-clients-management/contracts/access-control-matrix.md`
  - `specs/004-clients-management/quickstart.md`
  - `specs/004-clients-management/checklists/requirements.md`

**Next step**: run `/sp.tasks` to convert this plan into the executable,
dependency-ordered `tasks.md` for the `clients` feature.

# Implementation Plan: Projects Management

**Branch**: `005-projects` | **Date**: 2026-05-04 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/005-projects/spec.md`

## Summary

Stand up the `projects` module: a six-file modular slice that owns two new
SQLModels — `Project` and `ProjectModule` — and exposes ten HTTP endpoints
under `/projects` and `/modules` with the RBAC matrix `admin = full`,
`manager = create + read + update on projects and modules`,
`developer = read assigned + update own progress`. Persist a closed
`Project` shape (13 columns) and `ProjectModule` shape (11 columns) in a
single new alembic revision (`20260504_project`) with foreign keys
`project.client_id → client.id`, `project_module.project_id → project.id`,
`project_module.assigned_developer_id → user.id`, all with
`ON DELETE RESTRICT`. The 70%-cap is a sum constraint enforced at the
service layer (no DB-level cross-row CHECK); the activation gate (sum
must equal 70.00) is the same query with a different comparator. Auto-
completion (`active → completed` when every active module reads 100) is a
single helper invoked from four service-layer write paths. Soft-delete
mirrors clients (feature 004): `is_active = false`, no reactivation. Add
one CI audit script (`audit_projects_imports.sh`) that fails the build if
`projects/**.py` imports business logic from `auth.service`,
`auth.repository`, `users.service`, `payments.*`, or any future module
(FR-027).

**Technical approach** (validated in [`research.md`](./research.md)):

- Six-file modular layout under `backend/app/modules/projects/`. All six
  files exist as empty stubs; this feature **fills** five
  (`model / schema / repository / service / routes`) and leaves
  `dependencies.py` empty (no projects-specific FastAPI Depends() factory
  beyond what `auth.dependencies` already provides).
- New `Project` and `ProjectModule` SQLModels as the single source of
  truth. Future `payments.*` consumes them through FK; this feature does
  not write the FK itself but ensures the PKs are stable.
- Reuse `auth.dependencies.{get_current_user, require_admin, require_any}`
  for authentication / role gates. Per-row visibility (developer-sees-only-
  assigned-projects) and per-row ownership (developer-can-progress-own-
  modules) are **service-layer** concerns because they are data-dependent.
- Cross-module reads only: `clients.repository.get_client_by_id` for FR-005
  (client must be active at write time); `users.repository.get_user_by_id`
  for FR-009 (developer must have `role="developer"` and `is_active=true`).
  Both are read-only; both are explicitly allow-listed in
  `audit_projects_imports.sh`.
- Test surface: SQLite-in-mem `TestClient` with
  `dependency_overrides[get_session]`, reusing the conftest fixtures
  already present (`seed_admin / seed_manager / seed_developer / make_token
  / auth_header`). Three new fixtures added: `seed_client`,
  `seed_project_pending`, `seed_project_active_with_modules`.

## Technical Context

**Language/Version**: Python 3.13.

**Primary Dependencies** (already installed — no additions):

- `fastapi`, `sqlmodel`, `pydantic` v2, `pydantic-settings`,
  `email-validator` (transitive).
- `sqlalchemy` (transitive) — for `ForeignKey(... ondelete="RESTRICT")`,
  `Numeric`, and `CheckConstraint`.
- `alembic` — single new revision `20260504_project`.
- `python-jose`, `passlib[bcrypt]` — **not imported here**; consumed only
  via `auth.dependencies` (preserves SC-006).

**Decimal arithmetic**: standard library `decimal`. The Pydantic v2
schemas declare `Decimal` types; FastAPI serialises them as JSON strings
(R10). The cap-equality and cap-cap comparisons use `Decimal` arithmetic
to avoid float rounding (R1).

**Test deps** (already present): `pytest`, `pytest-asyncio`, `httpx`.

**Storage**: PostgreSQL via `psycopg2-binary` for dev/prod; SQLite in-memory
+ `StaticPool` for tests. Both engines support `Numeric(5,2)`,
`CheckConstraint`, and `ForeignKey(... ondelete="RESTRICT")` per R3 / R8.

**Testing**: `pytest` + FastAPI `TestClient`. Six new test files mapping
1:1 to user stories plus a cross-cutting state-machine file:

- `test_projects_create.py` (US1)
- `test_projects_read.py` (US2 — including developer-visibility filter)
- `test_projects_update.py` (US3 — PATCH + activation gate + status rules)
- `test_modules_crud.py` (US4 — POST/PATCH/DELETE module + share-cap)
- `test_modules_progress.py` (US5 — developer mutation + auto-completion)
- `test_projects_progress.py` (US6 — aggregate; US7 — soft delete + share
  re-use)

**Target Platform**: Linux server (containerised) for prod; Windows 10 +
native Python for dev.

**Project Type**: web-application backend (`backend/`). This feature only
touches `backend/`.

**Performance Goals**: median response time < 200 ms under the SQLite test
fixture (SC-001). Hot paths: cap-check (single SUM query),
activation-gate (same SUM), auto-completion (one COUNT plus one MIN —
both indexed on `project_id` + `is_active`), progress aggregator (one
SELECT). No hashing, no token signing, no external I/O.

**Constraints**:

- **uv-only** for dependency and runtime usage. (Memory entry: "Project:
  progress-tracker uses uv only".)
- **Non-destructive integration**: existing modules (`auth`, `users`,
  `clients`) MUST keep importing cleanly. Files outside `projects/`
  touched by this feature: one alembic revision, one new audit script,
  one one-line `conftest.py` import. **`app/main.py` is unchanged** —
  `projects` is already in `MODULE_REGISTRY` at `/projects`.
- **No business logic in routes**; routes call services only.
- **Six-file layout per module** is mandatory.
- **Module boundaries** (FR-027): `projects` may import only
  `auth.dependencies`, `auth.schema`, `users.repository`, and
  `clients.repository`. The audit script encodes the allow-list.

**Scale/Scope**: ≤ a few thousand projects in the medium term; ≤ a few
tens of thousands of modules. Admin/manager UIs list the full active
table without pagination during MVP. Three RBAC roles: `admin`, `manager`,
`developer`.

## Constitution Check

The constitution at `.specify/memory/constitution.md` is still a template
(no enforced rules). In place of formal gates, this plan is held to the
**default policies** in `CLAUDE.md` and to continuity with the
auth/users/clients plans:

| Default policy                                                    | Status      | Evidence                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smallest viable diff; no unrelated refactors                      | ✅ Pass     | Edits confined to `app/modules/projects/**`, one alembic revision, one new audit script, one conftest line, and the test suite. No edits to `auth`, `users`, `clients`, `core`, or `db`. |
| Don't invent APIs / contracts; clarify if missing                 | ✅ Pass     | All ten endpoints enumerated in spec; contracts in `contracts/openapi.yaml` are 1:1 with US1–US7 acceptance scenarios. Resolved Decisions block in `spec.md` records dual-gate, hybrid status, and soft-delete-on-both. |
| No hardcoded secrets; secrets via `.env`                          | ✅ Pass     | This feature adds zero new secrets. No env-coupled behaviour.                                                                                                            |
| Cite existing code; new code in fences                            | ✅ Pass     | Plan references `backend/app/main.py:18-28` (MODULE_REGISTRY), `backend/app/modules/auth/dependencies.py`, `backend/app/modules/users/repository.py`, `backend/app/modules/clients/repository.py`. |
| Six-file modular layout                                           | ✅ Pass     | All six files exist for `projects/`; this feature fills five and leaves `dependencies.py` empty.                                                                         |
| ADR-0003 spirit (one entity, one module)                          | ✅ Pass     | `Project` and `ProjectModule` SQLModels live only in `projects/model.py`. SC-007 verifies via grep.                                                                      |
| SC-006 (jose only in `core.security`)                             | ✅ Pass     | Projects module imports zero JWT or bcrypt symbols.                                                                                                                      |
| SC-007 (auth imports only `users` among siblings)                 | ✅ Pass     | Direction unchanged. Projects' new audit script (FR-027) backs the reverse direction for projects.                                                                       |

## Project Structure

### Documentation (this feature)

```text
specs/005-projects/
├── spec.md                       # already exists (input)
├── plan.md                       # this file (/sp.plan output)
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   ├── openapi.yaml              # Phase 1 — HTTP contract for the ten /projects + /modules endpoints
│   └── access-control-matrix.md  # Phase 1 — internal RBAC contract
├── checklists/
│   └── requirements.md           # Phase 1 — spec-quality checklist
└── tasks.md                      # Phase 2 output (/sp.tasks)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   └── versions/
│       ├── 20260502_create_user_table.py                       # already exists
│       ├── 20260503_add_is_active_and_updated_at_to_user.py    # already exists
│       ├── 20260504_create_client_table.py                     # already exists (feature 004)
│       └── 20260504_project.py                                 # NEW — Phase 2 task
├── app/
│   ├── main.py                                                 # unchanged — projects router already mounted at /projects
│   ├── core/                                                   # unchanged
│   ├── db/                                                     # unchanged
│   └── modules/
│       ├── auth/                                               # unchanged
│       ├── users/                                              # unchanged
│       ├── clients/                                            # unchanged
│       └── projects/
│           ├── __init__.py                                     # unchanged
│           ├── model.py                                        # IMPLEMENT — Project + ProjectModule SQLModels
│           ├── schema.py                                       # IMPLEMENT — ProjectCreate, ProjectUpdate, ProjectRead, ModuleCreate, ModuleUpdate, ModuleProgressUpdate, ModuleRead, ProjectProgressResponse
│           ├── repository.py                                   # IMPLEMENT — DB-only helpers (insert/get/list/update/soft_delete + sum_active_module_shares + list_active_modules + list_projects_for_user)
│           ├── service.py                                      # IMPLEMENT — typed exceptions + business rules (cap, activation, auto-complete, ownership)
│           ├── routes.py                                       # IMPLEMENT — 10 endpoints
│           └── dependencies.py                                 # unchanged (empty stub — no projects-specific Depends needed)
├── scripts/
│   ├── audit_jose_imports.sh                                   # unchanged
│   ├── audit_auth_imports.sh                                   # unchanged
│   ├── audit_users_imports.sh                                  # unchanged
│   ├── audit_clients_imports.sh                                # unchanged
│   └── audit_projects_imports.sh                               # NEW — FR-027 enforcement
├── tests/
│   ├── conftest.py                                             # ONE-LINE EDIT — import Project, ProjectModule so create_all picks them up
│   ├── test_projects_create.py                                 # NEW — US1
│   ├── test_projects_read.py                                   # NEW — US2 (including developer visibility filter)
│   ├── test_projects_update.py                                 # NEW — US3 (PATCH + activation gate + backwards-transition rejection)
│   ├── test_modules_crud.py                                    # NEW — US4 (POST + PATCH + DELETE module; share-cap; module-on-completed-rejected)
│   ├── test_modules_progress.py                                # NEW — US5 (developer ownership + status derivation + auto-completion)
│   └── test_projects_progress.py                               # NEW — US6 aggregate + US7 soft-delete + share re-use
└── pyproject.toml                                              # unchanged (no new deps)
```

**Structure Decision**: monorepo `backend/`. The projects feature lives
entirely under `backend/app/modules/projects/` plus one alembic revision,
one audit script, one conftest import line, and six test files. The
existing module-registry in `backend/app/main.py:18-28` already mounts the
projects router at `/projects`; **the `/modules` prefix is new** and is
mounted by the same router (the projects module owns both prefixes — they
are two views into the same logical resource and live in the same
`routes.py`).

> **Routing note**: the projects router declares both `/projects` and
> `/modules/{module_id}` operations. To keep `MODULE_REGISTRY` simple
> (`("projects", "/projects", projects.routes.router)`), the router is
> created with `prefix=""` and each handler declares its full path
> (`@router.post("/projects")`, `@router.patch("/modules/{module_id}")`).
> This mirrors how feature 002's `auth/login`, `auth/register`, and
> `auth/me` co-exist on the same router despite different sub-paths.

## Phase 0 → Phase 1 outputs

| Artifact            | Path                                                            | Status       |
| ------------------- | --------------------------------------------------------------- | ------------ |
| Research            | `specs/005-projects/research.md`                                | ✅ Complete  |
| Data model          | `specs/005-projects/data-model.md`                              | ✅ Complete  |
| HTTP contracts      | `specs/005-projects/contracts/openapi.yaml`                     | ✅ Complete  |
| Internal contracts  | `specs/005-projects/contracts/access-control-matrix.md`         | ✅ Complete  |
| Quickstart          | `specs/005-projects/quickstart.md`                              | ✅ Complete  |
| Spec-quality checklist | `specs/005-projects/checklists/requirements.md`              | ✅ Complete  |
| Agent context update| `CLAUDE.md` (preserved manual sections)                         | ⏭️ Skipped — no new tech introduced (Decimal is stdlib). |

## Re-evaluated Constitution Check (post-design)

No new violations introduced by Phase 1 design. Specifically:

- The single new alembic revision is forward-compatible: it creates two
  brand-new tables with no `data_seed`, no migration of existing rows, and
  no edits to the existing `client` / `user` tables. CHECK constraints on
  `progress`, `status`, `share_percentage`, `total_amount`, `end_date >=
  start_date` run on both Postgres and SQLite (R8).
- The audit script `audit_projects_imports.sh` reinforces module
  boundaries from the projects-side. It introduces no new pattern, only a
  new enforcement point (mirror of `audit_clients_imports.sh` with
  per-feature allow-list).
- Cross-module reads (`clients.repository.get_client_by_id`,
  `users.repository.get_user_by_id`) are explicitly permitted in FR-027 and
  are encoded in the audit script's allow-list. They do not import
  business logic — only DB-only helpers.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*(none — section intentionally left empty)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Architectural Decision suggestions

The following Phase 1 choices pass the three-part ADR significance test
(long-term impact + multiple alternatives + cross-cutting scope):

1. **Dual-gate share-cap rule (sum ≤ 70 always; sum == 70 to activate).**
   Alternatives — single cap rule (allow activation under-allocated),
   single equality rule (forbid intermediate states), DB-level cross-row
   trigger — were considered and rejected (R1). Long-term impact: every
   write path on modules must run the cap check; the activation gate
   shares the same query; future restoration / reactivation logic must
   re-evaluate both rules.

   📋 Architectural decision detected: dual-gate share-cap rule.
   Document reasoning and tradeoffs? Run
   `/sp.adr projects-dual-gate-share-cap`.

2. **Hybrid status state machine (manual `pending → active`, automatic
   `active → completed`, no backwards transitions).** Alternatives —
   fully-manual lifecycle, fully-automatic lifecycle, separate
   `lifecycle` resource — were considered and rejected (R2). Long-term
   impact: clients of the API never request `completed`; auto-completion
   fires from four write paths (`POST module`, `PATCH module`,
   `PATCH module progress`, `DELETE module`); the `_maybe_autocomplete`
   helper is the single source of truth.

   📋 Architectural decision detected: hybrid project lifecycle.
   Document reasoning and tradeoffs? Run
   `/sp.adr projects-hybrid-lifecycle`.

3. **Decimal-as-string on the wire for `total_amount`, `share_percentage`,
   `company_share`, `developer_share`.** Alternative — JSON `number` (IEEE
   754) — was rejected because the cap-equality check (`sum == 70.00`) is
   intolerant of float rounding and money values are intolerant of any
   precision loss. Long-term impact: every consumer (frontend, future
   payments module, third-party integrations) must parse strings, not
   numbers; OpenAPI declares these fields as `type: string` with examples.

   📋 Architectural decision detected: Decimal-as-string serialisation.
   Document reasoning and tradeoffs? Run
   `/sp.adr projects-decimal-as-string`.

4. **Service-layer ownership check for developer progress writes (vs
   middleware / `Depends` factory).** Alternative — a
   `Depends(require_module_owner)` factory — was rejected because the
   check is data-dependent (it requires reading the module row first). A
   `Depends` would either re-read the row (doubling DB I/O) or take the
   module id from the path and bypass the canonical service helper.
   Long-term impact: the rule lives in `update_module_progress` and is
   tested against six role × ownership combinations.

   📋 Architectural decision detected: data-dependent ownership check
   placement. Document reasoning and tradeoffs? Run
   `/sp.adr projects-ownership-check-in-service`.

These are **suggestions only** — no ADR is auto-created. The user may
consent to any, all, or none.

## Stop & Report

Phase 0 (research) and Phase 1 (design + contracts + checklist) are
complete.

- **Branch**: `005-projects`.
- **Plan path**: `specs/005-projects/plan.md`
- **Generated artifacts**:
  - `specs/005-projects/research.md`
  - `specs/005-projects/data-model.md`
  - `specs/005-projects/contracts/openapi.yaml`
  - `specs/005-projects/contracts/access-control-matrix.md`
  - `specs/005-projects/quickstart.md`
  - `specs/005-projects/checklists/requirements.md`

**Next step**: run `/sp.tasks` to convert this plan into the executable,
dependency-ordered `tasks.md` for the `projects` feature.

# Implementation Plan: Backend Modular Monolith Project Structure

**Branch**: `001-project-structure` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-structure/spec.md`

## Summary

Establish the canonical, structure-only backend skeleton for the Project Management + Developer Payment Distribution SaaS as a modular monolith. All work is performed inside the existing `backend/` `uv` project — **no reinitialization, no overwriting**. The plan extends the project with `app/` (core, db, shared, modules), nine identical domain modules each with six layer files, a central Alembic environment, and a FastAPI entry point. This phase delivers no business logic, no schema fields, no route handlers, and no migrations — only the skeleton on which every downstream feature will land.

The plan is **strictly additive and idempotent**: each step checks for existence before creating, never overwrites, and leaves any pre-existing developer work intact. Validation is binary at each phase (skeleton imports, server starts, Alembic resolves).

## Technical Context

**Language/Version**: Python 3.13+ (constitution-locked; pyproject already specifies `>=3.13`)
**Primary Dependencies**: FastAPI, Uvicorn[standard], SQLModel, Alembic, Pydantic v2, Pydantic-Settings, python-dotenv, psycopg2-binary, asyncpg, passlib[bcrypt], python-jose[cryptography], argon2-cffi, python-multipart — **all already present in `backend/pyproject.toml`** (verified 2026-05-01). Phase 1 of the plan therefore performs a **dependency audit only** and adds nothing.
**Storage**: PostgreSQL 15+ via SQLModel; Alembic for migrations. Connection string sourced from `.env` (`DATABASE_URL`).
**Testing**: pytest (deferred — added in a later feature; this feature only requires an import-smoke verification).
**Target Platform**: Linux/macOS/Windows developer workstations + Linux production. Cross-platform path handling via `pathlib`.
**Project Type**: Web application (modular monolith backend). The repo's `frontend/` folder is out of scope.
**Performance Goals**: `uvicorn app.main:app` cold-starts in < 3 s; `/docs` returns HTTP 200 (per spec SC-002).
**Constraints**: Strictly additive — no destructive operations, no overwrites, no deletions. Backwards compatible with the existing `backend/main.py` Hello-World (which will be **superseded by** `app/main.py` but **not deleted** in this phase to honor the "do not delete existing working code" constraint).
**Scale/Scope**: Single backend service; 9 domain modules; ~70 placeholder Python files generated; 1 Alembic environment.

## Constitution Check

Active constitution: `/sp.constitution v1.0` (declared in-conversation; the `.specify/memory/constitution.md` file is the unfilled template and is not yet authoritative).

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitutional Rule | Compliance | Notes |
|---|---|---|
| Workflow stages (specify → plan → tasks → implement) | ✅ PASS | Spec authored in `/sp.specify`; this is `/sp.plan`. |
| Spec exists & is complete (endpoints, schemas, business rules) | ✅ PASS | Spec is structural; "endpoints/schemas/business rules" are explicitly out of scope for this feature, declared in spec § Out of Scope and FR-022/023. |
| Python 3.13+, fully type-hinted | ✅ PASS | `requires-python = ">=3.13"`; all generated placeholder files will have type-correct stubs (or no executable code). |
| FastAPI (one APIRouter per module) | ✅ PASS | Each module's `routes.py` exposes an empty `APIRouter` instance (FR-014). |
| SQLModel ORM | ✅ PASS | Reserved as the ORM; no models declared in this phase. |
| Pydantic v2 strict | ✅ PASS | `pydantic-settings` already installed; no schema bodies in this phase. |
| PostgreSQL + Alembic | ✅ PASS | Alembic env created in this phase, bound to central metadata. |
| `uv` only, deterministic lockfile | ✅ PASS | `uv.lock` already present; we will not run `uv add` unless deps are missing (audit confirms none are). |
| Uvicorn production worker config | ⚠️ DEFERRED | Production worker tuning belongs to deployment spec; this phase only requires `uvicorn app.main:app` to start. Acceptable per spec scope. |
| Module structure: model.py / schema.py / service.py / routes.py / repository.py | ✅ PASS | FR-011 enforces all six files (constitution lists five but spec adds `dependencies.py` for per-module DI; see Complexity Tracking). |
| 9 domains: auth/users/clients/projects/modules_tasks/developers/payments/reporting/notifications | ✅ PASS | FR-010. |
| No business logic in routes/models | ✅ PASS | This phase generates no business logic anywhere (FR-022). |
| No cross-module business imports | ✅ PASS | No imports between modules in this phase (FR-023). |
| No float arithmetic for financial values | ✅ PASS | No financial code in this phase; `app/shared/decimal_utils.py` placeholder reserved as the only legal home (FR-024). |
| Frontend work blocked until backend contracts stabilize | ✅ PASS | Frontend untouched. |
| JWT on all routes / RBAC | ⚠️ DEFERRED | No routes exist yet. Auth wiring belongs to the `auth` module spec. The skeleton's empty routers do not violate this rule because they expose no endpoints. |
| Manual code commit bypassing pipeline | ✅ PASS | All work performed under `/sp.plan` after `/sp.specify`. |

**Result**: PASS with two documented deferrals (Uvicorn worker tuning, JWT/RBAC). Both are out of scope per spec and constitution; neither blocks Phase 0.

### Post-Phase-1 Re-check

Re-evaluated after research.md, data-model.md, contracts/, and quickstart.md drafted: still PASS. No new violations introduced. The `dependencies.py` per-module file is the only addition beyond the constitution's five-file pattern; it is documented in Complexity Tracking and does not violate any rule (it is a layer for FastAPI `Depends()` factories, not business logic).

## Project Structure

### Documentation (this feature)

```text
specs/001-project-structure/
├── plan.md              # This file (/sp.plan output)
├── spec.md              # /sp.specify output
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command) — structural entities only, no fields
├── quickstart.md        # Phase 1 output (this command)
├── contracts/
│   └── module-layer-contract.md  # Phase 1 output: per-layer responsibilities & interface stubs
├── checklists/
│   └── requirements.md  # /sp.specify output (already passing)
└── tasks.md             # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

The skeleton lives entirely under `backend/`. Existing files (`main.py`, `pyproject.toml`, `uv.lock`, `.env`, `.gitignore`, `README.md`, `.python-version`, `.venv/`) are preserved unchanged.

```text
backend/
├── app/                          # NEW — application package
│   ├── __init__.py
│   ├── main.py                   # FastAPI entry point (replaces dev role of backend/main.py going forward)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py             # pydantic-settings Settings class (placeholder)
│   │   └── security.py           # JWT/password primitives (placeholder)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py            # engine + SessionLocal factory (placeholder)
│   │   └── base.py               # SQLModel metadata aggregation point (placeholder)
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── utils.py              # cross-cutting helpers (placeholder)
│   │   ├── constants.py          # cross-cutting constants (placeholder)
│   │   └── decimal_utils.py      # the ONLY home for financial decimal helpers (placeholder)
│   └── modules/
│       ├── __init__.py
│       ├── auth/                 # 9 sibling domain modules, identical layout
│       ├── users/
│       ├── clients/
│       ├── projects/
│       ├── modules_tasks/
│       ├── developers/
│       ├── payments/
│       ├── reporting/
│       └── notifications/
│           ├── __init__.py
│           ├── model.py          # SQLModel tables only (empty)
│           ├── schema.py         # Pydantic v2 request/response (empty)
│           ├── service.py        # business logic (empty)
│           ├── repository.py     # DB queries (empty)
│           ├── routes.py         # APIRouter instance — empty router
│           └── dependencies.py   # FastAPI Depends() factories (empty)
├── alembic/                      # NEW — single migration environment
│   ├── env.py                    # imports metadata from app.db.base only
│   ├── script.py.mako
│   └── versions/                 # empty until first feature migration
├── alembic.ini                   # NEW — points to backend/alembic
├── main.py                       # PRESERVED (existing Hello-World; not deleted)
├── pyproject.toml                # PRESERVED
├── uv.lock                       # PRESERVED
├── .env                          # PRESERVED (extend with DATABASE_URL guidance only — no secrets)
├── .env.example                  # NEW — template showing required keys (no real values)
├── .gitignore                    # PRESERVED
├── .python-version               # PRESERVED
├── README.md                     # PRESERVED (may be augmented in tasks phase, not in plan)
└── .venv/                        # PRESERVED
```

**Structure Decision**: Modular monolith under `backend/app/` with three flat top-level packages (`core/`, `db/`, `shared/`) and one container package (`modules/`) holding nine sibling domain folders, each with the identical six-layer file set. Alembic lives at `backend/alembic/` (sibling to `app/`) so the migration environment is independent of the application package and can import metadata via `from app.db.base import metadata`. The pre-existing `backend/main.py` is preserved (not deleted) per the "do not delete existing code" constraint; it is decoupled from the runtime — the FastAPI entry point is `app.main:app`.

## Phase 0 — Outline & Research

See [research.md](./research.md). Decisions resolved:

1. **PostgreSQL driver choice (psycopg2-binary vs. asyncpg)** — both present; sync `psycopg2-binary` is the default for SQLModel synchronous sessions and Alembic; `asyncpg` reserved for any async-only paths. **Decision: keep both; default sync via SQLModel.**
2. **Alembic location** — `backend/alembic/` (sibling to `app/`). **Decision: confirmed**.
3. **Module URL prefix slug for `modules_tasks`** — slugify to `/modules-tasks`. **Decision: confirmed; data-driven registry maps `modules_tasks → "modules-tasks"`**.
4. **Per-module `dependencies.py` (deviation from constitution's 5-file list)** — kept; FastAPI DI requires a per-module home. **Decision: confirmed; documented in Complexity Tracking.**
5. **Settings management** — `pydantic-settings` BaseSettings reading `.env` via `python-dotenv` autoload. **Decision: pydantic-settings.**
6. **Preserve vs. replace `backend/main.py`** — preserve untouched; runtime entry is `app.main:app`. **Decision: preserve.**

No `[NEEDS CLARIFICATION]` markers remain.

## Phase 1 — Design & Contracts

### Data Model

See [data-model.md](./data-model.md). **No data entities** are introduced in this feature (structural skeleton only). The document instead enumerates the *structural entities* (packages, layer files, registry) and their relationships, plus the metadata-aggregation contract that every future module's `model.py` must satisfy when it begins declaring tables.

### Contracts

See [contracts/module-layer-contract.md](./contracts/module-layer-contract.md). This feature exposes **no HTTP endpoints**. The "contract" delivered is the **layer contract**: for each of the six per-module files, what it owns, what it must export, and what it must never contain. Downstream feature specs will generate OpenAPI contracts module-by-module.

### Quickstart

See [quickstart.md](./quickstart.md). Walks a new contributor from `git clone` through `uv sync` → `uvicorn app.main:app --reload` → `/docs` in under 5 minutes (per SC-001).

### Agent Context Update

To be run after this plan is committed:

```powershell
.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude
```

This regenerates `CLAUDE.md` with current technology choices (FastAPI, SQLModel, Alembic, etc.) preserving manual sections between markers.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Per-module `dependencies.py` (constitution lists only 5 layer files: model/schema/service/routes/repository) | FastAPI dependency-injection factories (`Depends(...)` for DB sessions, current user, RBAC role checks) need a per-module home that is not `routes.py` (which the constitution restricts to routing only) and not `service.py` (business logic). Bundling them into `routes.py` would push DI wiring into a routing-only file, blurring the layer line. | Putting DI in `routes.py` — rejected: violates "routes.py is routing only". Putting DI in a single shared `app/shared/dependencies.py` — rejected: per-module RBAC checks and module-specific session scoping want module-local visibility, and a shared file becomes a god-module. |
| Preserving `backend/main.py` (Hello-World) alongside `backend/app/main.py` | Constitution forbids deleting existing working code without spec approval; spec FR explicitly preserves it. | Deleting it — rejected: violates "do not delete existing working code". The file is unreferenced by the FastAPI app and costs nothing to keep; it can be removed in a later cleanup feature with explicit consent. |
| `app/shared/decimal_utils.py` introduced at skeleton phase even though no financial code exists yet | The constitution forbids float arithmetic for financial values and forbids per-module decimal helpers. Reserving the canonical home now prevents the first contributor reaching for `Decimal` from inventing a parallel home in `payments/`. | Waiting until the `payments` spec to create it — rejected: by then a parallel helper may already exist in another module, violating FR-024. The cost of an empty placeholder file is negligible. |

## Architectural Decision Note

📋 Architectural decision detected: **Modular monolith with per-module 6-file layer contract, central Alembic env, data-driven router registry, and shared decimal utilities as the sole financial-helper home.** Document reasoning and tradeoffs? Run `/sp.adr modular-monolith-skeleton`.

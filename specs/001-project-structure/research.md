# Research: Backend Modular Monolith Project Structure

**Feature**: 001-project-structure
**Date**: 2026-05-01
**Status**: Complete — all unknowns resolved

This document records the design decisions taken in Phase 0 of `/sp.plan`. Each entry follows the **Decision / Rationale / Alternatives** format required by the SDD workflow.

---

## R1. PostgreSQL driver — `psycopg2-binary` vs `asyncpg`

**Context**: Both drivers are already pinned in `backend/pyproject.toml`. SQLModel's primary surface is synchronous; FastAPI is happy in either mode. We must pick one as the *default* for the skeleton's `engine` placeholder so that downstream contributors don't fragment the choice.

**Decision**: Default to **synchronous SQLModel sessions backed by `psycopg2-binary`**. `asyncpg` remains installed and available for narrow, well-justified async paths (e.g., a future high-throughput webhook ingester) but the engine factory in `app/db/session.py` will be sync.

**Rationale**:

- Alembic is synchronous; using a sync engine for the application matches the migration tooling and avoids the well-known async-Alembic ergonomics pain.
- The constitution mandates SQLModel and does not mandate async; YAGNI says don't pay async complexity tax until a real workload requires it.
- Financial ledger code (which the constitution treats as critical) is far easier to reason about in sync code with explicit transactions.
- Both drivers are already paid for in dependencies, so reversing the default later is a one-engine-factory change.

**Alternatives considered**:

- *Async-first (`asyncpg` + `AsyncSession`)*: rejected — forces every service-layer call to be `async def`, complicates Alembic, and offers no measurable win at current expected scale.
- *Drop one driver*: rejected — leaving both installed is cheap, and removing now constrains future choices unnecessarily.

---

## R2. Alembic location

**Context**: Two conventional placements exist: `backend/alembic/` (sibling to `app/`) or `backend/app/alembic/` (inside the application package).

**Decision**: **`backend/alembic/`** sibling to `app/`, with `alembic.ini` at `backend/alembic.ini`.

**Rationale**:

- Migrations are an operational concern and belong outside the importable application package so they don't accidentally get bundled or imported at app startup.
- `env.py` imports from the app (`from app.db.base import metadata`), so the dependency arrow points cleanly outward (operational → application), never inward.
- Standard FastAPI/SQLModel community layouts use this placement; new contributors find it without surprise.

**Alternatives considered**:

- *`backend/app/alembic/`*: rejected — couples migrations to the package; risks circular imports when `env.py` and app modules grow.
- *`migrations/` at repo root*: rejected — the repo holds both backend and frontend; placing migrations at the root blurs the `backend/` boundary.

---

## R3. URL prefix for `modules_tasks`

**Context**: Python package names use underscores (`modules_tasks`); URL paths conventionally use hyphens. We need a single deterministic mapping rule used by the data-driven router registry.

**Decision**: **Slugify by replacing `_` with `-`**. `modules_tasks` → `/modules-tasks`. All other modules already have hyphen-free names, so the rule is a no-op for them.

**Rationale**:

- Hyphenated URLs are a long-standing web convention (more readable, friendlier to URL parsers).
- A single deterministic transform avoids per-module override tables.
- The transform is reversible and trivial to inspect.

**Alternatives considered**:

- *Match the package name verbatim (`/modules_tasks`)*: rejected — inconsistent with web conventions; underscores in URLs are a code smell.
- *Per-module override table mapping `modules_tasks → "tasks"` (or any other custom name)*: rejected — invites bikeshedding and breaks the "data-driven from folder name" rule.

---

## R4. Per-module `dependencies.py`

**Context**: The constitution lists five per-module layer files (model / schema / service / routes / repository). The spec adds a sixth: `dependencies.py`. We must justify the deviation or remove it.

**Decision**: **Keep `dependencies.py` per module.** It owns FastAPI `Depends(...)` factories scoped to the module: e.g., `get_current_developer`, `require_admin`, module-local DB session wrappers, RBAC enforcement helpers.

**Rationale**:

- FastAPI's idiom for authn/authz and resource-resolution wiring is the dependency injection system. Those factories must live somewhere.
- They are not business logic (so not `service.py`); they are not routing (so not `routes.py`); they are not DB queries (so not `repository.py`). A dedicated layer file is the cleanest fit.
- Without `dependencies.py`, contributors will inevitably scatter `Depends(...)` factories into `routes.py`, blurring the layer contract the constitution is trying to enforce.
- The cost of one extra placeholder file per module is trivial; the cost of layer-contract erosion is large.

**Alternatives considered**:

- *Put dependency factories in `routes.py`*: rejected — violates "routing only".
- *Put them in `app/shared/dependencies.py`*: rejected — module-local RBAC and resource resolution want module-local visibility; a shared file becomes a god-module that every route imports.
- *Put them in `service.py`*: rejected — `service.py` is the only constitutional home for business logic; mixing DI factories there blurs the line.

This deviation is recorded in `plan.md` § Complexity Tracking.

---

## R5. Settings management

**Context**: Need a single, type-checked settings surface backed by `.env` and environment variables.

**Decision**: **`pydantic-settings.BaseSettings`** subclass in `app/core/config.py`, loaded once at app startup and cached as a module-level singleton via `@lru_cache`. `python-dotenv` (already installed) auto-loads `.env` early.

**Rationale**:

- `pydantic-settings` is the official Pydantic v2 settings library; matches the constitution's "Pydantic v2 strict" mandate.
- Singleton via `@lru_cache(maxsize=1)` is the FastAPI-idiomatic pattern.
- Type checking catches misconfigured environments at app startup, not at first request.

**Alternatives considered**:

- *Hand-rolled `os.getenv()` reads*: rejected — no validation, no typing, scattered.
- *Dynaconf / Hydra*: rejected — heavy for a backend microservice; constitution doesn't allow them.

---

## R6. Preserve or replace `backend/main.py`

**Context**: An existing `backend/main.py` contains `print("Hello from backend!")`. The spec's runtime entry point is `app/main.py`.

**Decision**: **Preserve `backend/main.py` untouched.** Runtime entry becomes `app.main:app`. The Hello-World file is decoupled from the FastAPI app and has no callers; it can be removed in a future cleanup feature with explicit user consent.

**Rationale**:

- Constitution and spec both forbid deleting existing working code in this phase.
- The file imports nothing from `app/`, so its presence has zero runtime effect.
- Removal can be re-litigated cheaply later when context is clearer.

**Alternatives considered**:

- *Replace with a thin `from app.main import app` shim*: tempting but rejected — it would change the file's behavior (it would no longer print "Hello from backend!"), which counts as overwriting working code under a strict reading of the constraint. Defer.
- *Delete it now*: rejected — violates "do not delete existing working code".

---

## R7. Empty `.env` extension policy

**Context**: `backend/.env` exists but is empty. The skeleton's settings layer needs a `DATABASE_URL` (and a few other keys) to be useful.

**Decision**: **Do not modify `.env` itself.** Create `backend/.env.example` documenting the required keys (`DATABASE_URL`, `JWT_SECRET_KEY`, `ENVIRONMENT`) with placeholder values. Contributors copy `.env.example` → `.env` locally. `.env` remains git-ignored.

**Rationale**:

- `.env` is a developer-local artifact and is git-ignored. Writing to it from the skeleton phase risks clobbering local secrets; users may have already populated it.
- `.env.example` is the standard "what does this app need to run" contract.
- Keeps secrets out of version control by construction.

**Alternatives considered**:

- *Auto-populate `.env`*: rejected — destructive to any existing local config.
- *Document only in README*: rejected — drifts from the actual variable list; `.env.example` is checked by tooling.

---

## R8. Module router registration mechanism

**Context**: SC-005 requires that adding a tenth module touches at most two files outside the new module folder. The mechanism must be data-driven.

**Decision**: A **module registry** (a tuple of `(package_name, url_prefix)` pairs) lives in `app/main.py` (or a dedicated `app/modules/__init__.py`). At startup, the app iterates the registry, dynamically imports each module's `routes.py`, and `app.include_router(...)` with the prefix.

**Rationale**:

- One registry file = one place to add a tenth module.
- Dynamic import is contained (only at startup, only by package name); no plugin discovery magic.
- Ordering of inclusion is explicit and reviewable.

**Alternatives considered**:

- *Plugin auto-discovery (walk `app/modules/`)*: rejected — surprising at debugging time; failure modes are subtle.
- *Hand-written `app.include_router` per module*: rejected — violates the data-driven success criterion.

---

## Outcome

All eight research questions are resolved with concrete decisions. The plan can proceed to Phase 1 (data model, contracts, quickstart) without unresolved ambiguity.

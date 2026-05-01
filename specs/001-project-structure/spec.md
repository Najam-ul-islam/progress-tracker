# Feature Specification: Backend Modular Monolith Project Structure

**Feature Branch**: `001-project-structure`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "Define the complete backend folder structure for a modular monolith SaaS system (FastAPI + SQLModel + PostgreSQL + Alembic + Uvicorn). Each domain module isolated under `app/modules/<domain>/` with `model.py`, `schema.py`, `service.py`, `repository.py`, `routes.py`, `dependencies.py`. Central DB config in `db/`, shared utilities in `shared/`, core configs in `core/`, `main.py` as FastAPI entry point. Structure only — no business logic."

## Overview

This feature establishes the **canonical backend skeleton** for the Project Management + Developer Payment Distribution SaaS. It is a **structure-only deliverable**: all directories, package markers, and per-module boilerplate files exist, but contain no business logic, no route handlers, no models, no migrations, and no service implementations. The skeleton makes the modular-monolith contract physically enforceable: every domain looks identical, every layer has exactly one home, and any future feature can be located by inspection alone.

This is a foundational scaffold that all downstream feature specs (auth, users, clients, projects, modules_tasks, developers, payments, reporting, notifications) will build on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Engineer Bootstraps the Project (Priority: P1)

A backend engineer joining the project clones the repository, navigates to `backend/`, runs `uv sync`, then `uvicorn app.main:app --reload`, and the server starts successfully on the configured port and serves the FastAPI auto-generated `/docs` page (with zero registered domain endpoints). The skeleton compiles, imports cleanly, and presents a navigable module tree.

**Why this priority**: Without a runnable skeleton, no other feature work can begin. Every subsequent module (auth, users, payments, etc.) depends on these directories and entry-point wiring existing.

**Independent Test**: Fresh clone → `uv sync` → `uvicorn app.main:app` → HTTP GET `/docs` returns 200 and renders the OpenAPI UI. No endpoints listed beyond FastAPI defaults. No import errors logged.

**Acceptance Scenarios**:

1. **Given** a fresh checkout of the repository, **When** the engineer runs `uv sync` inside `backend/`, **Then** all dependencies install without errors and a lockfile is present.
2. **Given** dependencies are installed, **When** the engineer runs `uvicorn app.main:app --reload`, **Then** the server starts and `/docs` is reachable.
3. **Given** the server is running, **When** the engineer inspects `app/modules/`, **Then** all nine domain folders exist and each contains the six required files plus `__init__.py`.

---

### User Story 2 - Feature Author Locates Where Code Belongs (Priority: P1)

A feature author opens any module folder (e.g., `app/modules/payments/`) and immediately finds the same six files (`model.py`, `schema.py`, `service.py`, `repository.py`, `routes.py`, `dependencies.py`) in the same roles. The author can place new code without ambiguity: tables go in `model.py`, request/response shapes in `schema.py`, business logic in `service.py`, DB queries in `repository.py`, route definitions in `routes.py`, and per-module DI wiring in `dependencies.py`.

**Why this priority**: The constitution forbids business logic in routes/models and forbids cross-module business imports. Enforcing this requires the structural contract to be visible and identical across every module.

**Independent Test**: Pick any two modules at random; their file lists are identical (names and count). Each file's docstring or header comment names the layer's responsibility.

**Acceptance Scenarios**:

1. **Given** the skeleton is generated, **When** an engineer compares any two module directories, **Then** their file names and counts are identical.
2. **Given** a module folder is opened, **When** an engineer reads each file's top-of-file marker, **Then** the layer responsibility is unambiguously stated.

---

### User Story 3 - Platform Operator Configures Database & Settings (Priority: P2)

A platform operator can locate exactly one place for database connection configuration (`app/db/`), exactly one place for application settings (`app/core/`), and exactly one place for cross-cutting utilities (`app/shared/`). Migration tooling (Alembic) is wired against the central database config — not duplicated per module.

**Why this priority**: Centralised configuration prevents drift, makes secret rotation safe, and ensures Alembic operates on a single metadata source — a hard requirement for the financial ledger guarantees defined in the constitution.

**Independent Test**: There is exactly one `Settings` class location, exactly one engine/session factory location, and exactly one Alembic `env.py`. Grep confirms no duplicates.

**Acceptance Scenarios**:

1. **Given** the skeleton, **When** the operator searches for database engine setup, **Then** it appears in `app/db/` only.
2. **Given** the skeleton, **When** the operator searches for environment-driven settings, **Then** they appear in `app/core/` only.
3. **Given** Alembic is initialised, **When** the operator runs `alembic current`, **Then** the command resolves successfully against the central DB config (no migrations yet — empty history is acceptable).

---

### Edge Cases

- **Empty modules at startup**: `main.py` must not fail when a module's `routes.py` defines no endpoints. Empty routers are valid and must be tolerated.
- **Module discovery**: If a future module is added, the registration pattern must be obvious from existing examples. The skeleton must not hard-code a closed list that silently drops new modules.
- **Cross-module imports**: The structure must make accidental cross-module business-logic imports easy to spot in code review (e.g., a `payments` route importing `clients/services.py` is a red flag the layout exposes by name).
- **Naming conflict — `modules` package vs. `modules_tasks` domain**: The Python package name `modules` (containing all domains) and the domain folder `modules_tasks` (project sub-modules belonging to a project) must coexist without ambiguity. Folder/file names must be chosen so neither shadows the other.
- **Windows path handling**: All paths must use forward slashes in code and config; no hard-coded backslashes. The skeleton must build and run on Windows, macOS, and Linux.
- **`uv` lockfile already exists**: The skeleton must not regenerate or invalidate the existing `uv` project; it adds dependencies in-place.

## Requirements *(mandatory)*

### Functional Requirements

#### Top-level layout

- **FR-001**: The repository MUST contain a `backend/app/` package as the root Python application namespace.
- **FR-002**: `backend/app/main.py` MUST exist and define the FastAPI application instance suitable for `uvicorn app.main:app`.
- **FR-003**: `backend/app/__init__.py` MUST exist; every directory under `app/` that holds Python files MUST contain an `__init__.py` so it is importable as a package.
- **FR-004**: The skeleton MUST live entirely under the existing `backend/` folder and MUST NOT create a parallel project root.

#### Core, db, shared

- **FR-005**: `app/core/` MUST exist and hold cross-cutting application configuration concerns (settings loading, logging configuration, security primitives placeholders). It MUST contain placeholder files only — no implementations.
- **FR-006**: `app/db/` MUST exist and hold the single source of truth for database connectivity (engine factory placeholder, session factory placeholder, base metadata placeholder, Alembic integration point).
- **FR-007**: `app/shared/` MUST exist and hold cross-cutting utilities reusable by every module (e.g., common exception types, pagination helpers, decimal helpers — placeholders only).
- **FR-008**: There MUST be exactly one location each for: settings, database engine/session, Alembic migration environment.

#### Modules

- **FR-009**: `app/modules/` MUST exist as the parent package for all domain modules.
- **FR-010**: Exactly nine domain modules MUST exist as direct children of `app/modules/`: `auth`, `users`, `clients`, `projects`, `modules_tasks`, `developers`, `payments`, `reporting`, `notifications`.
- **FR-011**: Every domain module MUST contain the following files (each as a valid, importable Python file with no business logic): `__init__.py`, `model.py`, `schema.py`, `service.py`, `repository.py`, `routes.py`, `dependencies.py`.
- **FR-012**: Every domain module's file set MUST be identical in name and count — no module may add, omit, or rename layer files.
- **FR-013**: Each layer file MUST carry a top-of-file marker (docstring or comment) declaring its responsibility (e.g., `routes.py`: "HTTP routing only; delegates to services").
- **FR-014**: Each `routes.py` MUST expose an `APIRouter` instance (empty router permitted) so registration in `main.py` is mechanical and uniform.

#### Application wiring

- **FR-015**: `main.py` MUST register every module's router under a predictable URL prefix derived from the module name. The registration mechanism MUST be data-driven (a list/loop) rather than nine hand-written includes, so adding a tenth module is a one-line change.
- **FR-016**: `main.py` MUST attach lifespan/startup hooks for the centralised database session factory (placeholder — no actual connections opened during structural phase, but the hook point MUST exist).
- **FR-017**: The application MUST start successfully with zero registered endpoints beyond FastAPI defaults (`/docs`, `/redoc`, `/openapi.json`).

#### Migrations

- **FR-018**: An `alembic/` directory MUST exist under `backend/` (or `backend/app/` per chosen convention) initialised so `alembic current` and `alembic revision` commands succeed.
- **FR-019**: The Alembic `env.py` MUST import metadata from the central `app/db/` location only — never from a per-module file.

#### Tooling

- **FR-020**: Required runtime dependencies MUST be added to the existing `uv` project: `fastapi`, `uvicorn[standard]`, `sqlmodel`, `alembic`, `psycopg[binary]` (or equivalent PostgreSQL driver), `pydantic-settings`. No business-logic libraries (e.g., payment SDKs, email providers) are added in this phase.
- **FR-021**: `uv sync` MUST succeed on a fresh clone and produce a deterministic lockfile.

#### Constraints

- **FR-022**: No file produced by this feature may contain business logic, database queries, route handler bodies (beyond `pass` or empty routers), or schema field definitions. Files exist as typed shells only.
- **FR-023**: No domain module may import from another domain module in this phase. Cross-module imports are out of scope for the structural skeleton.
- **FR-024**: All financial-related shared helpers (e.g., decimal utilities) MUST be placed in `app/shared/` only; no module may declare its own decimal helpers.

### Key Entities *(structural, not data)*

- **Application Package (`app/`)**: The single Python namespace for the backend. Owns wiring, registration, lifespan.
- **Core (`app/core/`)**: Holder of settings, logging, and security primitives.
- **Database Layer (`app/db/`)**: Single source of truth for DB connectivity and metadata.
- **Shared Layer (`app/shared/`)**: Cross-cutting utilities; the only legal home for code reused across modules.
- **Domain Module (`app/modules/<domain>/`)**: Self-contained vertical slice for one bounded context. Internally layered into model / schema / service / repository / routes / dependencies.
- **Migration Environment (`alembic/`)**: Single Alembic environment bound to the central metadata source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh engineer can clone the repo, run `uv sync`, and start the server within **5 minutes** with zero manual file edits.
- **SC-002**: `uvicorn app.main:app` starts in under **3 seconds** on a developer laptop and serves `/docs` returning HTTP 200.
- **SC-003**: Every one of the nine domain modules contains **exactly the same set of six layer files** (verifiable by automated directory diff).
- **SC-004**: Locating where to place a new piece of code (model vs. schema vs. service vs. repository vs. route vs. dependency) takes a new contributor under **30 seconds** when consulting any module as an example.
- **SC-005**: Adding a tenth domain module requires changes to **at most two files** outside the new module folder itself (the module list in `main.py` and any registration registry) — proving the registration pattern is data-driven.
- **SC-006**: `alembic current` runs successfully against an empty migration history with **zero per-module configuration**.
- **SC-007**: A static check confirms **zero cross-module imports** between `app/modules/<a>/` and `app/modules/<b>/` at the close of this feature.

## Assumptions

- The existing `backend/` folder already contains a valid `uv` project (`pyproject.toml`, `uv.lock`); this feature extends it rather than recreating it.
- PostgreSQL is the only target database; SQLite/MySQL are out of scope.
- Alembic lives at `backend/alembic/` (next to `app/`), which is the conventional placement; teams may move it during planning if rationale is documented.
- Module URL prefixes follow the module folder name (e.g., `/auth`, `/users`, `/modules-tasks`). Slug conversion for the `modules_tasks` underscore-to-hyphen is acceptable and expected.
- All file content in this feature is structural placeholder; no tests beyond an import-smoke test are required at this stage.
- Linting/formatting configuration (ruff, mypy, etc.) is **not** part of this feature; it will be addressed in a separate spec.

## Out of Scope

- Authentication mechanism, JWT issuance, RBAC enforcement (covered by `auth` module spec later).
- Any data model fields, table definitions, or relationships.
- Any route handlers, request/response payloads, or business validations.
- Frontend scaffolding (`frontend/` folder is not modified by this feature).
- CI/CD, Docker, deployment configuration.
- Observability stack (logging format, metrics, tracing).
- Test framework setup (pytest configuration); a single import-smoke verification is acceptable but a full test scaffold is its own feature.

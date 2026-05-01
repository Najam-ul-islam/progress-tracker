# Data Model: Backend Modular Monolith Project Structure

**Feature**: 001-project-structure
**Date**: 2026-05-01

## Status

**No data-domain entities are introduced by this feature.** This is the structural skeleton phase. Tables, fields, relationships, and validation rules are all out of scope and are explicitly deferred to per-module feature specs (e.g., `auth/spec.md`, `users/spec.md`, `payments/spec.md`).

What this document captures is the **structural contract** the skeleton imposes — the package-level "entities" and their dependency relationships — plus the **metadata aggregation contract** that every future `model.py` must satisfy when it begins declaring tables.

---

## Structural Entities

### `app` (Application Package)

| Property | Value |
|---|---|
| Path | `backend/app/` |
| Role | Sole importable namespace for the backend service. |
| Owns | Application wiring, lifespan, router registry. |
| Depends on | `app.core`, `app.db`, `app.modules.*` |
| Imported by | `uvicorn` (entry point `app.main:app`); Alembic `env.py` (for metadata only). |

### `app.core` (Core Package)

| Property | Value |
|---|---|
| Path | `backend/app/core/` |
| Files | `config.py`, `security.py`, `__init__.py` |
| Role | Cross-cutting application configuration: settings (Pydantic-Settings), security primitives (JWT placeholder, password hashing placeholder), logging configuration. |
| Depends on | Standard library, `pydantic-settings`, `python-jose`, `passlib`. **Does not import from `app.modules`, `app.db`, or `app.shared`.** |
| Imported by | `app.main`, `app.db.session` (for DB URL), every module's `dependencies.py` (for `get_settings`, `oauth2_scheme`). |

### `app.db` (Database Layer)

| Property | Value |
|---|---|
| Path | `backend/app/db/` |
| Files | `session.py`, `base.py`, `__init__.py` |
| Role | Single source of truth for DB connectivity and SQLModel metadata. |
| Depends on | `app.core.config` (for `DATABASE_URL`), `sqlmodel`. |
| Imported by | `app.modules.<domain>.repository`, every `model.py` (via `SQLModel` re-export from `base.py`), `alembic/env.py`. |
| Invariant | `app.db.base` is the *only* place metadata is aggregated; `alembic/env.py` imports from here. |

### `app.shared` (Shared Utilities)

| Property | Value |
|---|---|
| Path | `backend/app/shared/` |
| Files | `utils.py`, `constants.py`, `decimal_utils.py`, `__init__.py` |
| Role | Cross-cutting utilities reusable by every module. |
| Depends on | Standard library only (and `decimal`). **Must not import from `app.modules`, `app.db`, or `app.core`.** |
| Imported by | Any module's service/repository layer when it needs decimal helpers, pagination utilities, common exception types, or shared constants. |
| Invariant | `decimal_utils.py` is the *only* legal home for financial decimal helpers (constitution: no float arithmetic for financial values; no per-module decimal helpers). |

### `app.modules` (Modules Container)

| Property | Value |
|---|---|
| Path | `backend/app/modules/` |
| Role | Parent package for all domain modules. Holds the module registry consumed by `app.main`. |
| Children | Exactly nine domain packages (see below). |

### Domain Module (`app.modules.<domain>`)

Nine instances: `auth`, `users`, `clients`, `projects`, `modules_tasks`, `developers`, `payments`, `reporting`, `notifications`. Each is structurally identical:

| File | Role | Must export |
|---|---|---|
| `__init__.py` | Package marker. | (nothing required) |
| `model.py` | SQLModel table definitions only. | (in future) classes inheriting `SQLModel, table=True` registered against `app.db.base.metadata`. |
| `schema.py` | Pydantic v2 request/response shapes. | (in future) `*Create`, `*Read`, `*Update` BaseModel subclasses. |
| `service.py` | All business logic for the domain. | (in future) callable service functions or a service class — *the only legal home for domain rules*. |
| `repository.py` | All database queries. | (in future) functions returning models / scalars; receive a session as parameter. |
| `routes.py` | HTTP routing only; delegates to services. | An `APIRouter` instance (empty in this phase). The instance MUST be named `router` for the registry to discover it. |
| `dependencies.py` | FastAPI `Depends()` factories. | (in future) factories like `get_current_developer`, `require_admin`. |

**Cross-module rule (constitutional)**: No module may import from another module's `service.py`, `repository.py`, or `model.py`. Cross-module data exchange happens via `schema.py` re-exports through a deliberate import path documented in a future spec; in this phase, no such imports exist.

### Module Registry

| Property | Value |
|---|---|
| Location | `app/main.py` (data-driven list); optionally extracted to `app/modules/__init__.py` if it grows. |
| Shape | `tuple[tuple[str, str], ...]` of `(package_name, url_prefix)` pairs. |
| Example entries | `("auth", "/auth")`, `("modules_tasks", "/modules-tasks")`, `("payments", "/payments")`. |
| Consumed by | `app.main` startup logic that imports each module and registers its `router` under its prefix. |
| Mutation rule | Adding a 10th module = appending one tuple. No other code outside the new module folder changes. |

### Migration Environment

| Property | Value |
|---|---|
| Path | `backend/alembic/` (config: `backend/alembic.ini`) |
| Role | Single Alembic environment for the whole application. |
| Metadata source | `from app.db.base import metadata` — *the only import allowed from inside Alembic into the app*. |
| Initial state | No migration revisions; `alembic current` returns empty. |

---

## Dependency Graph (allowed imports)

```text
            ┌─────────────────┐
            │   app.main      │
            └───────┬─────────┘
                    │ imports
                    ▼
   ┌────────────────┼────────────────┐
   │                │                │
   ▼                ▼                ▼
┌──────┐       ┌─────────┐      ┌────────────────┐
│ core │       │   db    │      │  modules.*     │
└──┬───┘       └────┬────┘      └────────┬───────┘
   │                │                    │
   │                │                    │ each module's:
   │                │                    │   model.py    -> db.base
   │                │                    │   repository  -> db.session
   │                │                    │   service     -> repository, schema, shared
   │                │                    │   routes      -> service, schema, dependencies
   │                │                    │   dependencies-> core, db.session
   │                │                    │
   │           ┌────┴──────┐              │
   └──────────►│ pydantic  │              │
               │ settings  │              │
               └───────────┘              │
                                          ▼
                                     ┌─────────┐
                                     │ shared  │  (utils, constants, decimal_utils)
                                     └─────────┘
                                          ▲
                                          │
                                  imported by service / repository
                                  of any module that needs decimal/utility helpers
```

**Forbidden edges** (enforceable by static check in a future feature):

- `modules.<a>` → `modules.<b>` (any direction, any layer)
- `core` → `modules.*`, `core` → `db`, `core` → `shared`
- `shared` → `modules.*`, `shared` → `db`, `shared` → `core`
- `db` → `modules.*`, `db` → `shared`
- Any layer → `routes.py` of another file (routes are leaves)

---

## Metadata Aggregation Contract

When a future module's `model.py` begins to declare tables:

1. It must `from app.db.base import SQLModel` (re-exported) so the table is registered against the central metadata.
2. It must NOT create its own `MetaData()` instance.
3. The module's `model.py` must be imported (transitively) by `app/db/base.py` so Alembic autogenerate can see it. The base file maintains a one-line import per module that declares tables — this is the *only* place where the central layer touches modules, and it is justified by Alembic's autogenerate requirement.

In this phase, `app/db/base.py` re-exports `SQLModel` and declares an empty `metadata = SQLModel.metadata` reference. Module-table imports are added incrementally, one per future feature.

---

## State Transitions

Not applicable — no stateful entities in this phase.

## Validation Rules

Not applicable — no domain data.

## Acceptance for this Document

This data-model passes if:

- No table, field, or domain relationship is declared.
- The structural-entity table is complete (5 top-level + 9 modules + 1 registry + 1 migration env).
- The dependency graph is internally consistent (no cycles, no forbidden edges).
- The metadata aggregation contract is unambiguous about *where* future modules plug in.

All four hold. ✅

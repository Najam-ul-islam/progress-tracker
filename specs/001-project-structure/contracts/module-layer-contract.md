# Layer Contract: Per-Module Six-File Structure

**Feature**: 001-project-structure
**Date**: 2026-05-01
**Status**: Authoritative — every domain module under `app/modules/` MUST conform.

## Why "Layer Contract" instead of an OpenAPI Contract?

This feature exposes **zero HTTP endpoints**. The deliverable is a structural skeleton, not a service. The "contract" the skeleton must satisfy is therefore the contract between the **layer files inside each module**: which file owns what, what each file must export, and what each file must never contain. Downstream feature specs (auth, users, payments, …) will produce real OpenAPI contracts module-by-module.

This document is the source of truth that future PR reviewers consult when judging "does this PR put code in the right place?"

---

## The Six Files

Every module under `app/modules/<domain>/` MUST contain these files, in this order, with these responsibilities:

### 1. `__init__.py`

**Owns**: Python package marker.
**Must export**: nothing required.
**Must NOT contain**: any executable code beyond `__all__` declarations.

### 2. `model.py`

**Owns**: SQLModel table definitions for this domain.
**Must export** (in future, when the module declares tables): one or more classes inheriting `SQLModel, table=True`.
**Must contain only**: table classes, table-level constraints, enum types used as column types, foreign-key relationships.
**Must NOT contain**:
- Pydantic request/response schemas (those go in `schema.py`).
- Business logic (validation beyond column constraints; computations; rules).
- Database queries (those go in `repository.py`).
- HTTP concerns.

### 3. `schema.py`

**Owns**: Pydantic v2 request and response shapes for this domain's HTTP boundary.
**Must export** (in future): `*Create`, `*Read`, `*Update`, `*Filter` BaseModel subclasses as needed.
**Must contain only**: `BaseModel` subclasses, field validators (`@field_validator`), serializer helpers, computed fields.
**Must NOT contain**:
- SQLModel tables.
- Database queries.
- Business logic beyond per-field validation.
- HTTP routing.

### 4. `service.py`

**Owns**: All domain business logic. **The only legal home for domain rules.**
**Must export** (in future): functions or a service class that take a session + inputs and return domain outputs.
**Must contain**: validation, orchestration, calls into `repository.py`, transactional boundaries, financial calculations using `decimal.Decimal` (delegating to `app.shared.decimal_utils`).
**Must NOT contain**:
- Direct DB queries (call `repository.py`).
- HTTP concerns (no `Request`, `Response`, status codes).
- SQLModel table definitions.
- Pydantic schema definitions.
- `import` statements from another module's `service.py`, `repository.py`, or `model.py`.

### 5. `repository.py`

**Owns**: All database queries for this domain.
**Must export** (in future): functions that take a session + parameters and return models or scalars.
**Must contain**: SQLModel `select(...)`, `session.get(...)`, `session.add(...)`, `session.delete(...)`, `session.exec(...)` calls; query construction; pagination/filter logic at the SQL level.
**Must NOT contain**:
- Business rules (those go in `service.py`).
- HTTP concerns.
- Pydantic schema validation (already done at the route boundary).
- Cross-module query joins that traverse another module's tables (instead, the calling service should orchestrate two repository calls).

### 6. `routes.py`

**Owns**: HTTP routing for this domain. **Routing only.**
**Must export**: a module-level `router: APIRouter` instance — even if empty. The registry in `app.main` discovers it by name.
**Must contain**: `@router.get/post/put/delete/patch(...)` decorated handlers that:
- Parse inputs via Pydantic schemas (declared in `schema.py`).
- Call into `service.py`.
- Return Pydantic schemas.
- Use `Depends(...)` from `dependencies.py` for authn/authz/session.
**Must NOT contain**:
- Any business logic.
- Direct DB queries.
- SQLModel table definitions.
- Pydantic schema definitions.
- Decimal arithmetic.

### 7. `dependencies.py`

**Owns**: FastAPI dependency-injection factories scoped to this module.
**Must export** (in future): factories like `get_current_developer`, `require_admin`, `get_module_session`, RBAC checks.
**Must contain**: `Depends(...)` chains, `OAuth2PasswordBearer` token parsing, role assertions.
**Must NOT contain**:
- Business logic.
- Direct DB queries (call `repository.py`).
- HTTP route declarations.

---

## Phase-1 (this feature) Required File Bodies

In this structural phase, each file is created with a **minimal valid body** that makes the file importable but performs no work. The exact bodies are produced in `/sp.implement`; the contract here specifies their *interface obligations*.

| File | Phase-1 minimal body |
|---|---|
| `__init__.py` | empty |
| `model.py` | docstring stating the layer responsibility; nothing else. |
| `schema.py` | docstring stating the layer responsibility; nothing else. |
| `service.py` | docstring stating the layer responsibility; nothing else. |
| `repository.py` | docstring stating the layer responsibility; nothing else. |
| `routes.py` | `from fastapi import APIRouter`; `router = APIRouter(tags=["<domain>"])`; module docstring. |
| `dependencies.py` | docstring stating the layer responsibility; nothing else. |

Phase-1 acceptance: `python -c "from app.modules.<domain> import routes; assert routes.router is not None"` succeeds for all nine modules.

---

## Module Registry Contract

`app/main.py` MUST expose a registry named `MODULE_REGISTRY` (or import one from `app/modules/__init__.py`):

```python
MODULE_REGISTRY: tuple[tuple[str, str], ...] = (
    ("auth",          "/auth"),
    ("users",         "/users"),
    ("clients",       "/clients"),
    ("projects",      "/projects"),
    ("modules_tasks", "/modules-tasks"),
    ("developers",    "/developers"),
    ("payments",      "/payments"),
    ("reporting",     "/reporting"),
    ("notifications", "/notifications"),
)
```

Registration loop (illustrative; produced in `/sp.implement`):

```python
import importlib
from fastapi import FastAPI

def register_modules(app: FastAPI) -> None:
    for package_name, url_prefix in MODULE_REGISTRY:
        routes = importlib.import_module(f"app.modules.{package_name}.routes")
        app.include_router(routes.router, prefix=url_prefix)
```

**Adding a tenth module** = appending one tuple to `MODULE_REGISTRY`. Nothing else outside the new module folder changes (satisfies SC-005).

---

## Forbidden Cross-Module Imports

For all `a, b ∈ {auth, users, clients, projects, modules_tasks, developers, payments, reporting, notifications}` with `a ≠ b`:

```text
app.modules.<a>.* may NOT import from app.modules.<b>.*
```

There are no exceptions in this phase. A future cross-module-data spec may define a narrow exception via re-exported `schema.py` types, but until then any such import is a hard violation discoverable by `grep -r "from app.modules\." backend/app/modules/`.

---

## Validation

This contract is satisfied for the skeleton when:

1. ✅ All nine modules have all seven files (six layer files + `__init__.py`).
2. ✅ Each module's `routes.py` exports `router: APIRouter`.
3. ✅ `MODULE_REGISTRY` lists exactly the nine modules with the documented prefixes.
4. ✅ `python -c "import app.main"` succeeds with no errors.
5. ✅ `uvicorn app.main:app` boots and serves `/docs` (HTTP 200).
6. ✅ `grep -r "from app.modules\." backend/app/modules/ | grep -v "from app.modules.<self>"` returns zero matches.

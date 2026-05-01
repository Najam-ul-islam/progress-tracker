# `app/modules/` — Domain Modules

Each subdirectory under `app/modules/` is a **self-contained domain module** for one bounded context. Every module has the **identical six-file layer contract** (plus `__init__.py`):

| File | Owns |
|---|---|
| `model.py` | SQLModel table definitions only |
| `schema.py` | Pydantic v2 request/response shapes |
| `service.py` | All business logic — the only legal home for domain rules |
| `repository.py` | All database queries |
| `routes.py` | HTTP routing only; exposes `router: APIRouter` |
| `dependencies.py` | FastAPI `Depends()` factories (authn/authz/session) |

## Authoritative source

The full per-layer ownership rules — what each file must export, what it must never contain, and the cross-module import ban — live in:

> [`specs/001-project-structure/contracts/module-layer-contract.md`](../../../specs/001-project-structure/contracts/module-layer-contract.md)

That document is the source of truth consulted by PR reviewers when judging "does this PR put code in the right place?". This README is a pointer; if the two ever disagree, the contract wins.

## Module registration

Modules are wired into the FastAPI app by a data-driven registry in `app/main.py`:

```python
MODULE_REGISTRY: tuple[tuple[str, str], ...] = (
    ("auth", "/auth"),
    # …
)
```

Adding a tenth module = create the folder with the seven files and append one tuple here.

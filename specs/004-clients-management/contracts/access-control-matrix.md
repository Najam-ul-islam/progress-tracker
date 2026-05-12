# Internal Contract: Access Control Matrix

**Feature**: `004-clients-management`
**Date**: 2026-05-03

This document is the canonical RBAC table for the clients module. Routes
consume the `auth.dependencies` already established by feature 002; this
matrix tells reviewers and tests *what should happen* for each (endpoint ×
role) cell.

## Notation

- ✅ — request is allowed; response is the documented 2xx.
- 🚫 403 — request is rejected with `403 Forbidden` and the generic body
  `{"detail":"Forbidden"}`.
- 🔒 401 — no/bad bearer token. Always returned **before** any role check.

All cells assume a valid bearer token has been presented; the 401 row is
implicit.

## Matrix

| Endpoint            | Method | admin | manager | developer | Notes                                                         |
| ------------------- | ------ | ----- | ------- | --------- | ------------------------------------------------------------- |
| `/clients`          | POST   | ✅    | ✅      | 🚫 403    | Subject to FR-009 duplicate guard (409 if email/phone reused).|
| `/clients`          | GET    | ✅    | ✅      | 🚫 403    | Returns active rows only (FR-014).                            |
| `/clients/{id}`     | GET    | ✅    | ✅      | 🚫 403    | Soft-deleted ids return 404 to admin/manager too (FR-019).    |
| `/clients/{id}`     | PATCH  | ✅    | ✅      | 🚫 403    | Subject to FR-010 cross-row uniqueness check.                 |
| `/clients/{id}`     | DELETE | ✅¹   | 🚫 403  | 🚫 403    | ¹ Admin only. Soft delete; returns 204.                       |

## Enforcement points

| Layer            | Mechanism                                                                                                                                | Files                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Authentication   | `Depends(get_current_user)` resolves the bearer token to a `User` row. Failures ⇒ 401 generic body.                                       | `app/modules/auth/dependencies.py` (feature 002).           |
| Role gate        | `Depends(require_admin)` for DELETE; `Depends(require_any("admin","manager"))` for the other four endpoints.                              | `app/modules/auth/dependencies.py` (feature 002).           |
| Soft-delete read | `clients.repository.get_client_by_id` and `list_clients` filter `is_active = TRUE`.                                                       | `app/modules/clients/repository.py` (this feature).         |
| Uniqueness guard | `clients.service.create_client` / `update_client` proactively call `find_active_client_by_{email,phone}`; partial unique indexes catch races. | `app/modules/clients/service.py` + alembic indexes. |
| Module boundary  | `audit_clients_imports.sh` fails the build if `clients/**.py` imports `auth.{service,repository}`, `users`, `projects`, or `payments`.    | `backend/scripts/audit_clients_imports.sh` (FR-020).        |

## Ordering: 401 → 403 → 404 → 422 → 409 → 2xx

For each endpoint, conditions are evaluated in this fixed order. The first
matching condition wins; later conditions are not even computed.

1. **401** — token missing/bad/expired. Returned by `get_current_user` before
   any route code runs.
2. **403** — caller's role is not on the allow-list for this endpoint.
   Returned by `require_*` before any service code runs. Developers receive
   403 on every endpoint in this feature without ever reaching the service
   layer (no id-probing concern: developers can't see anything, period).
3. **404** — for admin/manager only: lookup of `{id}` returned no row, or the
   row is soft-deleted. The body does not distinguish the two cases (FR-019).
4. **422** — Pydantic validation failed (missing required field, malformed
   email, invalid phone, empty PATCH, unknown field). Computed before the
   service layer is called because FastAPI runs Pydantic on the request body
   first.
5. **409** — duplicate `email` or `phone` against another active row, caught
   either proactively in the service or by the partial unique index. The
   route emits the same envelope in both cases.
6. **2xx** — write/read succeeds; service returns the appropriate body
   (or 204 for DELETE).

## Route-to-dependency wiring

```python
# app/modules/clients/routes.py — pseudocode showing exactly which Depends each route uses.

router = APIRouter(tags=["clients"])

@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    session: Session = Depends(get_session),
    requester: User = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.create_client(
            session, payload=payload, requester=requester
        )
    except clients_service.DuplicateClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"client with this {exc.field} already exists",
        )

@router.get("", response_model=list[ClientRead])
def list_clients(
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> list[ClientRead]:
    return clients_service.list_clients(session)

@router.get("/{id}", response_model=ClientRead)
def get_client_by_id(
    id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.get_client(session, client_id=id)
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

@router.patch("/{id}", response_model=ClientRead)
def update_client(
    id: int,
    patch: ClientUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.update_client(
            session, client_id=id, patch=patch
        )
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    except clients_service.DuplicateClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"client with this {exc.field} already exists",
        )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> None:
    try:
        clients_service.delete_client(session, client_id=id)
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
```

The route file does no DB I/O, no role checks beyond `Depends(...)`, and no
business logic beyond translating a small set of typed exceptions into the
HTTP responses documented in `openapi.yaml`. This matches the pattern feature
003 already established in `users/routes.py`.

## Service-layer exception → HTTP mapping

| Exception                                | Where raised                                                              | HTTP                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `ClientNotFoundError`                    | service: `get_client`, `update_client`, `delete_client`                   | 404 `{"detail":"Client not found"}`               |
| `DuplicateClientError(field="email")`    | service: `create_client`, `update_client` (proactive); repo (DB index)    | 409 `{"detail":"client with this email already exists"}` |
| `DuplicateClientError(field="phone")`    | service: `create_client`, `update_client` (proactive); repo (DB index)    | 409 `{"detail":"client with this phone already exists"}` |

Pydantic validation failures (empty PATCH, bad email/phone, unknown field)
are handled by FastAPI before the route body runs — the route does not need
to catch them.

# Internal Contract: Access Control Matrix

**Feature**: `003-users-management`
**Date**: 2026-05-02

This document is the canonical RBAC table for the users module. Routes consume the
`auth.dependencies` already established by feature 002; this matrix tells reviewers
and tests *what should happen* for each (endpoint × role) cell.

## Notation

- ✅ — request is allowed; response is the documented 2xx.
- 🚫 403 — request is rejected with `403 Forbidden` and the generic body
  `{"detail":"Forbidden"}` (no role-specific info leak).
- ⚠️ self-only — allowed only if the path/body refers to the requester's own user id.
- 🔒 401 — no/bad bearer token. Always returned **before** any role check.

All cells assume a valid bearer token has been presented; the 401 row is implicit.

## Matrix

| Endpoint                          | Method | admin | manager | developer | Notes                                                                                       |
| --------------------------------- | ------ | ----- | ------- | --------- | ------------------------------------------------------------------------------------------- |
| `/users/me`                       | GET    | ✅    | ✅      | ✅        | All roles read themselves.                                                                  |
| `/users`                          | GET    | ✅    | ✅      | 🚫 403    | Developers may not enumerate users.                                                         |
| `/users/developers`               | GET    | ✅    | ✅      | 🚫 403    | Developers may not enumerate.                                                               |
| `/users/{id}`                     | GET    | ✅    | ✅      | ⚠️ self-only | Developer with `id != requester.id` returns 403, **not** 404 — see "ordering" below. |
| `/users/{id}`                     | PATCH  | ✅¹    | 🚫 403  | 🚫 403    | Admin only. ¹ Subject to last-admin guard if demoting/deactivating self.                    |
| `/users/{id}/status`              | PATCH  | ✅²    | 🚫 403  | 🚫 403    | Admin only. ² Subject to last-admin guard + self-deactivation guard.                        |

## Enforcement points

| Layer            | Mechanism                                                                                           | Files                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Authentication   | `Depends(get_current_user)` resolves the bearer token to a `User` row. Failures ⇒ 401 generic body. | `app/modules/auth/dependencies.py` (feature 002).    |
| Role gate        | `Depends(require_admin)` or `Depends(require_any("admin","manager"))` on each route.                | `app/modules/auth/dependencies.py` (feature 002).    |
| Self-only check  | `users.service.get_user_profile` rejects developer with `target_id != requester.id` before lookup.  | `app/modules/users/service.py` (this feature).       |
| Last-admin guard | `users.service.update_user_profile` and `change_user_status` call `count_active_admins(exclude_id)` inside the same transaction; raise `LastAdminError` ⇒ 409. | `app/modules/users/service.py` (this feature). |
| Self-deactivate  | `change_user_status` rejects `requester.id == target_id and patch.is_active is False`. ⇒ 409.       | `app/modules/users/service.py` (this feature).       |
| Module boundary  | `audit_users_imports.sh` fails the build if `users/**.py` imports `auth.service` / `.repository` / `.schema`. | `backend/scripts/audit_users_imports.sh` (FR-020). |

## Ordering: 401 → 403 → 404 → 422 → 409 → 200

For each endpoint, conditions are evaluated in this fixed order. The first matching
condition wins; later conditions are not even computed.

1. **401** — token missing/bad/expired. Returned by `get_current_user` before any
   route code runs.
2. **403** — caller's role is not on the allow-list for this endpoint. Returned by
   `require_*` before any service code runs. **Exception** for `GET /users/{id}` with
   a developer caller and a foreign `id`: the route admits the request via
   `require_any("admin","manager","developer")`, then the service layer enforces the
   self-only rule and emits 403 itself. This avoids leaking which ids exist via 404
   vs 403 differential.
3. **404** — for admin/manager only: lookup of `{id}` returned no row. Developers
   never reach this branch (they were 403'd in step 2 for any non-self id).
4. **422** — Pydantic validation failed (empty body, forbidden field, invalid role).
   Computed before the service layer is called because FastAPI runs Pydantic on the
   request body first.
5. **409** — last-admin guard or self-deactivation guard fired inside the service.
   Computed after lookup (so the row is real) but before the write.
6. **200** — write succeeds; service returns the updated `UserRead`.

## Route-to-dependency wiring

```python
# app/modules/users/routes.py — pseudocode showing exactly which Depends each route uses.

router = APIRouter(tags=["users"])

@router.get("/me", response_model=UserRead)
def get_my_profile(
    requester: User = Depends(get_current_user),
) -> UserRead:
    return UserRead.model_validate(requester)

@router.get("", response_model=list[UserRead])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> list[UserRead]:
    return users_service.list_users(session)

@router.get("/developers", response_model=list[UserRead])
def list_developers(
    session: Session = Depends(get_session),
    _: User = Depends(require_any("admin", "manager")),
) -> list[UserRead]:
    return users_service.list_developers(session)

@router.get("/{id}", response_model=UserRead)
def get_user_by_id(
    id: int,
    session: Session = Depends(get_session),
    requester: User = Depends(get_current_user),
) -> UserRead:
    # Service applies the self-only rule for developer.
    return users_service.get_user_profile(
        session, target_id=id, requester=requester
    )

@router.patch("/{id}", response_model=UserRead)
def update_user(
    id: int,
    patch: UserUpdate,
    session: Session = Depends(get_session),
    requester: User = Depends(require_admin),
) -> UserRead:
    return users_service.update_user_profile(
        session, target_id=id, patch=patch, requester=requester
    )

@router.patch("/{id}/status", response_model=UserRead)
def change_user_status(
    id: int,
    patch: UserStatusUpdate,
    session: Session = Depends(get_session),
    requester: User = Depends(require_admin),
) -> UserRead:
    return users_service.change_user_status(
        session, target_id=id, patch=patch, requester=requester
    )
```

The route file does no DB I/O, no role checks beyond `Depends(...)`, and no error
construction beyond letting FastAPI's exception handlers translate
`UserNotFoundError`, `LastAdminError`, etc. into the responses documented in
`openapi.yaml`.

## Service-layer exception → HTTP mapping

| Exception                                | Where raised                                                      | HTTP                                          |
| ---------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| `UserNotFoundError`                      | service: `get_user_profile`, `update_user_profile`, `change_user_status` | 404 `{"detail":"User not found"}`             |
| `ForbiddenError` (developer non-self)    | service: `get_user_profile`                                       | 403 `{"detail":"Forbidden"}`                  |
| `EmptyUpdateError`                       | actually raised by Pydantic `UserUpdate` model_validator          | 422 (Pydantic envelope; FR-011)               |
| `LastAdminError`                         | service: `update_user_profile`, `change_user_status`              | 409 with the specific message in `openapi.yaml` |
| `SelfDeactivationError`                  | service: `change_user_status`                                     | 409 `{"detail":"cannot deactivate yourself"}` |

The translation from exception to `HTTPException` happens in `routes.py` in a small
try/except wrapper around the service call (matching the pattern feature 002 already
established in `auth/routes.py`).

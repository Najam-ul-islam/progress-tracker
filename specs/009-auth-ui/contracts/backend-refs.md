# Backend Contract References

This slice introduces **no new HTTP endpoints**. It is a pure consumer of the contracts defined in `002-auth-jwt-rbac`. This file pins the exact references the frontend implementation depends on so a future contract drift is detectable.

## Authoritative sources

| Concern | File | Symbol / Operation |
|---------|------|--------------------|
| OpenAPI for auth endpoints | [`specs/002-auth-jwt-rbac/contracts/openapi.yaml`](../../002-auth-jwt-rbac/contracts/openapi.yaml) | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Role guard semantics (server-side) | [`specs/002-auth-jwt-rbac/contracts/role-guards.md`](../../002-auth-jwt-rbac/contracts/role-guards.md) | `get_current_user`, `require_roles`, `require_admin`, `require_manager`, `require_developer` |
| Domain model for the user | [`specs/002-auth-jwt-rbac/data-model.md`](../../002-auth-jwt-rbac/data-model.md) | `User` record fields |

## Endpoints consumed

### `POST /auth/register`
- Request: `UserCreate` — `{name, email, password, role}` where role ∈ `[admin, manager, developer]` and password is 8–128 chars.
- Success (201): `UserRead` — `{id, name, email, role, created_at}`. **Does not include a token**; the client immediately calls `POST /auth/login` with the same credentials to obtain one (spec FR-003).
- Errors:
  - **409** `{detail: "Email already registered"}` → attach as field error on `email`.
  - **422** `HTTPValidationError` → fan out per-field by `loc[1]`.

### `POST /auth/login`
- Request: `UserLogin` — `{email, password}`.
- Success (200): `TokenResponse` — `{access_token, token_type: "bearer", user: UserRead}`.
- Errors:
  - **401** `{detail: "Could not validate credentials"}` → render as a single generic top-level error (spec FR-007, SC-005). The client must NOT distinguish between unknown-email and wrong-password.
  - **422** `HTTPValidationError` → per-field.

### `GET /auth/me`
- Auth: `Authorization: Bearer <access_token>`.
- Success (200): `UserRead`.
- **401** `{detail: "Could not validate credentials"}` → triggers global session-end handling (FR-013).

## Behavioural contract assumptions (must not silently change)

- 401 responses for any of the three endpoints have the same `detail` string.
- Token claims include `sub`, `email`, `role`, `iat`, `exp`. The client only reads `exp` (for client-side expiry gating) and trusts the rest from the `user` object in the login response.
- Email is case-insensitive server-side; the client also lowercases before send (FR-017) so the two layers agree even if one is changed.

## Drift detection

When the backend is regenerated or otherwise modified, a CI step SHOULD diff `specs/002-auth-jwt-rbac/contracts/openapi.yaml` against the version pinned here (commit hash recorded in the slice's tasks). Any field-name change, status-code change, or enum change must trigger a `/sp.specify` revisit of this slice before tasks proceed.

# Frontend Contract: `usersApi` client

**Feature**: 010-users-dashboard
**Date**: 2026-05-12
**File**: `frontend/src/modules/users/services/users.api.ts`
**Backend source of truth**: `specs/003-users-management/contracts/openapi.yaml`

This contract describes the function-level interface the rest of the frontend uses. It is intentionally narrower than the OpenAPI surface — fields the UI never edits (e.g. `email`) are not exposed in any write helper.

---

## Imports / shared shapes

```ts
import type { User, EditDraft, Role } from "../types";

export class UsersApiError extends Error {
  status: number;
  code:
    | "unauthorized"        // 401
    | "forbidden"           // 403
    | "not_found"           // 404
    | "conflict"            // 409 — self-deactivate, last-admin, etc.
    | "validation"          // 422
    | "network"             // network / timeout / 5xx
    | "unknown";
  detail?: string;          // backend-supplied human message, if any
  fieldErrors?: Record<string, string>; // for 422
}
```

`401` is handled globally by the existing `http` interceptor from `009-auth-ui` (clears session, redirects to `/login` with `from`). `usersApi` re-throws so callers can also surface inline messages if they want, but no caller in this feature catches 401 explicitly.

---

## `usersApi.list()`

```ts
list(): Promise<User[]>
```

**Wire call**: `GET /users`, bearer token attached by Axios interceptor.

**Maps from**: `UserWire[]` via `fromWire`.

**Errors**:
| HTTP | UsersApiError.code | UI reaction |
|------|--------------------|-------------|
| 200 | — | resolves with `User[]` |
| 401 | `unauthorized` | global interceptor handles redirect; promise rejects |
| 403 | `forbidden` | UI renders Access Denied state (developer hitting `/users`) |
| 5xx, network | `network` | UI renders ErrorState with retry |

**TanStack Query usage**: `useQuery({ queryKey: ["users","list"], queryFn: usersApi.list, staleTime: 30_000, refetchOnWindowFocus: true })`.

---

## `usersApi.get(id)`

```ts
get(id: string): Promise<User>
```

**Wire call**: `GET /users/{id}`.

**Maps from**: `UserWire` via `fromWire`.

**Errors**:
| HTTP | code | UI reaction |
|------|------|-------------|
| 200 | — | resolves with `User` |
| 401 | `unauthorized` | global redirect |
| 403 | `forbidden` | Profile page shows Access Denied state |
| 404 | `not_found` | Profile page shows "User not found" with back link |
| 5xx, network | `network` | ErrorState with retry |

**TanStack Query usage**: `useQuery({ queryKey: ["users","detail",id], queryFn: () => usersApi.get(id), staleTime: 30_000 })`.

---

## `usersApi.update(id, draft)`

```ts
update(id: string, draft: EditDraft): Promise<User>
```

**Pre-condition**: `draft` MUST contain at least one of `name` or `role` (status is sent via `updateStatus`). If `draft.isActive` is set, the function calls `updateStatus` separately and stitches results.

**Wire call**: `PATCH /users/{id}` with `UpdateUserBodyWire` (only the keys present in `draft`).

**Maps from**: `UserWire` via `fromWire`.

**Errors**:
| HTTP | code | UI reaction |
|------|------|-------------|
| 200 | — | resolves; mutation invalidates `["users","list"]` and `["users","detail",id]` |
| 400 / 422 | `validation` | inline field errors in modal; `fieldErrors` populated when backend returns per-field detail |
| 401 | `unauthorized` | global redirect; modal unmounts as page navigates |
| 403 | `forbidden` | should not happen for admin path; surfaced as generic inline error if it does |
| 404 | `not_found` | inline alert "user no longer exists"; modal stays open until user closes |
| 409 | `conflict` | inline alert with backend `detail` (e.g. self-deactivate, last-admin guard) |
| 5xx, network | `network` | inline retry-able alert; form values preserved |

**TanStack Query usage**: `useMutation({ mutationFn: ({id,draft}) => usersApi.update(id,draft), onSuccess: (_data, { id }) => { qc.invalidateQueries({ queryKey: ["users","list"] }); qc.invalidateQueries({ queryKey: ["users","detail", id] }); } })`.

---

## `usersApi.updateStatus(id, isActive)`

```ts
updateStatus(id: string, isActive: boolean): Promise<User>
```

**Wire call**: `PATCH /users/{id}/status` with `{ is_active: boolean }`.

**Errors**: Same matrix as `update`. 409 specifically covers self-deactivation and last-admin guard.

**TanStack Query usage**: same `onSuccess` invalidation as `update`.

---

## Implementation notes

- All four functions are thin: `http.<verb>(...)` → `fromWire` (for 2xx) or `throw new UsersApiError(...)` (otherwise). Zero business logic.
- `fromWire` and the body builders are private to this module — exporting them would let snake_case escape and breaks the type boundary.
- `update` and `updateStatus` are kept separate (matching the backend's two endpoints). If `EditDraft` carries both name/role AND `isActive`, the mutation hook composes the two calls and invalidates once at the end.
- Function-level Vitest unit tests exercise both branches of every error class against MSW handlers.

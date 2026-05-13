# Data Model: Users Management Dashboard (Frontend)

**Feature**: 010-users-dashboard
**Date**: 2026-05-12
**Scope**: TypeScript domain types and their wire counterparts. Backend persistence model is owned by `003-users-management`.

---

## Domain types (camelCase, what the rest of the frontend sees)

```ts
// modules/users/types.ts

export type Role = "admin" | "manager" | "developer";
export type Status = "active" | "inactive";

export interface User {
  id: string;            // UUID
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
  // Optional developer metadata (only present when backend returns it).
  developer?: DeveloperMetadata | null;
}

export interface DeveloperMetadata {
  hourlyRate?: number | null;
  capacityHoursPerWeek?: number | null;
  // Other fields surface as-is from the backend; this slice renders them read-only.
}

export interface UsersFilter {
  q: string;             // free-text substring; case-insensitive; matches name OR email
  role: Role | "any";
  status: Status | "all";
}

export type EditDraft = Partial<Pick<User, "name" | "role" | "isActive">>;
```

### Validation rules

| Field | Rule | Surfaced as |
|-------|------|-------------|
| `User.name` | non-empty after trim, ≤ 255 chars | UI required, inline error on Edit modal |
| `User.email` | RFC-5322-ish; UI never edits | n/a (read-only on profile) |
| `User.role` | one of `"admin" \| "manager" \| "developer"` | Edit modal `<Select>` options |
| `User.isActive` | boolean | Edit modal toggle |
| `EditDraft` | at least one field MUST differ from the loaded user OR the form submission is a no-op (save button disabled) | RHF `formState.isDirty` |
| `UsersFilter.q` | string; client trims for display but sends raw to filter predicate | n/a (client-only) |
| `UsersFilter.role` / `status` | union enum | filter dropdown options |

### Relationships

- `User` has-one (optional) `DeveloperMetadata` (read-only here; managing it is out-of-scope).
- `EditDraft ⊂ User` — the modal can only touch `name`, `role`, `isActive`.
- `UsersFilter` is orthogonal to `User` — it is a client-only predicate, never persisted server-side.

---

## Wire types (snake_case, internal to `users.api.ts`)

```ts
// modules/users/services/users.api.ts (NOT EXPORTED)

interface UserWire {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  developer?: DeveloperWire | null;
}

interface DeveloperWire {
  hourly_rate?: number | null;
  capacity_hours_per_week?: number | null;
}

interface UpdateUserBodyWire {
  name?: string;
  role?: Role;
}

interface UpdateStatusBodyWire {
  is_active: boolean;
}
```

### Adapter signatures

```ts
function fromWire(wire: UserWire): User;       // snake_case → camelCase, used on every GET response
function toUpdateBody(draft: EditDraft): UpdateUserBodyWire;     // camelCase → snake_case for PATCH /users/{id}
function toStatusBody(isActive: boolean): UpdateStatusBodyWire;  // for PATCH /users/{id}/status
```

`UserWire`, `DeveloperWire`, and the body wire types are declared inside `users.api.ts` and not exported. The rest of the frontend never names them.

---

## State machines

### Edit modal state

```
closed
  └─(admin clicks "Edit")──▶ open:prefilled
open:prefilled
  ├─(field change)──▶ open:dirty
  ├─(cancel / esc / backdrop / close button)──▶ closed
  └─(open with no changes possible because backend stale)──▶ open:prefilled (Save remains disabled)

open:dirty
  ├─(submit)──▶ saving
  ├─(reset to original values)──▶ open:prefilled
  └─(cancel / esc)──▶ closed (discard)

saving
  ├─(2xx)──▶ closed + invalidate(["users","list"]) + invalidate(["users","detail",id])
  ├─(400/409/422)──▶ open:dirty + inline error
  ├─(401)──▶ session-clear handled by http interceptor; modal unmounts as page redirects to /login
  └─(network/5xx)──▶ open:dirty + generic retry message; values preserved
```

### List page state

```
loading              ── fetched ──▶ data
loading              ── error   ──▶ error
data
  ├─(filter narrows to 0)──▶ empty
  ├─(filter still has matches)──▶ data
  └─(focus regained, refetch failed)──▶ data + non-blocking toast (out of scope; just stays on data)
error                ── retry  ──▶ loading
empty                ── clear filters ──▶ data
```

### Profile page state

```
loading              ── fetched 2xx ──▶ data
loading              ── 404         ──▶ not-found
loading              ── 403         ──▶ access-denied
loading              ── other       ──▶ error
data                 ── retry refetch (focus) ──▶ data
```

---

## Cache keys (TanStack Query)

| Surface | Key | Stale time | Invalidated by |
|---------|-----|------------|----------------|
| List | `["users", "list"]` | 30 s | `useUpdateUser`, `useUpdateUserStatus` |
| Profile (any user) | `["users", "detail", id]` | 30 s | `useUpdateUser`, `useUpdateUserStatus` for the same `id` |
| Self (existing from 009) | `["auth", "me"]` | session-bound | unaffected by this feature |

# Frontend Consumption Contract: Client Management Dashboard

**Feature**: `011-clients-dashboard` | **Date**: 2026-06-13
**Backend source of truth**: `specs/004-clients-management/contracts/openapi.yaml` + `access-control-matrix.md`

This feature introduces **no new HTTP endpoints**. It is a frontend consumer of the existing `004-clients-management` REST contract. This document pins exactly how the frontend calls each endpoint, what it sends/expects, and how each response maps to a UI outcome — the contract the `clients.api.ts` service and its tests are written against.

---

## Endpoint consumption map

All requests carry `Authorization: Bearer <token>` (attached by the `lib/http.ts` request interceptor). Base URL from `VITE_API_BASE_URL` (default `http://localhost:8000`).

### `GET /clients` — list (used by `useClientsList`)

- **Request**: no body, no query params (MVP returns full active list).
- **200**: `ClientWire[]` → `fromWire` → `Client[]` → cached at `["clients","list"]`.
- **403**: developer → list page already gated by `RequireClientsAccess`; if reached, surfaces AccessDenied.
- **401**: interceptor clears session → redirect to login (FR-030).
- **network/5xx**: `ClientsApiError("network"|"unknown")` → list ErrorState with "Try again" (FR-005).

### `GET /clients/{id}` — detail (used by `useClient`, `enabled` only when allowed)

- **200**: `ClientWire` → `Client` → cached at `["clients","detail",id]`.
- **404**: soft-deleted or never existed → "Client not found" state with back-link (FR-011).
- **403**: developer → AccessDenied (FR-010).
- Query is **disabled** when the id is invalid (`NaN`) or the role can't view → no wasted request.

### `POST /clients` — create (used by `useCreateClient`)

- **Request body** (`toCreateBody`): `{ name, email, phone, company_name?, address?, notes? }` — required trio always present; empty optionals omitted.
- **201**: `ClientWire` → `Client`; `invalidateQueries(["clients","list"])`; dialog closes; new client appears in list (FR-017).
- **409**: `{ detail: "client with this email already exists" | "...phone..." }` → `conflict`; dialog stays open, error attached to the named field (FR-016).
- **422**: `{ detail: ValidationDetail[] }` → field errors inline (should be rare — client-side Zod catches most first).
- **403**: only reachable if a non-allowed role somehow opened the dialog (it can't — affordance is DOM-absent); defensive AccessDenied.

### `PATCH /clients/{id}` — update (used by `useUpdateClient`)

- **Request body** (`diffDraft` → `toUpdateBody`): only changed fields; **never empty** (client guards no-op via `hasChanges`, since backend 422s an empty patch — FR-019).
- **200**: `ClientWire` → `Client`; `setQueryData(detail)` + invalidate list & detail; dialog closes; all surfaces update (FR-021).
- **409**: duplicate email/phone against another active client → field error, dialog stays open (FR-020).
- **404**: client deleted concurrently → `not_found`; surfaced as form-level error / dialog stays open.
- **422**: inline field errors.

### `DELETE /clients/{id}` — soft delete (used by `useDeleteClient`, admin only)

- **Request**: no body.
- **204**: success; `invalidateQueries(list)` + `removeQueries(detail)`; confirmation dialog closes; if invoked from details page, navigate back to `/clients` (FR-024).
- **403**: manager/developer → cannot reach (Delete affordance is admin-only DOM-absent, FR-022); defensive handling only.
- **404**: already deleted → treat as effectively done (idempotent); surface a benign message and refresh list.
- **network**: retry-able error in confirmation dialog; client NOT removed (FR-026, US5 scenario 6).

---

## RBAC contract (from `004` access-control-matrix.md)

| Capability | admin | manager | developer | Frontend enforcement |
|---|---|---|---|---|
| View list / detail | ✅ | ✅ | 🚫 | `canViewClients`; nav link `IfRole`; `RequireClientsAccess` |
| Create | ✅ | ✅ | 🚫 | `canEditClients`; "New client" rendered for admin+manager |
| Edit | ✅ | ✅ | 🚫 | `canEditClients`; Edit affordance rendered for admin+manager |
| Delete | ✅ | 🚫 | 🚫 | `canDeleteClients`; Delete wrapped in `IfAdmin` (DOM-absent otherwise) |

Disallowed affordances MUST NOT exist in the DOM for that role (FR-029) — verified by component tests rendering as each role.

---

## Error → UI outcome summary

| Status | `ClientsApiErrorCode` | List page | Detail page | Dialogs |
|---|---|---|---|---|
| 401 | `unauthorized` | session cleared → login (preserve URL) | same | same |
| 403 | `forbidden` | AccessDenied | AccessDenied | defensive AccessDenied |
| 404 | `not_found` | n/a | "Client not found" + back-link | form-level error |
| 409 | `conflict` | n/a | n/a | field error on email/phone, stays open |
| 422 | `validation` | n/a | n/a | inline field errors |
| network | `network` | ErrorState + Try again | ErrorState + Try again | in-dialog retry, values preserved |

---

## Contract test obligations (Phase: validation/testing)

The `tests/mocks/clients-handlers.ts` MSW layer MUST simulate, and tests MUST assert:

1. **Success**: list returns seeded clients; create/edit/delete mutate the in-handler store and reflect on refetch.
2. **Validation errors**: 422 with `detail[]` → inline field errors; client-side Zod blocks bad email/phone before any request.
3. **RBAC**: developer token → 403 on every endpoint; manager → 403 on DELETE; affordance presence per role.
4. **API behaviour**: 409 on duplicate email and on duplicate phone (distinct messages); 404 on deleted/unknown id.
5. **Loading states**: skeletons on list/detail; disabled+spinner primary button while a mutation is pending.
6. **Error states**: network failure → retry on list and inside dialogs without page reload; values preserved.

These six map 1:1 to the constitution's Testing Standards categories.

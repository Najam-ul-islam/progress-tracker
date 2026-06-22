# Phase 1 — Data Model: Client Management Dashboard (Frontend)

**Feature**: `011-clients-dashboard` | **Date**: 2026-06-13

The frontend owns **no persistent data** — the backend `004-clients-management` slice is the single source of truth. This document defines the frontend-side TypeScript shapes: the wire shapes received from / sent to the API, the camelCase domain types used in components, the form/draft shapes, and the validation rules (aligned to the backend contract). All shapes live in `frontend/src/modules/clients/`.

---

## 1. Wire shapes (snake_case — match `contracts/openapi.yaml`)

Internal to `services/clients.api.ts`; never leak past the mapper.

```ts
type ClientWire = {
  id: number;
  name: string;
  email: string;
  phone: string;
  company_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
};

type ClientCreateBodyWire = {
  name: string;
  email: string;
  phone: string;
  company_name?: string | null;
  address?: string | null;
  notes?: string | null;
};

type ClientUpdateBodyWire = Partial<ClientCreateBodyWire>; // only changed fields; never empty (backend 422s empty)

type ValidationDetail = { loc: (string | number)[]; msg: string; type: string };
```

## 2. Domain entity — `Client` (camelCase, used by components)

```ts
type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;     // always true for rows the UI sees (backend hides soft-deleted)
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
};
```

**Mapping** (`fromWire`): `company_name→companyName`, `is_active→isActive`, `created_at→createdAt`, `updated_at→updatedAt`; other fields pass through. `null` optionals stay `null` (rendered as "Not provided").

**Lifecycle note**: The UI only ever receives `is_active = true` clients (the backend omits soft-deleted rows from list and returns 404 on detail). `isActive` is carried for completeness but is not a UI filter dimension (unlike the users dashboard's status filter) — there is no inactive-client view.

## 3. Form & draft shapes

```ts
// Full form value type, shared by create and edit (RHF + Zod).
type ClientFormValues = {
  name: string;
  email: string;
  phone: string;
  companyName: string;   // "" when empty in the form
  address: string;       // ""
  notes: string;         // ""
};

// Create body builder: trims, drops empty optionals to undefined.
// toCreateBody(values) -> ClientCreateBodyWire

// Edit diff: only fields that changed vs the original Client.
type ClientDraft = Partial<{
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  address: string | null;
  notes: string | null;
}>;
// diffDraft(original: Client, values: ClientFormValues) -> ClientDraft
// hasChanges(draft) -> boolean   (guards the no-op PATCH that the backend would 422)
```

**Empty-optional convention**: In the form, an emptied optional field (`companyName`/`address`/`notes`) maps to `""`. On create, `toCreateBody` omits empty optionals. On edit, `diffDraft` emits `null` when the user clears a previously-set optional (so the backend nulls it) and omits unchanged fields.

## 4. Filter shape — `ClientsFilter` (client-only, URL-backed)

```ts
type ClientsFilter = {
  q: string;   // free-text; matched (case-insensitive substring) against name, companyName, email, phone
};
```

- Lives in the URL query string (`?q=...`) via `clients-filter.schema.ts` (`parseFilter` / `filterToParams`), so a filtered list is shareable/restorable (mirrors users `010`).
- Simpler than the users filter (no role/status dimensions — clients has no role and the UI never shows inactive rows).
- Filtering is **client-side only** (FR-004): `useFilteredClients` memoises the substring match; typing never refetches.

## 5. Validation rules (Zod — aligned to backend contract)

`schemas/client-form.schema.ts` enforces, matching `004-clients-management/contracts/openapi.yaml`:

| Field | Required | Rule | Message |
|---|---|---|---|
| `name` | ✅ | trim, 1–120 chars | "Name is required" / "Name must be 120 characters or fewer" |
| `email` | ✅ | valid email syntax, ≤320 chars | "Enter a valid email address" |
| `phone` | ✅ | regex `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$`, 8–40 chars | "Phone must be international format, e.g. +1 415 555 0101" |
| `companyName` | ❌ | ≤200 chars (when non-empty) | "Company name must be 200 characters or fewer" |
| `address` | ❌ | ≤500 chars (when non-empty) | "Address must be 500 characters or fewer" |
| `notes` | ❌ | free text | — |

- The phone regex is copied verbatim from the backend to prevent a pass-here-fail-there mismatch.
- Server-side validation errors (422 with `detail[]`) are mapped to field errors via `fieldErrorsFromValidation` (snake_case `company_name` → form field `companyName`) and surfaced inline.
- **Duplicate (409)**: not a Zod rule — surfaced after submit. The dialog reads the conflict `detail` and attaches it to `email` or `phone` (whichever the message names), else shows a form-level alert (research Decision 2).

## 6. API error model — `ClientsApiError`

Identical shape to `UsersApiError` (module-local class):

```ts
type ClientsApiErrorCode =
  | "unauthorized" | "forbidden" | "not_found"
  | "conflict" | "validation" | "network" | "unknown";

class ClientsApiError extends Error {
  code: ClientsApiErrorCode;
  status: number;
  detail?: string;                          // server detail string (e.g. duplicate message)
  fieldErrors?: Record<string, string>;     // from 422 detail[]
}
```

| HTTP | code | Used by UI for |
|---|---|---|
| 401 | `unauthorized` | (handled globally by http interceptor → session cleared) |
| 403 | `forbidden` | AccessDenied state (developer hitting any endpoint) |
| 404 | `not_found` | "Client not found" on detail page |
| 409 | `conflict` | duplicate email/phone field error in dialog |
| 400/422 | `validation` | inline field errors in dialog |
| network | `network` | retry-able in-dialog / list error |

## 7. React Query keys

```ts
const CLIENTS_QUERY_KEYS = {
  list: () => ["clients", "list"] as const,
  detail: (id: number) => ["clients", "detail", id] as const,
};
```

| Mutation | Cache effect |
|---|---|
| create | `invalidateQueries(list)` |
| update | `setQueryData(detail, updated)` + `invalidateQueries(list)` + `invalidateQueries(detail)` |
| delete | `invalidateQueries(list)` + `removeQueries(detail)` (next detail visit refetches → 404) |

## 8. Relationships & entity boundary

- `Client` is a standalone entity on the frontend; **no** FK links to users, projects, or payments are modelled here (those modules are out of scope per spec).
- One-`Client`-to-many-`Projects` exists in the backend but the projects module is a separate feature; this dashboard neither reads nor displays project linkage.
- No state machine: the only lifecycle transition (`active → soft-deleted`) is server-side and manifests to the UI simply as the row disappearing / detail 404.

**Output**: Domain model complete; feeds the frontend consumption contract and quickstart.

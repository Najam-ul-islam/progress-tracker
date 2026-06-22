# Phase 0 — Research: Client Management Dashboard (Frontend)

**Feature**: `011-clients-dashboard` | **Date**: 2026-06-13

This feature is a near-clone of the shipped `010-users-dashboard` module against a different backend contract (`004-clients-management`). There are no open `NEEDS CLARIFICATION` items from the spec; the research below records the deliberate decisions that adapt the proven users-dashboard patterns to clients, plus the few places clients genuinely differs (full CRUD, editable email/phone, admin-only delete, no developer access).

---

## Decision 1 — Reuse the `modules/users` architecture verbatim

- **Decision**: Create `frontend/src/modules/clients/` with the same layering the users module uses: `services/clients.api.ts` (Axios + wire↔domain mappers + `CLIENTS_QUERY_KEYS`), `hooks/` (React Query wrappers), `schemas/` (Zod + RHF helpers), `components/`, `pages/`, plus a module-local `ClientsApiError`.
- **Rationale**: The users module already satisfies every constitution Frontend Standard and ships with a full MSW test suite. Cloning its shape minimises review surface (Principle IV — Incremental Evolution), guarantees consistency, and lets the new tests reuse `tests/helpers/renderWithProviders.tsx` and the MSW `server.ts` registration pattern.
- **Alternatives considered**:
  - *Generic CRUD abstraction shared by users + clients* — rejected: premature generalisation over two slightly divergent contracts (users has status/role + a `/status` sub-endpoint; clients has 6 free-text fields + uniqueness). Two concrete modules are clearer than one leaky abstraction.
  - *Co-locate clients inside the users module* — rejected: violates module isolation (Principle II); clients is its own domain.

## Decision 2 — Wire/domain mapping and error taxonomy

- **Decision**: Map snake_case backend fields (`company_name`, `is_active`, `created_at`, `updated_at`) to camelCase domain types in `clients.api.ts` via `fromWire`/`toCreateBody`/`toUpdateBody`, exactly as `users.api.ts` does. Reuse the `mapAxiosError` switch (401→`unauthorized`, 403→`forbidden`, 404→`not_found`, 409→`conflict`, 400/422→`validation` with `fieldErrors`, network→`network`).
- **Rationale**: Keeps the component layer free of wire concerns and gives dialogs a single typed error to branch on. The 409 path is the one materially exercised more here than in users (duplicate email/phone), so the `conflict` code carries the server `detail` string straight to the dialog.
- **409 field attribution**: The backend returns `detail: "client with this email already exists"` / `"...phone..."`. Decision: in the dialog, inspect the conflict message for the substrings `email`/`phone` and attach the error to that field via `form.setError`; fall back to a form-level alert if neither matches. This avoids depending on a structured error body the backend does not provide.
- **Alternatives considered**: Parsing 409 into a structured `{field}` on the API layer — rejected as marginally cleaner but couples the mapper to message wording; the dialog is the right place to interpret user-facing conflict copy.

## Decision 3 — Single dual-mode dialog for create + edit

- **Decision**: One `ClientFormDialog` component takes a `mode: "create" | "edit"` (and `client: Client | null` for edit). Create submits a full `ClientCreate` body; edit computes a diff and submits only changed fields (`diffDraft`), short-circuiting to a no-op close when nothing changed (mirrors `EditUserDialog.hasChanges`). The backend rejects an empty PATCH with 422, so the client-side no-op guard both improves UX and avoids a guaranteed error.
- **Rationale**: Create and edit share ~90% of their fields, validation, and error handling. A single component avoids duplication (Hard Constraint: no duplicate logic) while a discriminated `mode` keeps the two submit paths explicit.
- **Alternatives considered**: Two separate dialogs — rejected: duplicates the six FormFields and the 409 handling. The users module had only an edit dialog, so this is the one place we extend the precedent rather than copy it.

## Decision 4 — Client-side validation aligned to the backend contract

- **Decision**: Zod `client-form.schema.ts` enforces: `name` non-empty ≤120; `email` valid syntax ≤320; `phone` matches the backend's anchored pattern `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$` (8–40 chars); `company_name` ≤200, `address` ≤500, `notes` free text — the optional three nullable/empty-allowed. Helper text on the phone field states the international-format requirement.
- **Rationale**: Constitution Form Standards require Zod validation aligned with server-side. Re-using the exact backend regex (from `004-clients-management/contracts/openapi.yaml`) prevents a client/server validation mismatch where the form passes but the API 422s.
- **Phone normalisation**: Decision — do **not** reformat user input; validate shape only. Matches the backend, which also defers true normalisation. (Spec Edge Case + Assumption.)
- **Email casing**: Decision — display the backend-normalised (lowercased/trimmed) value returned on success rather than echoing raw input. The mutation's `onSuccess` writes the server response into the cache, so this is automatic.

## Decision 5 — React Query cache strategy for CRUD

- **Decision**:
  - `useClientsList` → `useQuery(CLIENTS_QUERY_KEYS.list(), staleTime 30_000, refetchOnWindowFocus: true)` (instant revisits + focus refresh, FR-006).
  - `useClient(id, {enabled})` → detail query, enabled only when access is allowed (avoids a guaranteed 403/404 fetch for denied/invalid ids), mirroring `useUser`.
  - `useCreateClient` → on success `invalidateQueries(list)`.
  - `useUpdateClient` → on success `setQueryData(detail, updated)` + `invalidateQueries(list)` + `invalidateQueries(detail)` (mirrors `useUpdateUser`).
  - `useDeleteClient` → on success `invalidateQueries(list)` + `removeQueries(detail)` so a later visit to the deleted id refetches and hits the backend 404 → "Client not found".
- **Rationale**: Guarantees every surface (list + detail) reflects a mutation without a manual reload (FR-017/021/024, SC-003/004/005). `removeQueries` on delete is the clean way to make the soft-deleted detail page show not-found on next visit.
- **Alternatives considered**: Optimistic updates with rollback — rejected for MVP: the extra complexity isn't justified at low-hundreds scale and risks showing a phantom row if the server rejects; invalidate-on-success is simpler and correct.

## Decision 6 — RBAC enforcement (three layers, DOM-absent affordances)

- **Decision**: Add to `@/lib/rbac.ts`:
  - `canViewClients(role) = role === "admin" || role === "manager"`
  - `canEditClients(role) = role === "admin" || role === "manager"` (create + edit)
  - `canDeleteClients(role) = role === "admin"`
  Enforce at three layers, copying the users precedent: (a) nav link wrapped in `IfRole admin|manager` in `AppHeader`; (b) page-level `RequireClientsAccess` gate rendering `AccessDenied` for developers; (c) affordance-level — Edit wrapped so it renders for admin+manager, Delete wrapped in `IfAdmin` so it is **absent from the DOM** for others (FR-029).
- **Rationale**: Matches `004-clients-management/contracts/access-control-matrix.md` (admin+manager CRU, admin-only D, developer none). Developers have **no** self-view carve-out (unlike users' `canViewUserProfile`), so the clients RBAC helpers are simpler — there is no per-id ownership check.
- **Alternatives considered**: Disabling (not hiding) the Delete button for managers — rejected: spec FR-022/029 require the control to not exist in the DOM, and the matrix gives managers no delete capability at all.

## Decision 7 — Routing and access gating

- **Decision**: Add `/clients` and `/clients/:id` under the existing `RequireAuth` children in `routes.tsx`. Each page wraps its body in `RequireClientsAccess`. The 401 interceptor in `lib/http.ts` already clears the session with a `"session-ended"` reason and the app redirects to login preserving location (FR-030) — no new code needed for session-expiry.
- **Rationale**: Reuses the shipped auth foundation end-to-end; the only routing change is two new route entries.
- **Role-change re-render (FR-031)**: The cross-tab `storage` sync + Zustand selectors already re-render `IfRole`/`IfAdmin` consumers on role change (covered by `tests/unit/cross-tab-role-change.test.ts` for users); the clients affordances inherit this for free because they read role from the same selectors.

## Decision 8 — Details page as contact-info cards

- **Decision**: `ContactInfoCards` renders three `Card`s — Identity (name, company_name), Contact (email, phone, address), Notes — plus a created/updated footer. Empty optional fields render a muted "Not provided" placeholder (FR-009). This replaces the users module's single `UserProfileCard` with a multi-card layout to satisfy the spec's "Contact info cards" feature.
- **Rationale**: The spec explicitly lists "Contact info cards" as a feature; grouping the six fields into semantic cards is more readable than one flat card and is the main visual divergence from the users profile.
- **Alternatives considered**: A single card with a definition list — rejected: doesn't honour the spec's card framing and reads poorly for clients with long addresses/notes.

## Decision 9 — Testing approach (MSW component + Vitest unit)

- **Decision**: Reuse the existing harness — `vitest.config.ts` already globs `tests/**/*.test.{ts,tsx}`, `tests/setup.ts` wires MSW + jest-dom, `tests/helpers/renderWithProviders.tsx` provides Router + QueryClient + session seeding. Add `tests/mocks/clients-handlers.ts` (seeded clients + CRUD handlers, including 409 on duplicate email/phone and 403 for developer) and register it in `tests/mocks/server.ts`. Cover the constitution's six required validation categories (success, validation errors, RBAC, API behaviour, loading states, error states).
- **Rationale**: Zero new test infrastructure; identical developer experience to the users tests. MSW lets component tests exercise the real `clients.api.ts` + hooks against simulated HTTP, which is where the wire-mapping and 409 logic actually live.
- **Alternatives considered**: Mocking the api module directly — rejected: would bypass the wire mappers and error taxonomy, the highest-value code to test.

---

## Resolved unknowns

| Question | Resolution |
|---|---|
| Standalone create/edit routes vs dialogs? | **Dialogs** (spec Assumption; matches 010 precedent). One dual-mode `ClientFormDialog`. |
| How to attribute a 409 to a field? | Inspect conflict `detail` for `email`/`phone` substring in the dialog; fall back to form-level alert. |
| Developer self-view of a client? | **None.** Clients backend gives developers zero access; RBAC helpers omit any ownership check. |
| Make detail page show not-found after delete? | `removeQueries(detail)` on delete success → next visit refetches → backend 404 → "Client not found". |
| Where does search state live? | URL query string (`?q=`), via `clients-filter.schema.ts`, mirroring users. |
| Any backend change required? | **No.** Pure frontend consumer of the stable `004` contract. |

**Output**: All decisions resolved; no blocking unknowns. Proceed to Phase 1.

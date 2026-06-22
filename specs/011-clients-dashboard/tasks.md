---
description: "Task list for 011-clients-dashboard implementation"
---

# Tasks: Client Management Dashboard (Frontend)

**Input**: Design documents from `/specs/011-clients-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/clients-frontend-contract.md, quickstart.md

**Tests**: INCLUDED. The project constitution (Testing Standards) mandates that every module validate success cases, validation errors, RBAC restrictions, API behaviour, loading states, and error states. The plan defines an MSW + Vitest strategy, so test tasks are first-class here.

**Organization**: Tasks are grouped by user story (US1–US6 from spec.md) so each story is an independently testable increment. The new module is `frontend/src/modules/clients/`, mirroring the shipped `frontend/src/modules/users/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6; Setup/Foundational/Polish carry no story label
- All paths are relative to repo root `D:\progress-tracker\`

## Path Conventions

- App code: `frontend/src/modules/clients/` (+ small edits to `frontend/src/lib/rbac.ts`, `frontend/src/routes.tsx`, `frontend/src/modules/auth/components/AppHeader.tsx`)
- Tests: `frontend/tests/unit/`, `frontend/tests/component/`, `frontend/tests/mocks/`
- Run from `frontend/`: `npm run test`, `npm run typecheck`, `npm run lint`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the module skeleton and confirm the toolchain is green before any feature work.

- [x] T001 Create the `frontend/src/modules/clients/` directory tree with empty `services/`, `hooks/`, `schemas/`, `components/`, `pages/` subfolders (mirror `frontend/src/modules/users/` layout).
- [x] T002 Verify the baseline toolchain is green before edits: run `npm run typecheck`, `npm run lint`, and `npm run test` from `frontend/` and confirm all pass on the current tree.

**Checkpoint**: Empty module structure exists; existing suite is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, RBAC helpers, the API/wire layer, query keys, and the MSW mock store that EVERY user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Create domain + error types in `frontend/src/modules/clients/types.ts`: `Client`, `ClientDraft`, `ClientsApiErrorCode`, and the `ClientsApiError` class (mirror `modules/users/types.ts`; fields per data-model.md §2/§3/§6).
- [x] T004 [P] Add RBAC helpers in `frontend/src/lib/rbac.ts`: `canViewClients(role)` (admin|manager), `canEditClients(role)` (admin|manager), `canDeleteClients(role)` (admin only). Do not modify existing users helpers.
- [x] T005 Implement the API service in `frontend/src/modules/clients/services/clients.api.ts`: `ClientWire`/`ClientCreateBodyWire`/`ClientUpdateBodyWire` types, `fromWire`/`toCreateBody`/`toUpdateBody` mappers, `fieldErrorsFromValidation`, `mapAxiosError` (401/403/404/409/422/network→codes), `list`/`get`/`create`/`update`/`remove` functions, and `CLIENTS_QUERY_KEYS` (list/detail). Depends on T003. (Per contracts/clients-frontend-contract.md.)
- [x] T006 [P] Create the MSW mock layer in `frontend/tests/mocks/clients-handlers.ts`: `seededClients` fixture (mixed company/empty-optional cases) and handlers for GET list, GET by id (404 for unknown/deleted), POST (409 on duplicate email & phone with distinct messages; 422 on invalid), PATCH (409 duplicate; 422 empty), DELETE (204; 404 if already gone); honour a role header/seam so developer→403 and manager→403-on-DELETE can be simulated.
- [x] T007 Register the clients handlers in `frontend/tests/mocks/server.ts` alongside the existing auth/users handlers.
- [x] T008 [P] Unit test the API layer in `frontend/tests/unit/clients.api.test.ts`: wire→domain mapping (snake→camel, null optionals), `toCreateBody` omits empty optionals, `toUpdateBody` is never empty, and `mapAxiosError` produces the right code for 401/403/404/409/422/network. Depends on T005.
- [x] T009 [P] Unit test RBAC in `frontend/tests/unit/rbac.clients.test.ts`: assert view/edit/delete matrix per role (admin full, manager no-delete, developer none). Depends on T004.

**Checkpoint**: Types, RBAC, API+mappers, query keys, and MSW store exist and are unit-tested. User stories can now proceed.

---

## Phase 3: User Story 1 — View and search the clients list (Priority: P1) 🎯 MVP

**Goal**: Admin/manager open `/clients`, see all active clients in a table, and filter client-side by name/company/email/phone; developers are denied; loading/empty/error states are handled.

**Independent Test**: Sign in as admin against seeded clients → `/clients` renders the table with name/company/email/phone/created columns; typing narrows rows without a network call; clear-search restores; developer → AccessDenied; slow/failed fetch → skeleton then ErrorState with retry.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [x] T010 [P] [US1] Unit test the filter in `frontend/tests/unit/useFilteredClients.test.ts`: case-insensitive substring match across name, companyName, email, phone; empty query returns all.
- [x] T011 [P] [US1] Unit test the filter schema in `frontend/tests/unit/clients-filter.schema.test.ts`: `parseFilter`/`filterToParams` round-trip for `?q=`.
- [x] T012 [P] [US1] Component test in `frontend/tests/component/ClientsListPage.test.tsx`: renders rows for admin; search narrows; search-empty state + Clear; first-run empty state (no clients) shows New-client CTA; error→retry; developer→AccessDenied; row click navigates to `/clients/:id`.

### Implementation for User Story 1

- [x] T013 [P] [US1] Create the filter schema in `frontend/src/modules/clients/schemas/clients-filter.schema.ts`: Zod `{ q }`, `DEFAULT_FILTER`, `parseFilter(URLSearchParams)`, `filterToParams` (mirror users-filter.schema.ts, q-only).
- [x] T014 [P] [US1] Create the list query hook in `frontend/src/modules/clients/hooks/useClientsList.ts`: `useQuery(CLIENTS_QUERY_KEYS.list(), staleTime 30_000, refetchOnWindowFocus: true)`. Depends on T005.
- [x] T015 [P] [US1] Create the client-side filter hook in `frontend/src/modules/clients/hooks/useFilteredClients.ts`: memoised substring filter over name/companyName/email/phone. Depends on T003.
- [x] T016 [P] [US1] Create shared state components in `frontend/src/modules/clients/components/`: `AccessDenied.tsx`, `EmptyState.tsx`, `ErrorState.tsx` (mirror the users equivalents; EmptyState supports both search-empty and first-run copy via props).
- [x] T017 [P] [US1] Create `frontend/src/modules/clients/components/RequireClientsAccess.tsx`: render `AccessDenied` when `!canViewClients(role)`, else children. Depends on T004, T016.
- [x] T018 [P] [US1] Create `frontend/src/modules/clients/components/ClientsFilters.tsx`: search input bound to URL params via the filter schema (debounce-free client filter). Depends on T013.
- [x] T019 [US1] Create `frontend/src/modules/clients/components/ClientsTable.tsx`: columns name/company/email/phone/created; row click → navigate to details; `onEdit`/`onDelete` row-action callbacks (rendered conditionally in later stories). Empty company renders an em-dash. Depends on T003.
- [x] T020 [US1] Create `frontend/src/modules/clients/pages/ClientsListPage.tsx`: wrap body in `RequireClientsAccess`; compose AppHeader + ClientsFilters + skeleton/error/empty/table states; wire `useClientsList` + `useFilteredClients`. Depends on T014–T019.
- [x] T021 [US1] Add routes in `frontend/src/routes.tsx`: `/clients` → `ClientsListPage` (and reserve `/clients/:id` for US2) under the existing `RequireAuth` children. Depends on T020.
- [x] T022 [US1] Add the "Clients" nav link in `frontend/src/modules/auth/components/AppHeader.tsx`, wrapped in `IfRole roles={["admin","manager"]}`. Depends on T004.

**Checkpoint**: US1 fully functional — list, search, RBAC, loading/empty/error states all pass; this is the MVP.

---

## Phase 4: User Story 2 — Client details with contact-info cards (Priority: P1)

**Goal**: Admin/manager open `/clients/:id` (row click or deep link) and see identity/contact/notes cards + timestamps; empty optionals show "Not provided"; developer denied; unknown/deleted id → "Client not found".

**Independent Test**: Click a row → details cards render all fields; deep-link the URL → same view; empty optionals show "Not provided"; invalid/unknown id → "Client not found" + back-link; developer → AccessDenied; slow fetch → skeleton.

### Tests for User Story 2 ⚠️

- [x] T023 [P] [US2] Component test in `frontend/tests/component/ClientDetailsPage.test.tsx`: cards render for admin; deep link works; "Not provided" placeholders; unknown id → not-found; developer → AccessDenied; loading skeleton.

### Implementation for User Story 2

- [x] T024 [P] [US2] Create the detail query hook in `frontend/src/modules/clients/hooks/useClient.ts`: `useQuery(CLIENTS_QUERY_KEYS.detail(id), { enabled })` disabled for invalid id / denied role. Depends on T005.
- [x] T025 [P] [US2] Create `frontend/src/modules/clients/components/ContactInfoCards.tsx`: Identity (name, companyName), Contact (email, phone, address), Notes cards + created/updated footer; "Not provided" for empty optionals. Depends on T003.
- [x] T026 [US2] Create `frontend/src/modules/clients/pages/ClientDetailsPage.tsx`: parse `:id`, gate via `canViewClients`, branch on invalid-id/access-denied/loading/not_found/error/success, render `ContactInfoCards` + back-link (Edit/Delete affordances added in US4/US5). Depends on T024, T025, T016.
- [x] T027 [US2] Wire `/clients/:id` → `ClientDetailsPage` in `frontend/src/routes.tsx` (replace the US1 reservation). Depends on T026.

**Checkpoint**: US1 + US2 work independently — list and deep-linkable details both pass.

---

## Phase 5: User Story 3 — Create a new client via dialog (Priority: P1)

**Goal**: Admin/manager click "New client" → dialog collects name/email/phone (+ optional company/address/notes) → Zod-validated → POST → list updates; 409 duplicate handled inline; developer sees no CTA.

**Independent Test**: Create with valid values → dialog closes, client in list, persists on reload; duplicate email/phone → field error, dialog stays open; bad email/phone → inline validation, no request; Cancel/Esc/backdrop closes without saving; developer → no "New client" affordance.

### Tests for User Story 3 ⚠️

- [x] T028 [P] [US3] Unit test in `frontend/tests/unit/client-form.schema.test.ts`: name 1–120, valid email, phone regex (accept `+1 415 555 0101`, reject no-`+`), optional max lengths; `toCreateBody` omits empty optionals. (Shared with US4; written here.)
- [x] T029 [P] [US3] Component test (create mode) in `frontend/tests/component/ClientFormDialog.test.tsx`: valid create closes + appears; 409 email/phone → field error, stays open; invalid email/phone → inline error, no request; network error → in-dialog retry, values preserved; Cancel/Esc closes; focus trap + return focus.

### Implementation for User Story 3

- [x] T030 [P] [US3] Create `frontend/src/modules/clients/schemas/client-form.schema.ts`: `ClientFormValues`, `clientFormSchema` (Zod rules from data-model.md §5, phone regex copied from backend), `emptyFormValues`, `clientToFormValues`, `toCreateBody`, `diffDraft`, `hasChanges`. Depends on T003.
- [x] T031 [P] [US3] Create the create mutation hook in `frontend/src/modules/clients/hooks/useCreateClient.ts`: `useMutation` → on success `invalidateQueries(list)`. Depends on T005.
- [x] T032 [US3] Create `frontend/src/modules/clients/components/ClientFormDialog.tsx` (create mode): RHF + zodResolver, six FormFields, phone helper text; submit calls create; map 409 conflict `detail` to email/phone field (else form-level alert); map 422 fieldErrors; loading/disabled Save; preserve values on error; dismiss via Cancel/Esc/backdrop. Depends on T030, T031.
- [x] T033 [US3] Add the "New client" affordance to `frontend/src/modules/clients/pages/ClientsListPage.tsx`, rendered for `canEditClients` roles, opening `ClientFormDialog` in create mode; also wire the first-run empty-state CTA. Depends on T032.

**Checkpoint**: US1–US3 work — operators can onboard a client end-to-end.

---

## Phase 6: User Story 4 — Edit a client via dialog (Priority: P1)

**Goal**: Admin/manager open Edit (from details or a list row) → dialog pre-filled → PATCH only changed fields → all surfaces update; 409 handled inline; no-op save closes cleanly; developer sees no Edit.

**Independent Test**: Edit company name → cards + list update without reload, persists on reload; change email to an existing one → conflict on email field, stays open; clear required name → validation error; no changes → no-op close; developer → no Edit affordance.

### Tests for User Story 4 ⚠️

- [x] T034 [P] [US4] Extend `frontend/tests/unit/client-form.schema.test.ts`: `diffDraft` emits only changed fields, emits `null` when clearing a set optional, `hasChanges` false when unchanged; `clientToFormValues` round-trip.
- [x] T035 [P] [US4] Extend `frontend/tests/component/ClientFormDialog.test.tsx` (edit mode): pre-fill; patch sends only changed field; 409 on email change → field error stays open; cleared name → validation; no-op → close without request.

### Implementation for User Story 4

- [x] T036 [P] [US4] Create the update mutation hook in `frontend/src/modules/clients/hooks/useUpdateClient.ts`: `useMutation` → on success `setQueryData(detail, updated)` + `invalidateQueries(list)` + `invalidateQueries(detail)`. Depends on T005.
- [x] T037 [US4] Extend `frontend/src/modules/clients/components/ClientFormDialog.tsx` to support `mode: "edit"` with a `client` prop: pre-fill via `clientToFormValues`, submit `diffDraft`, short-circuit no-op via `hasChanges`, reuse 409/422 handling. Depends on T032, T036.
- [x] T038 [P] [US4] Add an Edit affordance + dialog wiring to `frontend/src/modules/clients/pages/ClientDetailsPage.tsx`, rendered for `canEditClients` roles. Depends on T037.
- [x] T039 [US4] Add a per-row Edit action to `frontend/src/modules/clients/components/ClientsTable.tsx` and wire it from `ClientsListPage.tsx`, rendered for `canEditClients` roles. Depends on T037, T019.

**Checkpoint**: US1–US4 work — full create + edit lifecycle reflected across list and details.

---

## Phase 7: User Story 5 — Delete a client (admin only) via confirmation (Priority: P2)

**Goal**: Admin triggers Delete (details or row) → confirmation dialog → DELETE → client gone from list, details → "Client not found"; managers/developers never see the affordance.

**Independent Test**: Admin delete from details → returns to list, client gone; revisit its URL → "Client not found"; delete from a row → stays on the (shorter) list; Cancel/Esc aborts; network error → retry-able, client not removed; manager/developer → no Delete affordance in the DOM.

### Tests for User Story 5 ⚠️

- [x] T040 [P] [US5] Component test in `frontend/tests/component/DeleteClientDialog.test.tsx`: admin confirm → removes + closes; Cancel/Esc aborts; network error → retry-able, not removed; manager/developer → affordance absent from DOM.

### Implementation for User Story 5

- [x] T041 [P] [US5] Create the delete mutation hook in `frontend/src/modules/clients/hooks/useDeleteClient.ts`: `useMutation` → on success `invalidateQueries(list)` + `removeQueries(detail)`. Depends on T005.
- [x] T042 [US5] Create `frontend/src/modules/clients/components/DeleteClientDialog.tsx`: confirmation naming the client; loading/disabled confirm; network error in-dialog; on success close. Depends on T041.
- [x] T043 [US5] Wire Delete into `ClientDetailsPage.tsx` (wrapped in `IfAdmin`; on success navigate back to `/clients`). Depends on T042.
- [x] T044 [US5] Wire a per-row Delete action into `ClientsTable.tsx` + `ClientsListPage.tsx`, wrapped in `IfAdmin` (DOM-absent for non-admins); on success stay on the list. Depends on T042, T019.

**Checkpoint**: US1–US5 work — full CRUD with guarded, admin-only delete.

---

## Phase 8: User Story 6 — RBAC-aware navigation and affordances (Priority: P1)

**Goal**: Verify and lock in role-correct chrome and affordances end-to-end: nav link, page gates, New/Edit (admin+manager), Delete (admin only), session-expiry redirect, cross-tab role-change re-render.

**Independent Test**: For each of admin/manager/developer: nav link present/absent per matrix; `/clients` and `/clients/:id` deep links → list / AccessDenied; New/Edit/Delete affordances per role; expired session → login redirect preserving URL; role demoted in another tab → Delete disappears without reload.

### Tests for User Story 6 ⚠️

- [x] T045 [P] [US6] Component test in `frontend/tests/component/AppHeader.clients.test.tsx`: Clients link present for admin & manager, absent for developer.
- [x] T046 [P] [US6] Component test in `frontend/tests/component/RequireClientsAccess.test.tsx`: renders children for admin/manager, AccessDenied for developer.
- [x] T047 [P] [US6] Component test in `frontend/tests/component/ClientsList.session-expiry.test.tsx`: a 401 on a clients request clears the session and redirects to login with the URL preserved (mirror the users session-expiry test).

### Implementation for User Story 6

- [x] T048 [US6] Audit and finalize affordance gating across `ClientsListPage.tsx`, `ClientDetailsPage.tsx`, `ClientsTable.tsx`: confirm New/Edit use `canEditClients` (admin+manager) and Delete uses `IfAdmin` (DOM-absent otherwise); confirm developer is fully gated. Fix any leaks surfaced by T045–T047. Depends on T020, T026, T039, T044.

**Checkpoint**: All six stories pass; RBAC is provably correct across roles.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality, accessibility, and final validation across all stories.

- [x] T049 [P] Accessibility pass on all dialogs (`ClientFormDialog`, `DeleteClientDialog`): labelled fields, `role="alert"` on form-level errors, focus trap + focus-return, Esc/backdrop dismissal; confirm screen-reader announcements on open/close and success/failure (SC-008).
- [x] T050 [P] Responsive + UI consistency pass: table and cards across breakpoints; skeletons (not bare spinners) on list and details; verify styling matches the users dashboard.
- [x] T051 Run `npm run typecheck` and `npm run lint` from `frontend/`; resolve any `any`/lint issues (constitution: no implicit `any`).
- [x] T052 Run the full `npm run test` suite and ensure all clients unit + component tests pass alongside the existing suite.
- [ ] T053 Execute the `quickstart.md` manual verification across admin/manager/developer and check off the Definition of Done.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **User Stories (Phases 3–8)**: all depend on Foundational. US1 is the MVP. US2/US3 depend only on Foundational (independently testable). US4 reuses US3's dialog (T032). US5 reuses the table/details shells (US1/US2). US6 audits the chrome built across US1–US5.
- **Polish (Phase 9)**: depends on all targeted stories.

### Story dependency notes

- **US1 (P1)**: Foundational only → MVP.
- **US2 (P1)**: Foundational only (adds details + `useClient`).
- **US3 (P1)**: Foundational only (adds form schema + create dialog).
- **US4 (P1)**: extends US3's `ClientFormDialog` (T032) → start US4 after T032.
- **US5 (P2)**: needs US1 table (T019) + US2 details (T026) shells for affordance placement.
- **US6 (P1)**: integration audit over US1–US5; its tests (T045–T047) can be written anytime after Foundational.

### Within each story

- Tests written first and failing → schemas/hooks (often [P]) → components → page wiring → routing/nav.
- Models/types before services; services before hooks; hooks before components; components before pages.

---

## Parallel Opportunities

- **Foundational**: T003 [P] + T004 [P] + T006 [P] together; then T005 (needs T003); T008/T009 [P] after their deps.
- **US1**: T010/T011/T012 [P] (tests) together; T013/T014/T015/T016/T017/T018 [P] together (distinct files); T019→T020→T021/T022.
- **US2**: T024 [P] + T025 [P] together; then T026→T027.
- **US3**: T028 [P] + T029 [P] (tests); T030 [P] + T031 [P]; then T032→T033.
- **US4**: T034 [P] + T035 [P]; T036 [P]; then T037→T038[P]/T039.
- **US5**: T040 [P]; T041 [P]; then T042→T043/T044.
- **US6**: T045/T046/T047 [P] together; then T048.
- **Polish**: T049 [P] + T050 [P]; then T051→T052→T053.

### Parallel Example: User Story 1

```bash
# Tests for US1 (write first, expect fail):
Task: "Unit test filter in frontend/tests/unit/useFilteredClients.test.ts"
Task: "Unit test filter schema in frontend/tests/unit/clients-filter.schema.test.ts"
Task: "Component test list page in frontend/tests/component/ClientsListPage.test.tsx"

# Independent building blocks for US1 (distinct files):
Task: "Filter schema in frontend/src/modules/clients/schemas/clients-filter.schema.ts"
Task: "useClientsList hook in frontend/src/modules/clients/hooks/useClientsList.ts"
Task: "useFilteredClients hook in frontend/src/modules/clients/hooks/useFilteredClients.ts"
Task: "State components (AccessDenied/EmptyState/ErrorState) in frontend/src/modules/clients/components/"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & validate** the list + search + RBAC + states → demo.

### Incremental Delivery

Foundation → US1 (MVP: list) → US2 (details) → US3 (create) → US4 (edit) → US5 (delete) → US6 (RBAC audit) → Polish. Each story is an independently testable, deployable increment that does not break the previous ones.

### Parallel Team Strategy

After Foundational: Dev A → US1, Dev B → US2, Dev C → US3 (then US4 once T032 lands). US5/US6 integrate after the list/details/dialog shells exist.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- `[Story]` labels (US1–US6) trace each task to its spec user story.
- Mirror `frontend/src/modules/users/` patterns throughout; reuse `frontend/tests/helpers/renderWithProviders.tsx` and MSW `server.ts`.
- Verify each story's tests fail before implementing; commit after each task or logical group.
- The shared `ClientFormDialog` is built in US3 (create) and extended in US4 (edit) — do not duplicate it.
- Total: 53 tasks. By story — Foundational: 7 (T003–T009); US1: 13; US2: 5; US3: 6; US4: 6; US5: 5; US6: 4; Setup: 2; Polish: 5.

# Feature Specification: Client Management Dashboard (Frontend)

**Feature Branch**: `011-clients-dashboard`
**Created**: 2026-06-13
**Status**: Draft
**Input**: User description:

> Build client management UI.
>
> Pages:
> - Clients list
> - Client details
> - Create/edit client
>
> Features:
> - Client table
> - Search/filter
> - Contact info cards
> - CRUD dialogues

## Context

The backend `004-clients-management` slice already owns the `Client` entity and the wire contract: `POST /clients`, `GET /clients`, `GET /clients/{id}`, `PATCH /clients/{id}`, `DELETE /clients/{id}`. Its `contracts/openapi.yaml` and `contracts/access-control-matrix.md` are the source of truth for field shapes, validation rules, error codes, and RBAC. The `009-auth-ui` MVP established the frontend foundation (Axios `http`, Zustand `session.store`, TanStack Query, React Router with `RequireAuth`, shadcn primitives, role-based navigation, and a 401 interceptor), and `010-users-dashboard` established the dashboard pattern (list + detail + edit-via-dialog, client-side search/filter, RBAC-aware chrome). This feature is the **frontend** client-management dashboard layered on top of those slices. It introduces **no backend changes**.

Two RBAC facts from the backend shape every story below and differ from the users dashboard:

1. **Developers have no access to any client endpoint** — there is no "view my own" carve-out. A developer must never see the Clients link, the list, or any client record.
2. **Both admin and manager can create, view, and edit clients; only admin can delete.** This is broader write access than the users dashboard (where only admin could edit), so create/edit affordances are visible to managers too — but delete is admin-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View and search the clients list (Priority: P1)

An authenticated admin or manager opens the Clients page from the app navigation, sees every active client in a sortable table, and can quickly narrow the list by free-text search across name, email, company, and phone. A developer opening the same URL is denied entirely.

**Why this priority**: Without a readable list, every downstream workflow (open a client, edit contact details, onboard a new client, eventually pick a client when creating a project) is impossible. It is the smallest end-to-end slice that delivers value, and every other story in this feature starts from this list.

**Independent Test**: Sign in as admin against a seeded dataset of 5+ clients, open `/clients`, and confirm the table renders all active clients with the correct columns. Type a partial company name into the search box and confirm the list narrows. Sign in as manager and confirm the same list renders. Sign in as developer and confirm the page is blocked with an "Access denied" state and no client data is shown.

**Acceptance Scenarios**:

1. **Given** an admin session and at least three active clients exist, **When** the admin navigates to the Clients page, **Then** a table renders one row per client showing name, company name, email, phone, and the date the client was created.
2. **Given** the same setup, **When** a manager navigates to the Clients page, **Then** the same table renders (managers may view).
3. **Given** a developer session, **When** the developer navigates to the Clients page (via URL or any link), **Then** the page shows an "Access denied" state and never lists any client.
4. **Given** the clients table is showing 20+ rows, **When** the user types "acme" into the search box, **Then** the visible rows narrow to those whose name, company name, email, or phone contains "acme" (case-insensitive), updating without a page reload.
5. **Given** an empty filter result (no rows match), **When** the table re-renders, **Then** a friendly empty state explains "No clients match your search" and offers a "Clear search" action.
6. **Given** no clients exist at all, **When** the page loads, **Then** a first-run empty state explains "No clients yet" and (for admin/manager) offers a "New client" call to action.
7. **Given** the page is loading from a slow backend, **When** the data has not arrived after 200 ms, **Then** a skeleton/loading state is visible — the user is never shown a flicker of empty content followed by data.
8. **Given** the backend returns an error or the network drops, **When** the user opens the page, **Then** an inline error state explains the failure and offers "Try again" that retries the fetch without reloading the page.

---

### User Story 2 — Open a client's details with contact info cards (Priority: P1)

An admin or manager clicks a row in the clients table (or navigates directly to `/clients/<id>`) and is taken to a details page that shows that client's full record organised into readable contact-info cards: an identity card (name, company), a contact card (email, phone, address), and a notes card. The page is read-only here — edits happen through US4 and deletion through US5.

**Why this priority**: The list answers "who are our clients?" The details page answers "how do I reach this client and what do I know about them?" Operators need this when confirming contact details before reaching out, reviewing notes before a kickoff, or verifying a record before editing or deleting it. P1 because every edit and delete flow starts from "I am looking at this client and want to act on it."

**Independent Test**: Sign in as admin, click any client row in the list, and confirm the URL changes to `/clients/<id>` and contact-info cards render the client's name, company, email, phone, address, notes, and created/updated timestamps. Visit `/clients/<id>` directly (deep link) and confirm the same view loads. Sign in as developer and confirm the page is blocked.

**Acceptance Scenarios**:

1. **Given** an admin session and a known client id, **When** the admin clicks that client's row in the table, **Then** the URL becomes `/clients/<id>` and a details view renders contact-info cards showing name, company name, email, phone, address, notes, and created/updated timestamps.
2. **Given** the same session, **When** the admin opens `/clients/<id>` as a deep link (without going through the list), **Then** the same details view renders.
3. **Given** a manager session, **When** the manager opens any client's details, **Then** the same cards render (managers may view and, per US4, edit — but not delete).
4. **Given** a developer session, **When** the developer opens `/clients/<id>` for any id, **Then** an "Access denied" state renders and no client data is shown.
5. **Given** an admin session, **When** the admin opens `/clients/<id>` for an id that does not exist or was soft-deleted, **Then** a "Client not found" state renders with a link back to the list.
6. **Given** a client whose optional fields (company name, address, notes) are empty, **When** the details page renders, **Then** each empty field shows a clear "Not provided" placeholder rather than a blank gap.
7. **Given** the details page is loading, **When** the data has not arrived after 200 ms, **Then** a skeleton state is visible in the cards.

---

### User Story 3 — Create a new client via dialog (Priority: P1)

An admin or manager clicks "New client" from the list page, fills a dialog with the client's name, email, phone, and optional company name, address, and notes, and saves. The dialog validates client-side, sends the create request, and on success closes itself and the new client appears in the list immediately.

**Why this priority**: Onboarding a new client is the gating step before any project can be opened against them. Without create, the dashboard is read-only over whatever was seeded directly in the database — exactly the unsafe path the backend slice was built to remove. P1 because client onboarding is a primary operator workflow and both admin and manager need it.

**Independent Test**: Sign in as admin, click "New client", fill name/email/phone with valid values, and save. Confirm the dialog closes, the new client appears in the list, and a page reload still shows it (i.e. it was persisted). Submit a duplicate email and confirm the dialog stays open with a "client with this email already exists" message. Sign in as manager and confirm the same flow works. Sign in as developer and confirm no "New client" affordance exists.

**Acceptance Scenarios**:

1. **Given** an admin or manager viewing the clients list, **When** they click "New client", **Then** a dialog opens with empty fields for name, email, phone, company name, address, and notes, with name/email/phone marked required.
2. **Given** the create dialog is open, **When** the user fills name, email, and phone with valid values and clicks Save, **Then** the dialog sends the create request, shows a loading state on the Save button (disabled, spinner), closes on success, and the new client appears in the list without a full page reload.
3. **Given** the create dialog is open, **When** the user leaves a required field empty and clicks Save, **Then** a field-level validation error appears beneath that field and no request is sent.
4. **Given** the create dialog is open, **When** the user enters a malformed email and clicks Save, **Then** a field-level error explains the email is invalid and no request is sent.
5. **Given** the create dialog is open, **When** the user enters a phone that is not in international format (must start with `+` and a country code) and clicks Save, **Then** a field-level error explains the required format and no request is sent.
6. **Given** the create dialog is open, **When** the user submits an email or phone that already belongs to an active client, **Then** the dialog stays open and surfaces the server-supplied conflict message ("client with this email already exists" / "client with this phone already exists") against the relevant field, preserving the entered values.
7. **Given** the create dialog is open and the network drops, **When** the user clicks Save, **Then** a generic retry-able error appears inside the dialog, the dialog stays open, and all entered values are preserved.
8. **Given** the create dialog is open, **When** the user clicks Cancel, presses Escape, or clicks the backdrop, **Then** the dialog closes without sending any request and no client is created.

---

### User Story 4 — Edit a client via dialog (Priority: P1)

An admin or manager opens the Edit dialog from the details page (or from a row action in the list), updates one or more of name, email, phone, company name, address, and notes, and saves. The dialog validates client-side, sends only the changed fields, and on success closes and every surface reflects the new values immediately.

**Why this priority**: Client data drifts — companies rename, contacts change phones, offices move. Without edit, correcting a record requires a direct DB write. P1 because keeping client contact details correct is a core operator responsibility, and both admin and manager are entrusted with it.

**Independent Test**: Sign in as admin, open any client's details, click "Edit", change the company name, and save. Confirm the dialog closes, the details cards reflect the new value, and a reload still shows it. Change the email to one already used by another client and confirm the dialog stays open with a conflict message. Sign in as manager and confirm the edit flow works; sign in as developer and confirm no edit affordance exists.

**Acceptance Scenarios**:

1. **Given** an admin or manager viewing a client's details, **When** they click "Edit", **Then** a dialog opens pre-filled with the client's current name, email, phone, company name, address, and notes.
2. **Given** the edit dialog is open, **When** the user changes the company name to a valid value and clicks Save, **Then** the dialog sends a patch containing only the changed field, shows a loading state on Save, closes on success, and the details page + list both reflect the new value without a page reload.
3. **Given** the edit dialog is open, **When** the user clears the name (a required field) and clicks Save, **Then** a field-level validation error appears and no request is sent.
4. **Given** the edit dialog is open, **When** the user changes the email to one already used by another active client and saves, **Then** the dialog stays open and surfaces "client with this email already exists" against the email field, preserving entered values. (Same rule for phone.)
5. **Given** the edit dialog is open, **When** the user makes no changes and clicks Save, **Then** the dialog either disables Save until a field changes or surfaces the backend's "no fields to update" response inline without closing.
6. **Given** the edit dialog is open and the network drops, **When** the user clicks Save, **Then** a generic retry-able error appears inside the dialog, the dialog stays open, and all entered values are preserved.
7. **Given** the edit dialog is open, **When** the user clicks Cancel, presses Escape, or clicks the backdrop, **Then** the dialog closes without sending any request and no values change.
8. **Given** any create or edit dialog is open, **When** focus enters the dialog, **Then** keyboard focus is trapped inside it until it closes, and focus returns to the element that opened it.

---

### User Story 5 — Delete a client (admin only) via confirmation (Priority: P2)

An admin opens the delete action from a client's details page (or a row action in the list), confirms in a guarded confirmation dialog, and the client is soft-deleted — disappearing from the list and detail views. Managers and developers never see a delete affordance.

**Why this priority**: P2 (not P1) because the dashboard is fully usable for onboarding and maintaining clients without delete; deletion only becomes critical once a client offboards. It is also the most destructive action, so it ships behind a confirmation and is gated to admins only — matching the backend's admin-only DELETE.

**Independent Test**: Sign in as admin, open a client's details, click "Delete", confirm in the dialog, and verify the client disappears from the list and that visiting its `/clients/<id>` afterwards shows "Client not found". Sign in as manager and confirm no delete affordance is rendered anywhere.

**Acceptance Scenarios**:

1. **Given** an admin viewing a client's details, **When** they click "Delete", **Then** a confirmation dialog opens naming the client and warning the action removes them from the active list.
2. **Given** the confirmation dialog is open, **When** the admin confirms, **Then** the delete request is sent with a loading state, the dialog closes on success, the user is returned to the list, and the deleted client is absent from the list.
3. **Given** the deleted client, **When** anyone navigates to its `/clients/<id>`, **Then** a "Client not found" state renders (consistent with the backend's soft-delete returning 404).
4. **Given** the confirmation dialog is open, **When** the admin clicks Cancel or presses Escape, **Then** the dialog closes and the client is not deleted.
5. **Given** a manager or developer session, **When** they view a client's details or a list row, **Then** no "Delete" affordance is rendered at all (the control does not exist in the DOM — it is not merely disabled).
6. **Given** the confirmation dialog is open and the network drops, **When** the admin confirms, **Then** a retry-able error appears in the dialog and the client is not removed from the list.

---

### User Story 6 — RBAC-aware navigation and affordances (Priority: P1)

The application chrome (sidebar / top navigation) only renders the link to the Clients page for roles that can use it (admin, manager). Inside the feature, create and edit affordances render for admin and manager; delete renders for admin only. Developers never see the Clients link, the list page, or any client record.

**Why this priority**: This is what lets the feature ship to the whole user base without breaking least privilege. Without it, developers see UI that 403s on click, and managers see a delete button they cannot use. P1 because it is the gate that makes the dashboard safe and coherent for all three roles.

**Independent Test**: Sign in as each of admin, manager, developer in turn. In each session: (a) check the Clients link is/is not in the navigation per the matrix below, (b) check deep-linking to `/clients` and `/clients/<id>` produces the expected result (list / access-denied), (c) check that New/Edit/Delete affordances render per role.

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the app renders, **Then** the navigation contains a "Clients" link; the `/clients` page renders the full table with "New client", per-row "Edit", and per-row/detail "Delete" affordances; the details page exposes "Edit" and "Delete".
2. **Given** a manager session, **When** the app renders, **Then** the navigation contains a "Clients" link; the `/clients` page renders the full table with "New client" and "Edit" affordances but NO "Delete" affordance; the details page exposes "Edit" but not "Delete".
3. **Given** a developer session, **When** the app renders, **Then** the navigation does NOT contain a "Clients" link, and deep-linking to `/clients` or `/clients/<id>` shows an "Access denied" state with no client data.
4. **Given** a user whose session expires while on a Clients page, **When** they next interact in a way that triggers a request (open a client, save a dialog, retry a fetch), **Then** they are redirected to login with a "session ended" notice and the URL they were on is preserved so they return there after signing in.
5. **Given** a user whose role changes in another tab (e.g. admin demoted to manager), **When** the next interaction occurs in this tab, **Then** the navigation and affordances re-render against the new role without a full page reload (the "Delete" affordance disappears for the demoted admin).

---

### Edge Cases

- **Large client lists**: The first iteration assumes the backend returns the full active list and the client filters in memory. If client counts grow past a few thousand, server-side pagination becomes a follow-up feature.
- **Concurrent edits**: Two operators open the same client; one saves a phone change, the second saves a company-name change moments later — the second save wins for company name and leaves phone as the second editor last saw it, because the dialog sends only fields the user changed. The UI does not warn about concurrent edits in this iteration.
- **Duplicate against a soft-deleted client**: The backend's uniqueness check runs only against active rows, so reusing the email/phone of a previously deleted client is allowed; the create dialog must not pre-empt this with a false client-side block.
- **Phone format**: The backend requires an international format (leading `+`, 1–3 digit country code). The dialog validates this shape client-side before sending and surfaces the same requirement in helper text; it does NOT silently reformat what the user typed.
- **Email casing**: The backend lowercases and trims email on write. The UI should display the stored (normalised) value returned by the backend rather than echoing the raw input after a successful save.
- **Search debounce**: Rapid typing filters the visible rows on each keystroke (client-side) and never refetches the list from the backend.
- **Deleting from the list vs the details page**: A delete confirmed from a list row keeps the user on the (now shorter) list; a delete confirmed from the details page returns the user to the list. Either way the deleted client is gone from the active list.
- **Empty optional fields**: Company name, address, and notes are optional; the details cards render a "Not provided" placeholder and the table renders an em-dash for missing company name rather than blank cells.
- **Deep link to a deleted client**: Visiting `/clients/<id>` for a soft-deleted id renders "Client not found" (the backend returns 404 for soft-deleted ids).

## Requirements *(mandatory)*

### Functional Requirements

#### Clients list page

- **FR-001**: The Clients list page MUST display every active client the current session is allowed to see — admin and manager see all active clients; developers are denied entry to the page entirely.
- **FR-002**: Each row MUST show the client's name, company name, email, phone, and the date the client was created; a missing optional field MUST render a placeholder rather than a blank cell.
- **FR-003**: The page MUST provide a free-text search input that filters the visible rows by case-insensitive substring match against name, company name, email, and phone.
- **FR-004**: Filtering MUST happen client-side — typing into search MUST NOT trigger a network request.
- **FR-005**: The page MUST render a skeleton/loading state while the list is fetched, a search-empty state when the filter narrows results to zero (with a "Clear search" affordance), a first-run empty state when no clients exist at all (with a "New client" call to action for admin/manager), and an inline error state with a "Try again" action when the fetch fails.
- **FR-006**: The page MUST cache the fetched list and reuse it on revisits within the freshness window so the page renders instantly on the second visit, and MUST refresh the data when the window regains focus.
- **FR-007**: Clicking any row MUST navigate to the corresponding client details page (`/clients/<id>`).

#### Client details page

- **FR-008**: The details page at `/clients/<id>` MUST display the targeted client's full record organised as contact-info cards: identity (name, company name), contact (email, phone, address), and notes, plus created and updated timestamps.
- **FR-009**: Empty optional fields (company name, address, notes) MUST render a clear "Not provided" placeholder.
- **FR-010**: The page MUST permit access according to the backend rules (admin and manager may view; developers are denied) and MUST render an "Access denied" state for developers rather than any client data.
- **FR-011**: When `<id>` does not correspond to an existing active client (never existed or soft-deleted), the page MUST render a "Client not found" state with a link back to the list.
- **FR-012**: The details page MUST be reachable by deep link, not just by clicking a row.

#### Create client dialog

- **FR-013**: An admin or manager (and only those roles) MUST be able to open a "New client" dialog from the list page.
- **FR-014**: The dialog MUST collect name, email, phone (all required) and company name, address, notes (all optional), matching the backend `ClientCreate` schema.
- **FR-015**: The dialog MUST validate client-side that name is non-empty, email is syntactically valid, and phone matches the required international format before submitting; invalid input MUST surface inline field-level errors and MUST NOT result in a network request.
- **FR-016**: On a duplicate email or phone (409 from the backend), the dialog MUST stay open and surface the server-supplied message against the relevant field, preserving entered values.
- **FR-017**: On success, the dialog MUST close and the new client MUST appear in the list without a full page reload.

#### Edit client dialog

- **FR-018**: An admin or manager (and only those roles) MUST be able to open an "Edit" dialog from the details page and from each row in the list.
- **FR-019**: The dialog MUST allow editing name, email, phone, company name, address, and notes, pre-filled with current values, and MUST send only the fields that were actually changed (matching the backend `ClientUpdate` semantics, where an empty patch is rejected with 422).
- **FR-020**: The dialog MUST apply the same client-side validation as create (non-empty name, valid email, valid phone format) and MUST surface duplicate-email/phone conflicts (409) inline without closing.
- **FR-021**: On success, the dialog MUST close and the changed values MUST be reflected wherever they are visible (the details page and the list) without a full page reload.

#### Delete client confirmation

- **FR-022**: An admin (and only an admin) MUST be able to trigger client deletion from the details page and from each list row; the delete affordance MUST NOT exist in the DOM for managers or developers.
- **FR-023**: Deletion MUST require an explicit confirmation step (a confirmation dialog naming the client) before any request is sent.
- **FR-024**: On confirmed deletion success, the client MUST disappear from the active list, a subsequent visit to its details page MUST show "Client not found", and the user MUST be returned to the list when deleting from the details page.

#### Shared dialog behaviour

- **FR-025**: While any create/edit/delete request is in flight, the primary action button MUST show a loading state and be disabled so a second click cannot fire a duplicate request.
- **FR-026**: On a network failure inside any dialog, the dialog MUST render a generic retry-able error, MUST stay open, and MUST preserve all user-entered values.
- **FR-027**: Every dialog MUST be dismissable by Cancel, Escape, or backdrop click without sending a request, MUST trap keyboard focus while open, and MUST return focus to the element that opened it on close.

#### RBAC-aware UI

- **FR-028**: The application navigation MUST render the "Clients" link only for admin and manager sessions.
- **FR-029**: Create and Edit affordances MUST render for admin and manager only; Delete affordances MUST render for admin only. Affordances a role cannot use MUST NOT exist in the DOM (not merely be disabled) for that role.
- **FR-030**: When the current session loses authentication mid-page (a request returns 401), the user MUST be redirected to login with a "session ended" notice, and the URL they were on MUST be preserved so they return there after signing in.
- **FR-031**: When the current session's role changes (e.g. an admin is demoted in another tab), the navigation and affordances on this page MUST re-render against the new role without a full page reload.

### Key Entities

- **Client**: Identifier, name, email, phone, optional company name, address, notes, active/inactive flag, creation timestamp, update timestamp. Source of truth is the backend `004-clients-management` slice; the frontend is a read-and-edit window only. Soft-deleted (inactive) clients are invisible to the UI.
- **ClientsFilter** (client-only): The active free-text search term for the list, kept in the URL query string so a filtered list is shareable/restorable by deep link.
- **ClientDraft** (client-only): The pending field set inside a create or edit dialog. For create it is a full `ClientCreate` body; for edit it is a partial of `Client` containing only the fields the operator has touched, sent as the patch body.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin or manager can find a specific client in a directory of 100+ clients in under 5 seconds (open the page → type a partial name/company → click the row).
- **SC-002**: 95% of clients-list visits render a usable view (table or skeleton — never a blank flash) within 1 second on a typical broadband connection.
- **SC-003**: An admin or manager can onboard a new client (open Clients → New client → fill name/email/phone → save) in under 60 seconds, and the new client is visible in the list without a manual refresh.
- **SC-004**: An admin or manager can correct a client's contact detail (open client → Edit → change field → save) in under 30 seconds, and the change is visible on every surface that shows that client without a manual refresh.
- **SC-005**: 100% of creates and edits performed through the dialogs are persisted (verified by a page reload landing on the new values), and 100% of duplicate-email/phone attempts surface an inline conflict message without losing entered input.
- **SC-006**: Managers and developers never see UI affordances they cannot exercise — managers never see a Delete control, developers never see the Clients link or any client data — yielding zero "click → 403" surprises in normal navigation.
- **SC-007**: When the backend is unreachable, 100% of error states display a "Try again" affordance (list) or a retry-able in-dialog error (create/edit/delete) that recovers without a page reload once connectivity returns.
- **SC-008**: Keyboard-only users can complete every flow (open list, search, open details, open create/edit dialog, save, cancel, confirm delete) without a mouse, and screen-reader users hear announcements when dialogs open/close and when an action succeeds or fails.

## Assumptions

- The backend `004-clients-management` slice is deployed and the wire contract in its `contracts/openapi.yaml` and `contracts/access-control-matrix.md` is stable. Field names, validation rules (email format, phone format, max lengths), and error codes (401/403/404/409/422) are pulled from there.
- The `009-auth-ui` foundation is in place: `RequireAuth`, session store, `http` interceptor for 401, role selectors, and cross-tab `storage` sync; and the `010-users-dashboard` dashboard patterns (table + detail + dialog) are available to mirror.
- **Create and edit happen in modal dialogs**, not standalone full-page routes. The user prompt lists "Create/edit client" under Pages and "CRUD dialogues" under Features; this spec reconciles the two by treating the create/edit surface as dialogs launched from the list and details pages, consistent with the established `010-users-dashboard` modal pattern. (If standalone create/edit routes are later required, that is a follow-up.)
- The current client count fits comfortably in a single response (low hundreds). If the directory grows past a few thousand, server-side pagination becomes a follow-up feature.
- The phone field uses the backend's international-format requirement (leading `+`, 1–3 digit country code); the UI validates this shape but does not perform full phone normalisation (the backend explicitly defers that too).
- Email is editable from this surface (unlike the users dashboard, where it was locked), because the backend `PATCH /clients/{id}` accepts an email change subject to the same uniqueness rules.
- Restoration of a soft-deleted client is out of scope (the backend offers no restore endpoint); deletion is one-way through the UI.

## Out of Scope

- Any backend change — this feature consumes the existing `004-clients-management` contract unchanged.
- Bulk operations (multi-select rows, bulk delete).
- Restoring or hard-deleting a client (the backend exposes only soft delete and no restore).
- Export to CSV.
- Server-side pagination, sorting, or filtering — the first iteration filters client-side over a single fetched list.
- Linking clients to projects, invoices, or payments (those modules are separate features; the client picker that the projects module will need is part of that feature, not this one).
- An audit log surface (who created/edited/deleted which client and when).
- Server-side or column-based sorting controls beyond the default order returned by the backend.

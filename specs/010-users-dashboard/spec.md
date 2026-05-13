# Feature Specification: Users Management Dashboard (Frontend)

**Feature Branch**: `010-users-dashboard`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description:

> Build users management dashboard.
>
> Pages:
> - Users list
> - User profile
> - Edit user modal
>
> Features:
> - User table
> - Search/filter
> - Role badges
> - Profile management
> - RBAC-aware UI

## Context

The backend `003-users-management` slice already owns the `User` entity and the wire contract: `GET /users/me`, `GET /users`, `GET /users/{id}`, `PATCH /users/{id}`, `PATCH /users/{id}/status`, `GET /users/developers`. The `009-auth-ui` MVP already established the frontend foundation (Axios `http`, Zustand `session.store`, TanStack Query, React Router with `RequireAuth`, shadcn primitives, and a placeholder authenticated landing). This feature is the **frontend** users-management dashboard layered on top of those two slices. It introduces no backend changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View and search the users list (Priority: P1)

An authenticated admin or manager opens the Users page from the app navigation, sees every user in a sortable table with a role badge per row, and can quickly narrow the list by name/email and by role. A developer opening the same URL is denied — they only ever see themselves elsewhere in the app.

**Why this priority**: Without a readable list, the admin and manager workflows that motivate this feature (find a developer to assign, audit who has manager rights, spot inactive accounts) are impossible. Every later flow (open a profile, edit a user) starts from this list, so it is the smallest end-to-end slice that delivers value.

**Independent Test**: Sign in as admin against a seeded dataset of 5+ users with mixed roles and statuses, open `/users`, and confirm the table renders all users with the correct columns, role badges, and active/inactive treatment. Type a partial name into the search box and confirm the list narrows. Sign in as developer and confirm the page is blocked with an unauthorized state.

**Acceptance Scenarios**:

1. **Given** an admin session and at least three users exist, **When** the admin navigates to the Users page, **Then** a table renders with one row per user showing name, email, role badge, status (active/inactive), and the date the account was created.
2. **Given** the same setup, **When** a manager navigates to the Users page, **Then** the same table renders (managers may view).
3. **Given** a developer session, **When** the developer navigates to the Users page (via URL or any link), **Then** the page shows an "Access denied" state and never lists other users.
4. **Given** the users table is showing 20+ rows, **When** the user types "ada" into the search box, **Then** the visible rows narrow to those whose name or email contains "ada" (case-insensitive), with results updating without a page reload.
5. **Given** the table is rendered, **When** the user selects "Role: manager" from the role filter, **Then** only manager rows remain visible.
6. **Given** an empty filter result (no rows match), **When** the table re-renders, **Then** a friendly empty state explains "No users match these filters" and offers a "Clear filters" action.
7. **Given** the page is loading from a slow backend, **When** the data has not arrived after 200 ms, **Then** a skeleton/loading state is visible — the user is never shown a flicker of empty content followed by data.
8. **Given** the backend returns an error or the network drops, **When** the user opens the page, **Then** an inline error state explains the failure and offers "Try again" that retries the fetch without reloading the page.

---

### User Story 2 — Open a user profile (Priority: P1)

An admin or manager clicks a row in the users table (or navigates directly to `/users/<id>`) and is taken to a profile page that shows that user's full record: name, email, role, status, created/updated timestamps, and (if present) developer-related metadata. The profile is read-only here — edits happen through US3.

**Why this priority**: The list answers "who is in the system?" The profile answers "what do I know about this person?" Admins and managers need this when auditing role grants, investigating a manager's promotion history, or simply confirming that a developer's contact details look right before assigning them work. P1 because every edit flow in US3 starts from "I am looking at this person and want to change something."

**Independent Test**: Sign in as admin, click any user row in the list, and confirm the URL changes to `/users/<id>` and a profile card renders the same fields the table showed, plus `updated_at` and any developer metadata. Visit `/users/<id>` directly (deep link) and confirm the same view loads. Sign in as developer and confirm the page is blocked unless `<id>` is the developer's own id (in which case the page renders their own profile).

**Acceptance Scenarios**:

1. **Given** an admin session and a known user id, **When** the admin clicks that user's row in the table, **Then** the URL becomes `/users/<id>` and a profile view renders the user's name, email, role badge, status, created/updated timestamps, and any developer-related metadata.
2. **Given** the same session, **When** the admin opens `/users/<id>` as a deep link (without going through the list), **Then** the same profile view renders.
3. **Given** a manager session, **When** the manager opens any user's profile, **Then** the view renders the same fields (read-only for managers — edit affordances are hidden per US4).
4. **Given** a developer session, **When** the developer opens `/users/<their-own-id>`, **Then** the profile view renders their own record.
5. **Given** a developer session, **When** the developer opens `/users/<other-id>`, **Then** an "Access denied" state renders and no other user's data is shown.
6. **Given** an admin session, **When** the admin opens `/users/<id>` for an id that does not exist, **Then** a "User not found" state renders with a link back to the list.
7. **Given** the profile is loading, **When** the data has not arrived after 200 ms, **Then** a skeleton state is visible in the profile card.

---

### User Story 3 — Edit a user via modal (Priority: P1)

An admin opens the Edit user modal from the profile page (or directly from a row action in the list), updates one or more of `name`, `role`, and `is_active`, and saves. The modal validates the input client-side, sends the change to the backend, and on success closes itself and the row/profile reflects the new values immediately.

**Why this priority**: This is the only path by which an admin can promote a developer, demote a manager, or deactivate a departing employee through the UI. Without it, role changes require a direct DB write — exactly the unsafe path the backend slice was built to remove. P1 because admin workflows are blocked without it; managers and developers don't get this affordance at all.

**Independent Test**: Sign in as admin, open any user's profile, click "Edit user", change the name in the modal, and save. Confirm the modal closes, the profile reflects the new name, and a subsequent page reload still shows the new name (i.e. the change was persisted, not just optimistically rendered). Change the role from `developer` to `manager` and confirm the role badge updates. Sign in as manager and confirm no edit affordance is visible anywhere.

**Acceptance Scenarios**:

1. **Given** an admin viewing a user's profile, **When** they click "Edit user", **Then** a modal opens pre-filled with the current values for name, role, and status.
2. **Given** the modal is open, **When** the admin changes the name to a valid value and clicks Save, **Then** the modal sends the patch, shows a loading state on the Save button (disabled, spinner), closes on success, and the profile + list both reflect the new name without a page reload.
3. **Given** the modal is open, **When** the admin changes the role from `developer` to `manager` and saves, **Then** on success the role badge updates everywhere it is rendered and the change is persisted across reloads.
4. **Given** the modal is open, **When** the admin toggles `is_active` from true to false and saves, **Then** the status column shows "Inactive" and the row is visually de-emphasized (e.g. muted text).
5. **Given** the modal is open, **When** the admin clears the name and tries to Save, **Then** a field-level validation error appears beneath the name input and the request is not sent.
6. **Given** the modal is open and the admin attempts to deactivate their own account, **When** they click Save, **Then** the backend returns a "cannot deactivate self" error and the modal renders the error inline without closing.
7. **Given** the modal is open and the network drops, **When** the admin clicks Save, **Then** a generic error message appears inside the modal, the modal stays open, and the user's prior input is preserved so they can retry.
8. **Given** the modal is open, **When** the admin clicks Cancel or presses Escape, **Then** the modal closes without sending any request and no values change.
9. **Given** the modal is open, **When** focus enters the modal, **Then** keyboard focus is trapped inside it until it is closed (no tabbing back to the page behind it).
10. **Given** a manager or developer session, **When** they navigate to a user profile or row, **Then** no "Edit user" affordance is rendered at all (the button does not exist in the DOM — it is not just disabled).

---

### User Story 4 — RBAC-aware navigation and affordances (Priority: P1)

The application chrome (sidebar / top navigation) only renders the link to the Users page for roles that can use it (admin, manager). Inside the page, edit affordances render only for the admin role. Developers never see the Users link, the list page, or anyone else's profile.

**Why this priority**: This is what makes the Users dashboard usable by all three roles without breaking the principle of least privilege. Without it, managers and developers see UI that 403s on click — a confusing and degrading experience. P1 because it is the gate that lets the feature ship to the whole user base; if we shipped without it, we would have to disable the entire frontend for non-admins.

**Independent Test**: Sign in as each of admin, manager, developer in turn. In each session: (a) check that the Users link is/is not in the navigation per the matrix below, (b) check that deep-linking to `/users` and `/users/<id>` produces the expected result (list / access-denied / own-profile-only), (c) check that the Edit user button is/is not rendered.

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the app renders, **Then** the navigation contains a "Users" link, the `/users` page renders the full table, and every row exposes an "Edit" action; the profile page exposes an "Edit user" button.
2. **Given** a manager session, **When** the app renders, **Then** the navigation contains a "Users" link, the `/users` page renders the full table without "Edit" actions, and the profile page renders without an "Edit user" button.
3. **Given** a developer session, **When** the app renders, **Then** the navigation does NOT contain a "Users" link, deep-linking to `/users` shows an "Access denied" state, and deep-linking to `/users/<other-id>` shows an "Access denied" state. Deep-linking to `/users/<their-own-id>` shows their own profile (read-only).
4. **Given** a user whose session expires while they are on the Users page, **When** they next interact with the page (e.g. open a profile or apply a filter that triggers a refetch), **Then** they are redirected to the login page with a "session ended" notice and the URL they were on is preserved so they return there after signing in.

---

### Edge Cases

- **Large user lists**: How does the table behave when there are 500+ users? The first iteration assumes the backend returns the full list and the client filters; if list growth becomes a bottleneck, server-side pagination becomes a follow-up feature.
- **Concurrent edits**: Two admins open the same user, one saves a role change, the second saves a name change a moment later — the second save wins for `name` and silently overwrites the role unchanged, because the modal sends only fields the user actually changed. The UI does not currently warn about concurrent edits.
- **Self-edit guard**: An admin opens their own profile and edits their own name — allowed. Same admin opens own profile and deactivates self — backend returns 409 and the modal surfaces the error.
- **Role removal mid-session**: An admin's role is demoted to `developer` in another session/tab. On the next interaction in this tab, the cross-tab sync from `009-auth-ui` should reflect the new session, and the navigation/affordances should re-render without a full reload.
- **Search debounce**: Rapid typing in the search box must not flood the client with re-renders or refetches; the search updates the visible rows on each keystroke (client-side filter) but does not refetch the list from the backend.
- **Deactivated users in the list**: Inactive users appear in the table by default but are visually muted (e.g. greyed text + an "Inactive" badge), and a filter chip "Show: active only / all" defaults to "all" to match the backend behaviour.
- **Empty role filter combined with empty search**: Returns the full list — the empty state should NEVER show when no filters are applied.
- **Profile page for a user that was just deleted in another session**: The page shows a "User not found" state on next data fetch.

## Requirements *(mandatory)*

### Functional Requirements

#### Users list page

- **FR-001**: The Users list page MUST display every user the current session is allowed to see — admin and manager see everyone, developer is denied entry to the page entirely.
- **FR-002**: Each row MUST show the user's name, email, role (rendered as a coloured badge whose colour is consistent across the application for that role), active/inactive status, and the date the account was created.
- **FR-003**: The page MUST provide a free-text search input that filters the visible rows by case-insensitive substring match against name and email.
- **FR-004**: The page MUST provide a role filter (admin / manager / developer / any) and a status filter (active / inactive / all) that combine with the search input (AND).
- **FR-005**: Filtering MUST happen client-side — typing into search MUST NOT trigger a network request.
- **FR-006**: The page MUST render a skeleton/loading state while the user list is being fetched, an empty state when filters narrow the result to zero rows (with a "Clear filters" affordance), and an inline error state with a "Try again" action when the fetch fails.
- **FR-007**: The page MUST cache the fetched list and reuse it on revisits within the freshness window so the page renders instantly on the second visit; it MUST also refresh the data when the window regains focus.
- **FR-008**: Clicking any row MUST navigate to the corresponding user profile page (`/users/<id>`).

#### User profile page

- **FR-009**: The profile page at `/users/<id>` MUST display the targeted user's full record: name, email, role (badge), status, created and updated timestamps, and any developer-related metadata returned by the backend.
- **FR-010**: The page MUST permit access according to the same rules as the backend (admin and manager may view anyone; developer may view only themselves; everyone else is denied) and MUST render an "Access denied" state when the rules are violated rather than rendering anyone else's data.
- **FR-011**: When `<id>` does not correspond to an existing user, the page MUST render a "User not found" state with a link back to the list.
- **FR-012**: The profile page MUST be reachable by deep link (typing the URL directly), not just by clicking a row in the list.

#### Edit user modal

- **FR-013**: An admin (and only an admin) MUST be able to open an Edit user modal from the profile page and from each row in the users list.
- **FR-014**: The modal MUST allow editing the user's name, role, and active/inactive status. It MUST NOT allow editing the email or password from this surface.
- **FR-015**: The modal MUST pre-fill the current values for every editable field, and MUST send only the fields that were actually changed.
- **FR-016**: The modal MUST validate the name is non-empty and the role is one of the three known values before submitting; invalid input MUST surface inline field-level errors and MUST NOT result in a network request.
- **FR-017**: While a save is in flight, the Save button MUST show a loading state and MUST be disabled so a second click cannot fire a second request.
- **FR-018**: On success, the modal MUST close and the changed values MUST be reflected wherever they are visible (the underlying profile page and the users list) without a full page reload.
- **FR-019**: On a backend validation error or a self-deactivation conflict, the modal MUST render the server-supplied error inline (top-of-modal alert or per-field message) and MUST stay open so the admin can retry.
- **FR-020**: On a network failure, the modal MUST render a generic retry-able error and MUST preserve all user-entered values.
- **FR-021**: The modal MUST be dismissable by clicking Cancel, pressing Escape, or clicking the backdrop, and dismissal MUST NOT send any request.
- **FR-022**: While open, the modal MUST trap keyboard focus inside itself and MUST return focus to the element that opened it when it closes.

#### RBAC-aware UI

- **FR-023**: The application navigation MUST render the "Users" link only for admin and manager sessions.
- **FR-024**: Edit affordances ("Edit user" buttons, per-row "Edit" actions) MUST be rendered only for admin sessions. They MUST NOT exist in the DOM (not just be disabled) for managers or developers.
- **FR-025**: When the current session loses authentication mid-page (e.g. token expires and a request returns 401), the user MUST be redirected to the login page with a notice that the session ended, and the URL they were on MUST be preserved so they return there after signing in.
- **FR-026**: When the current session's role changes (e.g. an admin is demoted in another tab), the navigation and affordances on this page MUST re-render against the new role without requiring a full page reload.

### Key Entities

- **User**: Identifier, name, email, role (admin | manager | developer), active/inactive flag, creation timestamp, update timestamp, optional developer-specific metadata. Source of truth is the backend; the frontend is a read-and-edit window only.
- **UsersFilter** (client-only): The set of active narrowing rules for the list — free-text search, role filter, status filter. Lives in URL query string so a filtered list is shareable / restorable by deep link.
- **EditDraft** (client-only): The pending change set inside the modal — a partial of `User` containing only the fields the admin has touched, sent to the backend as the request body.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can find a specific user in a directory of 100+ users in under 5 seconds (open the page → type partial name → click the row).
- **SC-002**: 95% of users-list visits render a usable view (table or skeleton — never a blank flash) within 1 second on a typical broadband connection.
- **SC-003**: An admin can promote a developer to manager in under 30 seconds from any starting point in the app (open Users → click row → click Edit → change role → save), and the change is visible on every surface that shows that user without a manual refresh.
- **SC-004**: Managers and developers never see UI affordances they cannot exercise — zero "click → 403" surprises in normal navigation.
- **SC-005**: 100% of role changes performed through the modal are persisted (verified by a page reload landing on the new value).
- **SC-006**: When the backend is unreachable, 100% of error states display a "Try again" affordance that recovers without a page reload once connectivity returns.
- **SC-007**: Keyboard-only users can complete every flow in this feature (open list, search, open profile, open modal, edit, save, cancel) without using a mouse, and screen-reader users hear announcements when the modal opens/closes and when save succeeds or fails.

## Assumptions

- The backend `003-users-management` slice is deployed and the wire contract documented in its `contracts/openapi.yaml` is stable. Frontend pulls field names, validation rules, and error codes from there.
- The `009-auth-ui` foundation is in place: `RequireAuth`, session store, `http` interceptor for 401, role selectors, and the cross-tab `storage` sync.
- The current user count fits comfortably in a single response (low hundreds). If the directory grows past a few thousand, server-side pagination becomes a follow-up feature.
- The role set is closed at `admin | manager | developer`. Adding a fourth role is out of scope.
- Email changes are intentionally NOT editable from this surface — they require an account-recovery flow that does not yet exist.
- The "developer-related metadata" returned by `GET /users/{id}` is displayed read-only; managing it (e.g. setting hourly rate, capacity) is a separate, future feature.

## Out of Scope

- Creating a new user from the dashboard. Account creation is the registration flow already shipped in `009-auth-ui`.
- Bulk operations (multi-select rows, bulk role change, bulk deactivate).
- Password reset on behalf of another user.
- Export to CSV.
- Server-side pagination, sorting, or filtering — first iteration is client-side over a single fetched list.
- An audit log surface (who changed whose role and when).
- A separate "developers only" view backed by `GET /users/developers` — managers can use the role filter on the main list to get the same result.

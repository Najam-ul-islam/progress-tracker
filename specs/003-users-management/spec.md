# Feature Specification: Users Management

**Feature Branch**: `003-users-management`
**Created**: 2026-05-02
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Users. Own and manage the User entity (id, name, email, password_hash, role, is_active, created_at, updated_at) including profile data, role assignment, and developer-related metadata. Endpoints: GET /users/me, GET /users/{id}, GET /users, PATCH /users/{id}, PATCH /users/{id}/status, GET /users/developers. Roles: admin (full), manager (view), developer (self-only). Validation: unique email, valid role, only admin can change roles, only admin can deactivate. Six-file modular layout. NOT responsible for authentication or JWT logic. User entity is the single source of truth — no duplication anywhere else.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Read my own profile (Priority: P1)

Any authenticated user (admin, manager, or developer) calls `GET /users/me` with a valid bearer token and receives their own profile record. This is the smallest possible slice of the users module — every role is allowed to read themselves, and it requires nothing beyond the existing auth dependency plus a single repository read.

**Why this priority**: This is the SDK-equivalent of "who am I?" Every frontend session, every dashboard, every authorisation check downstream begins by calling this endpoint to populate state. Without it, the auth feature is technically usable but the product surface has no identity to display. It is also the simplest endpoint that exercises the full stack (route → dependency → service → repo → response) and confirms the auth↔users integration.

**Independent Test**: With only US1 implemented, an integration test can register/login one user (using the existing auth module), call `GET /users/me` with the returned token, and assert the response equals the seeded user (with `password_hash` excluded). No other users feature is needed for this slice to deliver value.

**Acceptance Scenarios**:

1. **Given** a logged-in developer with id 7, **When** `GET /users/me` is called with `Authorization: Bearer <token>`, **Then** the response is HTTP 200 with `{id:7, name, email, role:"developer", is_active:true, created_at}` and the body MUST NOT contain `password_hash`.
2. **Given** the same flow for an admin and a manager, **When** they call `GET /users/me`, **Then** each receives only their own record — never anyone else's.
3. **Given** a request with no `Authorization` header, **When** `GET /users/me` is called, **Then** the response is HTTP 401 with the same generic body the auth dependency emits today.
4. **Given** a valid bearer token whose user has been deleted from the database, **When** `GET /users/me` is called, **Then** the response is HTTP 401 (FR-021 from feature 002 still holds; no new behaviour).

---

### User Story 2 — Admin and managers list and read other users (Priority: P1)

An admin or manager calls `GET /users` (optionally filtered) or `GET /users/{id}` and receives the requested user record(s). Developers are blocked from these endpoints because they may only see themselves (US1).

**Why this priority**: This is the read surface the admin console and the manager's project-assignment UI both depend on. Every "assign a developer to a project" flow, every "show team roster" view, and every audit screen calls one of these two endpoints. P1 because admin onboarding and manager workflows are blocked without it.

**Independent Test**: Seed three users (admin, manager, developer). Login as admin, call `GET /users` and assert all three are returned. Call `GET /users/{developer_id}` and assert the developer record is returned. Login as manager and assert the same. Login as developer and assert HTTP 403 on both. No other users feature is required.

**Acceptance Scenarios**:

1. **Given** at least three users exist, **When** an admin calls `GET /users`, **Then** the response is HTTP 200 with a list of every user (each entry: `{id, name, email, role, is_active, created_at}`, no `password_hash`).
2. **Given** the same setup, **When** a manager calls `GET /users`, **Then** the response is HTTP 200 with the same shape (managers may view).
3. **Given** the same setup, **When** a developer calls `GET /users`, **Then** the response is HTTP 403 with a generic forbidden body.
4. **Given** an admin session, **When** `GET /users/{id}` is called for a user that exists, **Then** the response is HTTP 200 with that user's record. **When** the id does not exist, **Then** the response is HTTP 404 with a generic not-found body.
5. **Given** a developer session, **When** `GET /users/{id}` is called with an id different from their own, **Then** the response is HTTP 403. **When** the id matches their own, **Then** the response is HTTP 200 (i.e. developers can read themselves through `/users/{id}` as well as `/users/me`).
6. **Given** no `Authorization` header, **When** any of the list/read endpoints is called, **Then** the response is HTTP 401.

---

### User Story 3 — Admin updates a user's profile and role (Priority: P1)

An admin calls `PATCH /users/{id}` with one or more of `{name, role, is_active}`. The system validates the change (role enum, not the user's own deactivation), persists it, bumps `updated_at`, and returns the updated record.

**Why this priority**: This is the only path by which the role of an existing user can change. Onboarding flows promote a developer to manager, and offboarding flows clear out stale accounts. Without this endpoint, the only remediation is a direct DB write — unsafe and unauditable. P1 because it is the gate that lets the admin operate the system without DBA help.

**Independent Test**: Seed an admin and a developer. Login as admin, `PATCH /users/{developer_id}` with `{role:"manager"}`, assert HTTP 200 and that a subsequent `GET /users/{developer_id}` returns `role:"manager"`. Login as the same developer (now a manager), repeat the PATCH, and assert HTTP 403.

**Acceptance Scenarios**:

1. **Given** an admin and a target user, **When** `PATCH /users/{id}` is called with `{name:"New Name"}`, **Then** the response is HTTP 200 with the updated record and `updated_at` strictly greater than the previous value.
2. **Given** an admin and a target user, **When** `PATCH /users/{id}` is called with `{role:"manager"}`, **Then** the response is HTTP 200 and the stored role is `"manager"`.
3. **Given** an admin and a target user, **When** `PATCH /users/{id}` is called with `{role:"superuser"}` (an invalid enum value), **Then** the response is HTTP 422 and the row is not modified.
4. **Given** a manager session, **When** `PATCH /users/{id}` is called for any user (including themselves), **Then** the response is HTTP 403.
5. **Given** a developer session, **When** `PATCH /users/{id}` is called for any user (including themselves), **Then** the response is HTTP 403. (Developers cannot self-edit through this endpoint; if self-edit is offered later it is a separate, narrower endpoint.)
6. **Given** an admin session, **When** `PATCH /users/{id}` is called with an empty body or a body that omits all updatable fields, **Then** the response is HTTP 422 (no-op patches are not silently accepted).
7. **Given** an admin session, **When** `PATCH /users/{id}` targets a non-existent id, **Then** the response is HTTP 404.

---

### User Story 4 — Admin activates/deactivates a user (Priority: P2)

An admin calls `PATCH /users/{id}/status` with `{is_active: true|false}`. The system flips the flag, bumps `updated_at`, and returns the updated record. A deactivated user remains in the database (preserving foreign keys from projects, tasks, etc.) but is gated by FR-013 below.

**Why this priority**: Offboarding without deletion is a hard requirement: a developer who leaves the company cannot have their historical project/task assignments orphaned. P2 (not P1) because the system can ship US1–US3 and still accept new users; deactivation only becomes critical when the first user departs. Admins can also do this through PATCH /users/{id} with `{is_active:false}` — having a dedicated endpoint makes the audit log clearer and lets ACLs differ later.

**Independent Test**: Seed an admin and a developer. Login as admin, `PATCH /users/{developer_id}/status` with `{is_active:false}`. Assert HTTP 200, then attempt to log in as that developer through the auth module and assert HTTP 401.

**Acceptance Scenarios**:

1. **Given** an active developer, **When** an admin calls `PATCH /users/{id}/status` with `{is_active:false}`, **Then** the response is HTTP 200 and the stored `is_active` is `false`.
2. **Given** the deactivated user from scenario 1, **When** they attempt `POST /auth/login` with correct credentials, **Then** the response is HTTP 401 (FR-013).
3. **Given** an admin's own account, **When** the admin calls `PATCH /users/{my_own_id}/status` with `{is_active:false}`, **Then** the response is HTTP 409 with a "cannot deactivate self" error and the row is unchanged. (Prevents the system from being locked out of its only admin.)
4. **Given** a manager or developer session, **When** `PATCH /users/{id}/status` is called, **Then** the response is HTTP 403.

---

### User Story 5 — List developers for project assignment (Priority: P2)

An admin or manager calls `GET /users/developers` and receives every user whose role is `developer` and whose `is_active` is `true`. This is the data source for the "assign developer to project/task" pickers in the UI.

**Why this priority**: This is a denormalised view that the projects/tasks modules will call frequently; centralising it here keeps the role filter in exactly one place. P2 because clients can use `GET /users` with a client-side filter while this slice is under construction — it is a performance/ergonomics improvement, not a gate.

**Independent Test**: Seed one admin, one manager, two active developers, and one inactive developer. Login as admin or manager. Call `GET /users/developers`. Assert the response contains exactly the two active developers (not the inactive one, not the admin, not the manager).

**Acceptance Scenarios**:

1. **Given** the seeded mix above, **When** an admin or manager calls `GET /users/developers`, **Then** the response is HTTP 200 with a list containing only `role=="developer" AND is_active==true` users.
2. **Given** a developer session, **When** `GET /users/developers` is called, **Then** the response is HTTP 403.
3. **Given** no developers exist, **When** an admin calls `GET /users/developers`, **Then** the response is HTTP 200 with an empty list (not 404).

---

### Edge Cases

- A user updates their own `name` via a PATCH that an admin issues against the user's id — supported (US3 scenario 1). A user updating their *own* name through a different endpoint (e.g. `PATCH /users/me`) is **out of scope** for this feature; if needed it will be a separate slice.
- Concurrent role changes: two admins PATCH the same user id with different roles within milliseconds. The last write wins; this feature does not introduce optimistic locking. (`updated_at` reflects the latest write.)
- Email change is **out of scope** for this feature. The User model has a unique email index; changing it would require an auth flow (re-verification, possible re-login). If an admin needs to change an email today, they use the database — and if/when that capability is added, it will be a dedicated slice with its own spec.
- Password change is **out of scope** for this feature. It belongs to the auth module and will be specified separately. The users module never accepts `password` or `password_hash` on its update endpoints.
- Role downgrade from `admin` to `manager`/`developer` for the **last remaining admin** in the system: the system MUST refuse with HTTP 409 (FR-014). Otherwise the platform becomes unadministerable.
- Pagination: `GET /users` returns the full list for now (admin-only operation, low expected cardinality during MVP). Pagination is **out of scope** but a future-compatible response shape is suggested in Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

**Entity ownership**

- **FR-001**: The `users` module MUST be the only module that defines the `User` SQLModel and the only module that issues SQL against the `user` table. The `auth` module continues to consume it through a thin facade (already established in feature 002, ADR-0003).
- **FR-002**: The `User` entity MUST include the fields and constraints established in feature 002: `id` (PK), `name` (1..120 chars), `email` (unique-indexed, lowercased+stripped on write), `password_hash`, `role` (CHECK over `admin | manager | developer`), `created_at` (UTC). This feature ADDS `is_active` (boolean, NOT NULL, default `true`) and `updated_at` (timestamp, NOT NULL, default = `created_at`, auto-bumped on every update).
- **FR-003**: The `User` entity MUST NOT be redefined or shadowed in any other module.

**Reads**

- **FR-004**: The system MUST expose `GET /users/me` returning the authenticated principal's record. All authenticated roles are permitted.
- **FR-005**: The system MUST expose `GET /users/{id}`. Admins and managers may read any user. Developers may read only themselves; any other id returns HTTP 403.
- **FR-006**: The system MUST expose `GET /users` returning every user. Admins and managers may call it; developers receive HTTP 403.
- **FR-007**: The system MUST expose `GET /users/developers` returning every user where `role == "developer"` AND `is_active == true`. Admins and managers may call it; developers receive HTTP 403.

**Writes**

- **FR-008**: The system MUST expose `PATCH /users/{id}` accepting any subset of `{name, role, is_active}`. Only admins may call it; managers and developers receive HTTP 403.
- **FR-009**: The system MUST expose `PATCH /users/{id}/status` accepting `{is_active: bool}`. Only admins may call it.
- **FR-010**: All write endpoints MUST set `updated_at` to the current UTC time on every successful write. The repository, not the database trigger, is the source of truth for this column to keep behaviour explicit.
- **FR-011**: A `PATCH /users/{id}` body that updates no field (empty body, or all-null fields) MUST return HTTP 422. No-op writes are not silently accepted.
- **FR-012**: Email and `password_hash` MUST NOT be modifiable through any endpoint in this feature. Requests that include them MUST be rejected with HTTP 422 (extra-fields-forbidden) — the schema is closed, not open.

**Authorisation invariants**

- **FR-013**: A user whose `is_active` is `false` MUST NOT be able to log in. The auth module's `authenticate_user` (feature 002) SHALL be extended to reject inactive users with the same `InvalidCredentialsError` it already raises for wrong passwords (preserves SC-005 byte-identical 401).
- **FR-014**: An admin MUST NOT be able to demote themselves out of the `admin` role if they are the **last** remaining admin. An admin MUST NOT be able to deactivate themselves if they are the last remaining admin. The system MUST return HTTP 409 with a clear error in both cases, computed by counting active admins inside the same transaction as the write.
- **FR-015**: All endpoints in this feature MUST require a valid bearer token; unauthenticated requests MUST return HTTP 401 (handled by the existing auth dependency).
- **FR-016**: Role checks MUST be enforced via the existing `require_admin`, `require_manager`, `require_any` dependencies introduced in feature 002 — not by ad-hoc role checks inside service or route code.

**Data hygiene**

- **FR-017**: All response bodies MUST exclude `password_hash`. The `UserRead` schema is the only public response shape and it MUST NOT contain that field.
- **FR-018**: All write endpoints MUST validate `role` against the same `Literal["admin", "manager", "developer"]` already used by the auth schema; the value is rejected with HTTP 422 otherwise.
- **FR-019**: A request that targets a non-existent user id (read or write) MUST return HTTP 404 with a generic body (no information about whether the id was ever valid).

**Module boundaries**

- **FR-020**: The `users` module MUST NOT import any business logic from the `auth` module (it may import the *dependencies* — `get_current_user`, `require_admin`, etc. — because those are infrastructure, not business logic). A grep audit script MUST enforce this and run in CI alongside the SC-007 audit added in feature 002.

### Key Entities

- **User** *(extended from feature 002)*: a person who can authenticate and operate within the SaaS. Adds two new attributes:
  - `is_active` — boolean. `false` means the user cannot log in (FR-013) but their historical FK references (project ownership, task assignments, audit log entries) remain intact.
  - `updated_at` — UTC timestamp of the most recent successful write to this row. Used by clients for cache invalidation and by audit views to show last-modified.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user of any role can fetch their own profile via `GET /users/me` in under 200 ms (median, against an in-memory test database). Verified by an integration test asserting HTTP 200 and the response body equals the seeded user minus `password_hash`.
- **SC-002**: An admin can read, list, update, deactivate, and reactivate any non-self user without ever issuing a direct database query. Verified by a single integration scenario that walks the full lifecycle (`GET /users` → `PATCH /users/{id}` → `PATCH /users/{id}/status` → `GET /users/{id}`) and asserts the expected state at each step.
- **SC-003**: A developer who attempts any non-self read or any write returns HTTP 403 — never HTTP 200, never a "leaked" 404. Verified by a parametrised test that walks every endpoint in this feature with a developer token against another user's id and asserts 403 for each.
- **SC-004**: A deactivated user cannot log in. Verified by a single integration test that deactivates a user via `PATCH /users/{id}/status` and asserts the next `POST /auth/login` for that user returns HTTP 401 with the same body as the wrong-password case (no information leak about why login failed).
- **SC-005**: The system never permits the deletion of the last admin. Verified by an integration test that seeds exactly one admin, attempts to demote and to deactivate them via both endpoints, and asserts HTTP 409 in both cases with the row unchanged.
- **SC-006**: No response body anywhere in the feature contains `password_hash`. Verified by a single test that walks every 2xx response from every endpoint in this feature and asserts the substring `password_hash` does not appear.
- **SC-007**: The `User` SQLModel exists in exactly one module. Verified by a CI grep audit that fails if `class User(SQLModel, table=True)` appears outside `app/modules/users/model.py`.

## Assumptions

- **Pagination**: `GET /users` and `GET /users/developers` return the full list during MVP. The response is a JSON array, not an envelope. When pagination becomes necessary, the response will be wrapped in `{"items": [...], "next_cursor": "..."}` — a non-breaking change for clients that already iterate the array if and only if the server emits the array form when no pagination params are passed.
- **Soft delete vs hard delete**: deactivation is the canonical "remove" path. Hard deletion is **not** offered through the API in this feature; if it is ever required (legal compliance), it will be a separate slice with its own audit.
- **Email change**: out of scope (see Edge Cases). The unique-indexed email column makes this a non-trivial flow that requires re-verification — explicitly deferred.
- **Self-service profile edits**: out of scope. Developers/managers cannot edit themselves through this feature; only admins write. A future `PATCH /users/me` slice may relax this for the user's own `name` only.
- **Role enum source**: the `Literal["admin", "manager", "developer"]` lives in `app.modules.auth.schema` today and is reused (imported) by the users schema. If a third module ever needs it, it migrates to `app.shared.constants` — but only when there is a third consumer, not preemptively.
- **Audit trail**: every write bumps `updated_at`. A separate audit log (who changed what, when) is **not** part of this feature; that lives in a future `audit` module.
- **Race condition on last-admin check**: FR-014 reads the active-admin count and writes the role/status in the same transaction (`SELECT … FOR UPDATE` if the database supports it; otherwise a serialisable transaction). The PATCH endpoint MUST refuse to proceed if the count would drop to zero.

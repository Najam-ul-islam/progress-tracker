# Feature Specification: Clients Management

**Feature Branch**: `004-clients-management`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Clients. Own and manage the Client entity (id, name, email, phone, company_name, address, notes, created_at, updated_at). Endpoints: POST /clients, GET /clients, GET /clients/{id}, PATCH /clients/{id}, DELETE /clients/{id}. Roles: admin (full), manager (create/update/view), developer (no access). Validation: valid email, phone with country code, required name, no duplicate email or phone. Six-file modular layout. NOT responsible for project logic or invoicing. Client entity is the single source of truth — no duplication. One Client → Many Projects (FK lives in projects module).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin or manager creates a client (Priority: P1)

An admin or manager calls `POST /clients` with `{name, email, phone, company_name?, address?, notes?}`. The system validates the input, refuses duplicates on `email` or `phone`, persists the row, and returns HTTP 201 with the created client (no `password_hash`-style sensitive fields exist on Client, but the response shape is closed and stable).

**Why this priority**: Without create, the entire module is dormant — every other endpoint reads or mutates a row that does not exist yet. P1 because client onboarding is the gating step before any project can be opened. It also exercises the full stack (route → dependency → service → repo → response) and confirms the auth↔clients integration end-to-end.

**Independent Test**: Login as admin (using the existing auth module), `POST /clients` with a valid payload, assert HTTP 201 and a body matching `ClientRead`. Repeat with the manager role and assert HTTP 201. Repeat with the developer role and assert HTTP 403. No other clients feature is required.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** `POST /clients` is called with `{name:"Acme Corp", email:"contact@acme.example.com", phone:"+1-415-555-0101"}`, **Then** the response is HTTP 201 with `{id, name, email, phone, company_name:null, address:null, notes:null, created_at, updated_at}`.
2. **Given** an authenticated manager, **When** the same request is sent, **Then** the response is HTTP 201 (managers may create).
3. **Given** an authenticated developer, **When** any `POST /clients` is called, **Then** the response is HTTP 403 with a generic forbidden body.
4. **Given** no `Authorization` header, **When** `POST /clients` is called, **Then** the response is HTTP 401.
5. **Given** a payload missing `name`, **When** `POST /clients` is called, **Then** the response is HTTP 422 (FR-006).
6. **Given** a payload whose `email` is malformed, **When** `POST /clients` is called, **Then** the response is HTTP 422 (FR-007).
7. **Given** a payload whose `phone` lacks a leading `+` and country code, **When** `POST /clients` is called, **Then** the response is HTTP 422 (FR-008).
8. **Given** a client already exists with `email = "contact@acme.example.com"`, **When** a second `POST /clients` is sent with the same `email`, **Then** the response is HTTP 409 with `detail = "client with this email already exists"` (FR-009). The first row is unchanged.
9. **Given** a client already exists with `phone = "+1-415-555-0101"`, **When** a second `POST /clients` is sent with the same `phone`, **Then** the response is HTTP 409 with `detail = "client with this phone already exists"`.
10. **Given** an admin, **When** `POST /clients` is called with an unknown extra field (e.g. `is_vip: true`), **Then** the response is HTTP 422 (`extra="forbid"` — closed schema).

---

### User Story 2 — Admin or manager lists and reads clients (Priority: P1)

An admin or manager calls `GET /clients` to list every client, or `GET /clients/{id}` to fetch one. Developers are blocked. This is the read surface every project-creation flow depends on (the projects module will call it to populate the "select a client" picker).

**Why this priority**: P1 because the create endpoint alone cannot produce a usable product — the operator needs to see what they have created and to confirm subsequent project creates against the right client. Read also unblocks the projects module's foreign-key lookups.

**Independent Test**: Seed two clients via `POST /clients`. Login as admin, call `GET /clients` and assert both are returned. Call `GET /clients/{id}` for one of them and assert the matching record. Login as manager and repeat the same two assertions. Login as developer and assert HTTP 403 on both. No other clients feature is required.

**Acceptance Scenarios**:

1. **Given** at least two clients exist, **When** an admin calls `GET /clients`, **Then** the response is HTTP 200 with a JSON array of every (non-deleted) client in stable id order; each entry uses the `ClientRead` shape.
2. **Given** the same setup, **When** a manager calls `GET /clients`, **Then** the response is HTTP 200 with the same shape.
3. **Given** the same setup, **When** a developer calls `GET /clients`, **Then** the response is HTTP 403.
4. **Given** an admin session, **When** `GET /clients/{id}` is called for an existing id, **Then** the response is HTTP 200 with that client. **When** the id does not exist, **Then** the response is HTTP 404 with a generic not-found body.
5. **Given** a developer session, **When** `GET /clients/{id}` is called for any id (existing or not), **Then** the response is HTTP 403 — the developer is rejected before the lookup so the existence of the id is not leaked.
6. **Given** no `Authorization` header, **When** any read endpoint is called, **Then** the response is HTTP 401.
7. **Given** clients exist where some are soft-deleted (FR-013), **When** `GET /clients` is called, **Then** the response excludes soft-deleted rows by default. (Restoration is out of scope; see Edge Cases.)

---

### User Story 3 — Admin or manager updates a client (Priority: P1)

An admin or manager calls `PATCH /clients/{id}` with one or more of `{name, email, phone, company_name, address, notes}`. The system validates the change, enforces uniqueness on `email` and `phone` against every other client, persists the diff, bumps `updated_at`, and returns the updated record.

**Why this priority**: P1 because data drifts — a client renames, changes phones, moves offices. Without PATCH, the only remediation is a direct DB write or a delete-and-recreate (which would orphan the projects FK once the projects module ships). It is the gate that lets operators correct the record without DBA help.

**Independent Test**: Seed an admin and one client. `PATCH /clients/{id}` with `{name:"Acme Holdings"}`, assert HTTP 200 and that a subsequent `GET /clients/{id}` returns the new name with `updated_at` strictly greater than the previous value. Repeat with a developer token and assert HTTP 403.

**Acceptance Scenarios**:

1. **Given** an admin and an existing client, **When** `PATCH /clients/{id}` is called with `{name:"New Name"}`, **Then** the response is HTTP 200 with the updated record and `updated_at` strictly greater than the previous value.
2. **Given** a manager and an existing client, **When** `PATCH /clients/{id}` is called with `{notes:"Owes us a kickoff doc"}`, **Then** the response is HTTP 200 (managers may update).
3. **Given** a developer, **When** `PATCH /clients/{id}` is called for any id, **Then** the response is HTTP 403.
4. **Given** an admin session, **When** `PATCH /clients/{id}` is called with an empty body or a body whose every field is `null`, **Then** the response is HTTP 422 (no-op patches are not silently accepted; FR-011).
5. **Given** an admin session, **When** `PATCH /clients/{id}` targets a non-existent id, **Then** the response is HTTP 404.
6. **Given** two clients exist with emails A and B, **When** `PATCH /clients/{id_of_A}` is called with `{email: B}`, **Then** the response is HTTP 409 with `detail = "client with this email already exists"` and the row is unchanged. (Same rule for `phone`.)
7. **Given** an admin session, **When** `PATCH /clients/{id}` is called with a malformed `email` or a `phone` without country code, **Then** the response is HTTP 422.
8. **Given** an admin session, **When** `PATCH /clients/{id}` is called with an unknown field, **Then** the response is HTTP 422 (closed schema).

---

### User Story 4 — Admin deletes a client (Priority: P2)

An admin calls `DELETE /clients/{id}`. The system soft-deletes the row (sets `is_active = false` and stamps `updated_at`) and returns HTTP 204 with no body. The row remains in the database so that future foreign keys from `projects` are never orphaned, but it disappears from `GET /clients` and `GET /clients/{id}` (the latter starts returning 404 against soft-deleted ids).

**Why this priority**: P2 (not P1) because the system can ship US1–US3 and still accept new clients; deletion only becomes critical once a customer offboards. Soft delete is also the safer default — in MVP we do not yet know which downstream modules will hold FKs to client.

**Independent Test**: Seed an admin and one client. `DELETE /clients/{id}`, assert HTTP 204. Then `GET /clients/{id}` and assert HTTP 404; `GET /clients` and assert the row is absent. Repeat the DELETE with a manager token and assert HTTP 403.

**Acceptance Scenarios**:

1. **Given** an admin and an existing client, **When** `DELETE /clients/{id}` is called, **Then** the response is HTTP 204 with no body and the row's `is_active` is `false`.
2. **Given** the soft-deleted client from scenario 1, **When** `GET /clients/{id}` is called, **Then** the response is HTTP 404 (consistent with FR-014: soft-deleted rows are not visible through the API).
3. **Given** the same setup, **When** `GET /clients` is called, **Then** the response is HTTP 200 and the list does not contain the soft-deleted row.
4. **Given** a manager session, **When** `DELETE /clients/{id}` is called, **Then** the response is HTTP 403 (managers cannot delete; only admins).
5. **Given** a developer session, **When** `DELETE /clients/{id}` is called, **Then** the response is HTTP 403.
6. **Given** an admin session, **When** `DELETE /clients/{id}` targets a non-existent id, **Then** the response is HTTP 404.
7. **Given** an admin session, **When** `DELETE /clients/{id}` is called against an already-soft-deleted id, **Then** the response is HTTP 404 (the row is already invisible to the API; the delete is idempotent in effect — same final state, same 404).

---

### Edge Cases

- **Restoration of a soft-deleted client**: out of scope. If business needs require it later, a dedicated `PATCH /clients/{id}/restore` slice will be specified separately. Today, soft-deleted rows are write-locked from the API.
- **Duplicate detection across soft-deleted rows**: a client soft-deleted with `email = X` does **not** block a new `POST /clients` with the same `email`. The unique check runs only against `is_active = true` rows. This avoids a permanent name/email squat after offboarding.
- **Phone normalisation**: the system stores the phone as the user submitted it, after a strict format check (E.164-style: leading `+`, country code, digits — see FR-008). It does not silently rewrite the phone; if the user submits `+1 415 555 0101` and `+14155550101`, those are different strings and both pass the format check but uniqueness sees them as different. Strict normalisation (e.g. via `phonenumbers`) is **explicitly deferred** — see Assumptions.
- **Email casing**: the system lowercases and strips `email` on write (matching the convention already used by the User entity in feature 002/003). Uniqueness compares against the normalised value.
- **Concurrent creates with the same email**: the unique index on `email` (over `is_active = true`) guarantees that one of the two transactions fails. The repository converts the integrity error into a `DuplicateClientError` so the route returns the same 409 the proactive uniqueness check returns.
- **Pagination**: `GET /clients` returns the full list during MVP. Same future-compatibility hatch as feature 003 (FR-Pagination assumption): an array today, an `{items, next_cursor}` envelope when needed.
- **Notes content**: the `notes` field is plain text (text column). Markdown rendering, mentions, and attachments are out of scope.
- **PII**: `email`, `phone`, `address`, `notes` are PII. They are returned only to authorised roles (admin/manager) and never leaked through error envelopes. No special encryption-at-rest is added in this feature beyond what the database already provides — that is a platform-wide concern, not a clients-module concern.

## Requirements *(mandatory)*

### Functional Requirements

**Entity ownership**

- **FR-001**: The `clients` module MUST be the only module that defines the `Client` SQLModel and the only module that issues SQL against the `client` table. The `projects` module (when it ships) consumes it through a foreign key on `project.client_id`; it MUST NOT redefine the `Client` model.
- **FR-002**: The `Client` entity MUST include: `id` (PK, integer, autoincrement), `name` (string, 1..120 chars, NOT NULL), `email` (string, NOT NULL, unique-among-active, lowercased+stripped on write), `phone` (string, NOT NULL, unique-among-active, format-checked), `company_name` (string, nullable, ≤200 chars), `address` (string, nullable, ≤500 chars), `notes` (text, nullable), `is_active` (boolean, NOT NULL, default `true`), `created_at` (UTC timestamp, NOT NULL, default = transaction start), `updated_at` (UTC timestamp, NOT NULL, default = `created_at`, app-bumped on every successful write).
- **FR-003**: The `Client` entity MUST NOT be redefined or shadowed in any other module.

**Reads**

- **FR-004**: The system MUST expose `GET /clients` returning every `is_active = true` client. Admins and managers may call it; developers receive HTTP 403.
- **FR-005**: The system MUST expose `GET /clients/{id}` returning the client with that id when `is_active = true`; otherwise HTTP 404 (FR-014). Admins and managers may call it; developers receive HTTP 403.

**Writes**

- **FR-006**: The system MUST expose `POST /clients` accepting `{name, email, phone, company_name?, address?, notes?}`. Only admins and managers may call it; developers receive HTTP 403. `name`, `email`, and `phone` are required.
- **FR-007**: `email` MUST be validated as a syntactically valid email address (Pydantic `EmailStr`) and stored lowercased + stripped of leading/trailing whitespace. Requests that fail this check return HTTP 422.
- **FR-008**: `phone` MUST start with `+`, MUST contain a country code of 1–3 digits, and MUST contain a total of 8–20 characters consisting of `+`, digits, spaces, hyphens, and parentheses (regex anchored `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$`). Requests that fail this check return HTTP 422.
- **FR-009**: The system MUST refuse a `POST /clients` whose `email` or `phone` already belongs to an `is_active = true` row, returning HTTP 409 with a per-field detail (`"client with this email already exists"` or `"client with this phone already exists"`). The check runs inside the same transaction as the insert.
- **FR-010**: The system MUST expose `PATCH /clients/{id}` accepting any subset of `{name, email, phone, company_name, address, notes}`. Only admins and managers may call it; developers receive HTTP 403. Same uniqueness rules as FR-009 apply, evaluated against every other `is_active = true` row.
- **FR-011**: A `PATCH /clients/{id}` body that updates no field (empty body, or every provided field is `null`) MUST return HTTP 422.
- **FR-012**: The system MUST expose `DELETE /clients/{id}`. Only admins may call it; managers and developers receive HTTP 403. The handler MUST perform a soft delete (set `is_active = false`, bump `updated_at`) and return HTTP 204 with no body.

**Data hygiene & lifecycle**

- **FR-013**: All write endpoints MUST set `updated_at` to the current UTC time on every successful write. The application layer (not a database trigger) is the source of truth for this column, matching the convention established in feature 003.
- **FR-014**: A soft-deleted client (`is_active = false`) MUST be invisible to every public read endpoint in this feature (returns HTTP 404 on `GET /clients/{id}`; absent from `GET /clients`). Re-activation is out of scope for this feature; it requires a future dedicated endpoint.
- **FR-015**: Request bodies on `POST /clients` and `PATCH /clients/{id}` MUST be closed (`extra="forbid"`); unknown fields cause HTTP 422.
- **FR-016**: Response bodies MUST conform exactly to `ClientRead`. The schema MUST NOT include any User-related fields, FK columns from other modules, or audit columns beyond what FR-002 specifies.

**Authorisation invariants**

- **FR-017**: All endpoints in this feature MUST require a valid bearer token; unauthenticated requests MUST return HTTP 401 (handled by the existing auth dependency from feature 002).
- **FR-018**: Role checks MUST be enforced via the existing `require_admin` / `require_any` dependencies from `app.modules.auth.dependencies`. No ad-hoc role checks inside service or route code.
- **FR-019**: A request that targets a non-existent (or soft-deleted) client id MUST return HTTP 404 with a generic body. The body MUST NOT distinguish "never existed" from "soft-deleted" — the API treats them as the same state.

**Module boundaries**

- **FR-020**: The `clients` module MUST NOT import any business logic from `auth`, `users`, `projects`, or any future module. It MAY import `app.modules.auth.dependencies` (infrastructure) and the role `Literal` from `app.modules.auth.schema` (a closed enum). A grep audit script MUST enforce this and run in CI alongside the audits added in features 002 and 003.
- **FR-021**: The `clients` module MUST NOT define any project-related, payment-related, or invoicing logic. The `Client` model MUST NOT carry FK columns from other modules.

### Key Entities

- **Client**: a customer organisation that engages the SaaS for one or more projects.
  - `id` — PK, integer.
  - `name` — primary display name (the company or contact person, depending on whether `company_name` is set).
  - `email` — primary contact email; unique among active rows; lowercased + stripped on write.
  - `phone` — primary contact phone in E.164-ish format; unique among active rows.
  - `company_name`, `address`, `notes` — optional descriptive fields.
  - `is_active` — boolean. `false` means soft-deleted; the row is preserved so future FKs from `projects.client_id` are never orphaned (FR-014).
  - `created_at`, `updated_at` — UTC timestamps for cache invalidation and audit views.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin or manager can create a client in under 200 ms (median, against an in-memory test database). Verified by an integration test that posts a valid payload and asserts HTTP 201 with a body matching `ClientRead`.
- **SC-002**: An admin or manager can walk the full client lifecycle (`POST → GET list → GET by id → PATCH → DELETE → GET by id returns 404`) without ever issuing a direct database query. Verified by a single integration scenario.
- **SC-003**: A developer who attempts any endpoint in this feature returns HTTP 403 — never HTTP 200, never a "leaked" 404. Verified by a parametrised test that walks every endpoint with a developer token and asserts 403 for each.
- **SC-004**: The system never permits a duplicate `email` or `phone` among active clients. Verified by integration tests covering both `POST` and `PATCH`, including the cross-row `PATCH` case (changing client A's email to client B's email).
- **SC-005**: A soft-deleted client disappears from every public read endpoint. Verified by an integration test that deletes a client and asserts both `GET /clients/{id}` returns 404 and `GET /clients` omits the row.
- **SC-006**: The `Client` SQLModel exists in exactly one module. Verified by a CI grep audit that fails if `class Client(SQLModel, table=True)` appears outside `app/modules/clients/model.py`.
- **SC-007**: The `clients` module imports nothing from `app.modules.users`, `app.modules.projects`, or `app.modules.payments`, and from `app.modules.auth` it imports only `dependencies` (and the role `Literal` from `schema`). Verified by `backend/scripts/audit_clients_imports.sh` running in CI.

## Assumptions

- **Pagination**: `GET /clients` returns the full active list during MVP. Cardinality is expected to remain under a few hundred rows for the first several months. Same future-compatible hatch as features 002/003: when pagination becomes necessary, the response will be wrapped in `{"items": [...], "next_cursor": "..."}`.
- **Phone normalisation**: strict format validation only (FR-008 regex). True normalisation via the `phonenumbers` library (canonical E.164, country-of-origin disambiguation) is **explicitly deferred** — adding a dependency for a regex-shaped problem is premature in MVP. If duplicate-phone collisions surface in practice, that is the trigger to upgrade.
- **Soft delete vs hard delete**: deletion is always soft. Hard deletion (e.g. for legal compliance / GDPR right-to-erasure) is **out of scope**; it will be a separate slice with its own audit and a separate endpoint.
- **Client → User linkage**: there is no FK from `client` to `user` in this feature. A future `client_owner_user_id` (i.e. "the account manager") may be added when the projects module ships and the operator's UX needs it. Not preemptively.
- **Restoration**: out of scope (see Edge Cases). The soft-delete is one-way through the public API in this feature.
- **Audit trail**: every write bumps `updated_at`. A separate audit log (who changed what, when, before/after) is **not** part of this feature; that lives in a future `audit` module.
- **Race condition on uniqueness**: FR-009 / FR-010 read-then-write inside the same transaction; the database's unique partial index on `(email) WHERE is_active = true` (and the same on `phone`) is the ultimate guard. The repository converts `IntegrityError` into a `DuplicateClientError` so the route always emits the same 409 envelope, whether the duplicate was caught by the proactive read or by the index.
- **Role enum source**: the `Literal["admin", "manager", "developer"]` continues to live in `app.modules.auth.schema` and is imported (not redefined) by the clients schema. If a third module ever needs it — clients makes the third — it migrates to `app.shared.constants` at the start of feature 005, but only when the move is forced.
- **Schema for delete**: `DELETE /clients/{id}` returns HTTP 204 with an empty body. This matches REST conventions and avoids exposing `ClientRead` for a soft-deleted row (which would reveal `is_active = false` and break FR-014's "invisible" guarantee).

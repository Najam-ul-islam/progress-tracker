# Feature Specification: Projects Management

**Feature Branch**: `005-projects`
**Created**: 2026-05-04
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Projects. Manage client projects, including module/task breakdown, developer assignment, progress tracking, and payment distribution foundation. Entities: Project (id, name, description, client_id FK, total_amount, company_share=30%, developer_share=70%, start_date, end_date, status pending|active|completed, created_at) and ProjectModule (id, project_id FK, name, description, assigned_developer_id FK→users, progress 0–100, status pending|in_progress|completed, share_percentage within 70%, created_at). Endpoints: POST /projects, GET /projects, GET /projects/{id}, PATCH /projects/{id}, POST /projects/{id}/modules, PATCH /modules/{id}, PATCH /modules/{id}/progress, GET /projects/{id}/progress. RBAC: admin = full; manager = create/manage projects; developer = view assigned modules + update own progress. Payment rule: 30% company fixed, 70% distributed across modules; total module shares MUST sum to 70%. Validation: client_id must exist; developer must have role=developer; total module share ≤ 70%; progress 0–100; cannot exceed assigned share. Project progress = average of module progress. NOT responsible for auth, user data, client CRUD, or payment transactions.

**Resolved decisions** (from `/sp.specify` clarifier this session):

1. **Share-sum rule**: cap is hard at every write (sum ≤ 70% always); equal-to-70% is required to activate the project.
2. **Project + Module deletion**: soft delete via `is_active`, mirroring feature 004 (clients).
3. **Status transitions**: hybrid — `pending → active` is manual (PATCH; gates the share=70% check); `active → completed` is automatic when every module hits `progress = 100`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin or manager creates a project (Priority: P1)

An admin or manager calls `POST /projects` with `{name, description?, client_id, total_amount, start_date, end_date}`. The system validates the input, confirms `client_id` references an active client (FR-005), persists the row at `status = "pending"`, and returns HTTP 201 with the created project. The `company_share` and `developer_share` fields are server-set defaults (30 / 70) and not accepted from the client.

**Why this priority**: Without create, the entire module is dormant — every other endpoint (modules, progress, activate) operates on a project that does not yet exist. P1 because project onboarding is the gating step before any developer can be allocated work and before the 70/30 distribution model has anything to distribute. It also exercises the auth ↔ clients ↔ projects integration end-to-end.

**Independent Test**: Login as admin, seed one client via `POST /clients`, then `POST /projects` with a valid payload referencing that `client_id`. Assert HTTP 201 and a body matching `ProjectRead` with `status = "pending"`, `company_share = 30`, `developer_share = 70`. Repeat with the manager role and assert HTTP 201. Repeat with the developer role and assert HTTP 403.

**Acceptance Scenarios**:

1. **Given** an authenticated admin and a seeded active client with `id = 1`, **When** `POST /projects` is called with `{name:"Migration Sprint", client_id:1, total_amount:"10000.00", start_date:"2026-06-01", end_date:"2026-08-31"}`, **Then** the response is HTTP 201 with `{id, name, description:null, client_id:1, total_amount:"10000.00", company_share:30, developer_share:70, start_date, end_date, status:"pending", is_active:true, created_at, updated_at}`.
2. **Given** an authenticated manager, **When** the same request is sent, **Then** the response is HTTP 201 (managers may create).
3. **Given** an authenticated developer, **When** any `POST /projects` is called, **Then** the response is HTTP 403 with a generic forbidden body.
4. **Given** no `Authorization` header, **When** `POST /projects` is called, **Then** the response is HTTP 401.
5. **Given** a payload missing `name`, `client_id`, `total_amount`, `start_date`, or `end_date`, **When** `POST /projects` is called, **Then** the response is HTTP 422.
6. **Given** a payload referencing a non-existent `client_id`, **When** `POST /projects` is called, **Then** the response is HTTP 422 with `detail = "client_id does not reference an active client"` (FR-005).
7. **Given** a payload referencing a soft-deleted client, **When** `POST /projects` is called, **Then** the response is HTTP 422 with the same detail (a soft-deleted client is invisible to projects).
8. **Given** a payload where `end_date < start_date`, **When** `POST /projects` is called, **Then** the response is HTTP 422 with `detail = "end_date must be on or after start_date"` (FR-006).
9. **Given** a payload where `total_amount <= 0`, **When** `POST /projects` is called, **Then** the response is HTTP 422.
10. **Given** an admin, **When** `POST /projects` is called with an unknown extra field (e.g. `is_secret: true`) or with a client-supplied `company_share`/`developer_share`/`status`/`id`, **Then** the response is HTTP 422 (`extra="forbid"` — closed schema; FR-018).

---

### User Story 2 — Admin or manager lists and reads projects (Priority: P1)

An admin or manager calls `GET /projects` to list every active project, or `GET /projects/{id}` to fetch one. A developer can also call both — but the response is filtered: a developer sees only projects in which they have at least one assigned module (FR-008). This is the read surface every progress and module-assignment flow depends on.

**Why this priority**: P1 because the create endpoint alone cannot produce a usable product — the operator needs to see what they have created and confirm subsequent module additions against the right project, and developers must be able to discover the projects they are responsible for. Read also unblocks the `GET /projects/{id}/progress` feature (US5).

**Independent Test**: Seed two projects under an admin. Login as admin, call `GET /projects` and assert both are returned. Call `GET /projects/{id}` for one of them and assert the matching record. Login as manager and repeat the same two assertions. Login as developer with no module assignments and assert `GET /projects` returns an empty array; `GET /projects/{id}` returns 404 (the project is invisible to them).

**Acceptance Scenarios**:

1. **Given** at least two active projects exist, **When** an admin calls `GET /projects`, **Then** the response is HTTP 200 with a JSON array of every `is_active = true` project in stable id order; each entry uses the `ProjectRead` shape.
2. **Given** the same setup, **When** a manager calls `GET /projects`, **Then** the response is HTTP 200 with the same shape.
3. **Given** a developer with one assigned module on project A, two active projects A and B, **When** the developer calls `GET /projects`, **Then** the response is HTTP 200 and contains only project A. Project B is hidden (FR-008).
4. **Given** an admin or manager session, **When** `GET /projects/{id}` is called for an existing active id, **Then** the response is HTTP 200 with that project. **When** the id does not exist or is soft-deleted, **Then** the response is HTTP 404.
5. **Given** a developer session, **When** `GET /projects/{id}` is called for a project they are not assigned to, **Then** the response is HTTP 404 — the API treats "no assignment" as "not found" so the existence of the id is not leaked.
6. **Given** a developer session, **When** `GET /projects/{id}` is called for a project they ARE assigned to (any module), **Then** the response is HTTP 200 with the `ProjectRead`.
7. **Given** no `Authorization` header, **When** any read endpoint is called, **Then** the response is HTTP 401.

---

### User Story 3 — Admin or manager updates a project, then activates it (Priority: P1)

An admin or manager calls `PATCH /projects/{id}` with one or more of `{name, description, total_amount, start_date, end_date, status}`. Field updates persist as in any PATCH. The `status` field is special: it is the **only** way to flip `pending → active`, and the system runs an activation gate before allowing it (the sum of every active module's `share_percentage` for this project must equal exactly 70.0; FR-013). `active → completed` is **never** accepted from the client — it is computed automatically (FR-014). Backwards transitions (`active → pending`, `completed → active`) are rejected.

**Why this priority**: P1 because data drifts (a project is renamed, the budget is bumped, dates slip) and because activation is the gate that locks in the share distribution. Without PATCH there is no way to move a project out of `pending`.

**Independent Test**: Seed an admin and one project. `PATCH /projects/{id}` with `{name:"New Name"}`, assert HTTP 200 and that a subsequent `GET` returns the new name with `updated_at` strictly greater. Add three modules summing to 70%, then `PATCH /projects/{id}` with `{status:"active"}`, assert HTTP 200 with `status = "active"`. Repeat the activation against a project whose modules sum to 60% and assert HTTP 422.

**Acceptance Scenarios**:

1. **Given** an admin and an existing `pending` project, **When** `PATCH /projects/{id}` is called with `{name:"New Name"}`, **Then** the response is HTTP 200 with the updated record and `updated_at` strictly greater than the previous value.
2. **Given** a manager and an existing project, **When** `PATCH /projects/{id}` is called with `{description:"Updated scope"}`, **Then** the response is HTTP 200 (managers may update).
3. **Given** a developer, **When** `PATCH /projects/{id}` is called for any id, **Then** the response is HTTP 403.
4. **Given** an admin session, **When** `PATCH /projects/{id}` is called with an empty body or a body whose every field is `null`, **Then** the response is HTTP 422 (no-op patches are not silently accepted; FR-012).
5. **Given** an admin session, **When** `PATCH /projects/{id}` targets a non-existent or soft-deleted id, **Then** the response is HTTP 404.
6. **Given** an admin session, **When** `PATCH /projects/{id}` is called with `{end_date}` earlier than the project's `start_date`, **Then** the response is HTTP 422.
7. **Given** an admin session, **When** `PATCH /projects/{id}` is called with `{total_amount:"-1"}`, **Then** the response is HTTP 422.
8. **Given** an admin session, **When** `PATCH /projects/{id}` is called with `{company_share:25}` or `{developer_share:75}`, **Then** the response is HTTP 422 (those are server-fixed; closed schema rejects them — FR-018).
9. **Given** an admin session and a `pending` project whose active modules sum to exactly 70%, **When** `PATCH /projects/{id}` is called with `{status:"active"}`, **Then** the response is HTTP 200 with `status = "active"` (FR-013).
10. **Given** an admin session and a `pending` project whose active modules sum to 60% (or 0%, or 70.5%), **When** `PATCH /projects/{id}` is called with `{status:"active"}`, **Then** the response is HTTP 422 with `detail = "module shares must sum to exactly 70.00 to activate (current: 60.00)"`.
11. **Given** an admin session and an `active` project, **When** `PATCH /projects/{id}` is called with `{status:"pending"}` or `{status:"completed"}`, **Then** the response is HTTP 422 (no manual de-activation; no manual completion — FR-014).
12. **Given** an admin session, **When** `PATCH /projects/{id}` is called with an unknown field, **Then** the response is HTTP 422 (closed schema).

---

### User Story 4 — Admin or manager adds modules and assigns developers (Priority: P1)

An admin or manager calls `POST /projects/{id}/modules` with `{name, description?, assigned_developer_id, share_percentage}` to add a sub-task to the project. The system validates that `assigned_developer_id` references a user whose `role = "developer"` and whose `is_active = true` (FR-009), validates that adding `share_percentage` to the existing active module shares for this project does not exceed 70.0 (FR-010), persists the module at `status = "pending"`, `progress = 0`, and returns HTTP 201. The same admin/manager may also `PATCH /modules/{id}` to rename a module, change its developer, or change its share — the share check applies again (the module's own current share is excluded from the sum so a no-op share PATCH never collides with itself).

**Why this priority**: P1 because the share-distribution rule is the core financial invariant of the entire feature; if modules cannot be added under the cap, the 70/30 model cannot be realised. Module creation is also a hard prerequisite for the developer's progress-update path (US5).

**Independent Test**: Seed an admin, a client, a project, and a developer-role user. `POST /projects/{id}/modules` with `{name:"Auth slice", assigned_developer_id, share_percentage:30}`. Assert HTTP 201. Add a second module with `share_percentage:30`; assert HTTP 201 (cumulative 60). Add a third with `share_percentage:15`; assert HTTP 422 with `detail = "total module share would exceed 70.00 (current: 60.00, requested: 15.00)"`. Repeat the first POST with `assigned_developer_id` pointing at a manager-role user; assert HTTP 422.

**Acceptance Scenarios**:

1. **Given** an admin, a `pending` project, and an active developer-role user, **When** `POST /projects/{id}/modules` is called with `{name:"Auth slice", assigned_developer_id, share_percentage:30}`, **Then** the response is HTTP 201 with `{id, project_id, name, description:null, assigned_developer_id, progress:0, status:"pending", share_percentage:"30.00", is_active:true, created_at, updated_at}`.
2. **Given** the project from scenario 1 with two existing modules summing to 60%, **When** an admin adds a third module with `share_percentage:10`, **Then** the response is HTTP 201 (cumulative 70.00, equal to cap is allowed).
3. **Given** the same setup, **When** an admin adds a third module with `share_percentage:11`, **Then** the response is HTTP 422 with `detail = "total module share would exceed 70.00 (current: 60.00, requested: 11.00)"` (FR-010).
4. **Given** an admin, **When** `POST /projects/{id}/modules` is called with `assigned_developer_id` pointing at an admin or manager user, **Then** the response is HTTP 422 with `detail = "assigned_developer_id must reference an active user with role=developer"` (FR-009).
5. **Given** an admin, **When** `POST /projects/{id}/modules` is called with `assigned_developer_id` pointing at a soft-deleted developer, **Then** the response is HTTP 422 with the same detail.
6. **Given** an admin, **When** `POST /projects/{id}/modules` is called against a non-existent or soft-deleted project id, **Then** the response is HTTP 404.
7. **Given** an admin, **When** `POST /projects/{id}/modules` is called against a `completed` project, **Then** the response is HTTP 422 with `detail = "cannot add modules to a completed project"` (FR-016).
8. **Given** a developer session, **When** `POST /projects/{id}/modules` is called for any project, **Then** the response is HTTP 403.
9. **Given** an admin and an existing module, **When** `PATCH /modules/{id}` is called with `{share_percentage:25}` and the new total (excluding this module's old value) plus 25 is ≤ 70, **Then** the response is HTTP 200.
10. **Given** an admin and an existing module M with `share_percentage:30`, **When** `PATCH /modules/{id}` is called with `{share_percentage:30}` (the same value), **Then** the response is HTTP 200 — the cap check excludes M's own current share so a no-op never collides (FR-011).
11. **Given** an admin and an existing module, **When** `PATCH /modules/{id}` is called with `{assigned_developer_id}` pointing at a non-developer, **Then** the response is HTTP 422 (FR-009).
12. **Given** a developer, **When** `PATCH /modules/{id}` is called for any module (including their own), **Then** the response is HTTP 403 — developers cannot retitle a module or reassign it; their only mutation surface is `PATCH /modules/{id}/progress` (US5).

---

### User Story 5 — Developer updates progress on their own module (Priority: P1)

A developer calls `PATCH /modules/{id}/progress` with `{progress: <0..100>}`. The system confirms the caller is the module's `assigned_developer_id` (FR-019), persists the new value, derives the module's `status` from progress (`0 → "pending"`, `1..99 → "in_progress"`, `100 → "completed"`; FR-020), and — when this update causes every active module on the parent project to reach `progress = 100` — automatically flips the project's `status` from `active` to `completed` and stamps its `updated_at` (FR-014). Admins and managers may also call this endpoint on any module.

**Why this priority**: P1 because progress reporting is the day-to-day operational surface of the entire feature for the developer role; without it, the 70% pool can never be apportioned and the project can never move out of `active`. It is also the only mutation a developer is allowed to perform.

**Independent Test**: Seed an admin, a client, a project, three modules (each 70/3 ≈ rounded so shares sum to 70), each assigned to a different developer. Activate the project. As developer 1, `PATCH /modules/{module_1_id}/progress` with `{progress:50}`; assert HTTP 200, `status:"in_progress"`. As developer 2, attempt the same on `module_1`; assert HTTP 403. As each developer, push their own module to 100. After the third call, assert the project's `status` has flipped to `"completed"` (the response carries the updated module; a follow-up `GET /projects/{id}` confirms the project status).

**Acceptance Scenarios**:

1. **Given** a developer assigned to a module on an `active` project, **When** the developer calls `PATCH /modules/{id}/progress` with `{progress:42}`, **Then** the response is HTTP 200 with the updated module: `progress:42, status:"in_progress"` (FR-020).
2. **Given** the same developer, **When** they push the same module to `{progress:100}`, **Then** the response is HTTP 200 with `progress:100, status:"completed"`.
3. **Given** a project where two of three modules are at 100 and one is at 50, **When** the third developer pushes their module to 100, **Then** the response is HTTP 200, the module is `completed`, and a subsequent `GET /projects/{project_id}` returns `status:"completed"` (FR-014).
4. **Given** a developer, **When** they call `PATCH /modules/{id}/progress` for a module they are NOT assigned to, **Then** the response is HTTP 403 with the generic forbidden body (FR-019).
5. **Given** a developer, **When** they call `PATCH /modules/{id}/progress` against a non-existent or soft-deleted module id, **Then** the response is HTTP 404 (developers may not be told that another developer's module exists, but a missing id is uniformly 404 because no role can act on it).
6. **Given** any role, **When** `PATCH /modules/{id}/progress` is called with `{progress:101}` or `{progress:-1}`, **Then** the response is HTTP 422.
7. **Given** any role, **When** `PATCH /modules/{id}/progress` is called with an empty body or any field besides `progress`, **Then** the response is HTTP 422 (closed schema).
8. **Given** an admin or manager, **When** `PATCH /modules/{id}/progress` is called for any module, **Then** the response is HTTP 200 (admins and managers may also push progress; FR-019).
9. **Given** any role, **When** `PATCH /modules/{id}/progress` is called against a module on a `pending` project (project not yet activated), **Then** the response is HTTP 422 with `detail = "cannot update progress on a non-active project"` (FR-021).
10. **Given** an `active` project whose status has been flipped to `completed` by the auto-rule, **When** any role calls `PATCH /modules/{id}/progress` against any of its modules, **Then** the response is HTTP 422 with the same detail as scenario 9 (FR-021 — `completed` is also non-mutable).

---

### User Story 6 — Anyone with read access fetches aggregate project progress (Priority: P2)

An admin, manager, or assigned-developer calls `GET /projects/{id}/progress`. The system computes the aggregate as the **simple average** of the `progress` values of every active module on that project (FR-022), and returns `{project_id, progress, modules: [{id, name, progress, share_percentage}, ...]}`. If the project has no modules, the aggregate is `0`.

**Why this priority**: P2 because the per-module reads in US2 are sufficient to answer the same question for an attentive operator; this endpoint is the convenience aggregator for dashboards and stand-ups. Ship-able without it, but adopted faster with it.

**Independent Test**: Seed two modules on a project, set their progress to 50 and 100. Call `GET /projects/{id}/progress`; assert HTTP 200 with `progress:75.0` and an array of two module summaries.

**Acceptance Scenarios**:

1. **Given** a project with two active modules at progress 50 and 100, **When** an admin calls `GET /projects/{id}/progress`, **Then** the response is HTTP 200 with `{project_id, progress:75.0, modules:[{id, name, progress:50, share_percentage}, {id, name, progress:100, share_percentage}]}` (FR-022).
2. **Given** a project with no active modules, **When** an admin calls `GET /projects/{id}/progress`, **Then** the response is HTTP 200 with `progress:0.0` and an empty `modules` array.
3. **Given** a project that includes a soft-deleted module, **When** any role calls `GET /projects/{id}/progress`, **Then** the soft-deleted module is excluded from both the average and the array (FR-023).
4. **Given** a developer assigned to at least one module on the project, **When** they call `GET /projects/{id}/progress`, **Then** the response is HTTP 200.
5. **Given** a developer not assigned to any module on the project, **When** they call `GET /projects/{id}/progress`, **Then** the response is HTTP 404 (consistent with US2 — invisible projects stay invisible).
6. **Given** any role, **When** `GET /projects/{id}/progress` is called against a non-existent or soft-deleted project id, **Then** the response is HTTP 404.
7. **Given** no `Authorization` header, **When** the endpoint is called, **Then** the response is HTTP 401.

---

### User Story 7 — Admin soft-deletes a project or a module (Priority: P2)

An admin calls `DELETE /projects/{id}` or `DELETE /modules/{id}`. The system soft-deletes the row (`is_active = false`, bumps `updated_at`) and returns HTTP 204 with no body. Soft-deleted projects disappear from `GET /projects` and `GET /projects/{id}` (the latter returns 404). Deleting a project does **not** cascade to its modules in storage, but the modules become unreachable through the public API (the only entry point — the project — is gone). Soft-deleted modules disappear from progress aggregation (FR-023) and free their share allocation for re-use within the same project (FR-011, mirroring the clients-uniqueness rule).

**Why this priority**: P2 because the system can ship US1–US6 and still accept new projects and modules; deletion only becomes critical once a customer cancels work or a module is restructured. Soft delete is also the safer default — payments (when that module ships) will FK to module / project and we never want orphaned references.

**Independent Test**: Seed an admin, a project, two modules summing to 60%. `DELETE /modules/{id_of_first}` (which had `share_percentage:30`); assert HTTP 204. Add a new module with `share_percentage:30`; assert HTTP 201 (the deleted module's share has been freed). Then `DELETE /projects/{id}`; assert HTTP 204. `GET /projects/{id}` returns 404; `GET /projects` omits the row.

**Acceptance Scenarios**:

1. **Given** an admin and an existing project, **When** `DELETE /projects/{id}` is called, **Then** the response is HTTP 204 with no body and the row's `is_active` is `false` (FR-024).
2. **Given** the soft-deleted project, **When** any role calls `GET /projects/{id}` or `GET /projects/{id}/progress`, **Then** the response is HTTP 404.
3. **Given** the same setup, **When** any role calls `GET /projects`, **Then** the soft-deleted project is absent.
4. **Given** a manager session, **When** `DELETE /projects/{id}` is called, **Then** the response is HTTP 403 (managers cannot delete; only admins).
5. **Given** a developer session, **When** `DELETE /projects/{id}` or `DELETE /modules/{id}` is called, **Then** the response is HTTP 403.
6. **Given** an admin and an existing module, **When** `DELETE /modules/{id}` is called, **Then** the response is HTTP 204 and the module's `share_percentage` is freed (a subsequent `POST /projects/{project_id}/modules` may re-use that allocation; FR-011).
7. **Given** an admin session, **When** `DELETE /projects/{id}` or `DELETE /modules/{id}` targets a non-existent id, **Then** the response is HTTP 404.
8. **Given** an admin session, **When** `DELETE /projects/{id}` or `DELETE /modules/{id}` is called against an already-soft-deleted id, **Then** the response is HTTP 404 (idempotent in effect — same final state, same 404).

---

### Edge Cases

- **Restoration of a soft-deleted project or module**: out of scope. If business needs require it, a dedicated `PATCH /projects/{id}/restore` (or module equivalent) slice will be specified separately. Today, soft-deleted rows are write-locked from the API.
- **Money precision**: `total_amount` is stored as a fixed-precision string (Decimal serialised to str with two fractional digits). The system does not compute distributed amounts in this feature; it only stores `share_percentage` per module. Actual payment computation is the `payments` module's responsibility (out of scope; FR-002).
- **Share precision**: `share_percentage` is a `Decimal(5, 2)` — accepts values 0.00..100.00 with two decimals. The cap check uses Decimal arithmetic so floating-point rounding never produces "70.00 + 0.0001 > 70" false positives.
- **Cross-project share isolation**: the 70% cap is per-project. Adding a module to project A consumes only project A's budget; the same developer can be assigned to modules on project B without affecting project A's cap.
- **Concurrent module creates**: two concurrent `POST /projects/{id}/modules` could both pass the proactive cap check and both insert. The repository performs the cap check inside the same transaction as the insert (a serializable read of existing module shares followed by the insert); on Postgres this is sufficient. SQLite tests are single-connection so the race is structurally absent.
- **Date semantics**: `start_date` and `end_date` are calendar dates (no time-of-day, no timezone). `end_date >= start_date`. Past start dates are accepted (a project may be retroactively created).
- **Activation against zero modules**: a project with zero active modules cannot be activated (sum is 0, not 70.00). The API returns HTTP 422 with the same activation-gate detail as any other under-allocation (FR-013).
- **Auto-completion is a side effect, not a transition users can request**: the only way `status` becomes `"completed"` is the auto-rule. A project with one module at 100% but two more at < 100% stays `active`. (Adding a brand-new module to a project that has just auto-completed would push it back to `active`? — see Assumptions: this scenario is structurally avoided because `completed` projects reject new modules per FR-016.)
- **Developer reassignment mid-flight**: an admin may `PATCH /modules/{id}` to change `assigned_developer_id` even while `progress > 0`. The progress value is preserved; the new developer inherits the in-progress state. The original developer no longer appears in any `GET /projects` filter for this project unless they are still assigned to a different module on it.
- **PII / privacy**: project names, descriptions, and module names may be sensitive (client work). They are returned only to authorised roles (admin, manager, or the assigned developer). No special encryption-at-rest is added beyond what the database already provides — that is a platform-wide concern, not a projects-module concern.

## Requirements *(mandatory)*

### Functional Requirements

**Entity ownership**

- **FR-001**: The `projects` module MUST be the only module that defines the `Project` and `ProjectModule` SQLModels and the only module that issues SQL against the `project` and `project_module` tables. The `payments` module (when it ships) consumes them through foreign keys; it MUST NOT redefine the models.
- **FR-002**: This module MUST NOT define any payment-transaction logic, invoice rendering, or auth/user mutation. Those concerns live in `payments`, `auth`, and `users` respectively.
- **FR-003**: The `Project` entity MUST include: `id` (PK, integer, autoincrement), `name` (string, 1..200 chars, NOT NULL), `description` (text, nullable), `client_id` (FK → `client.id`, NOT NULL), `total_amount` (Decimal(12,2), > 0, NOT NULL), `company_share` (Decimal(5,2), default 30.00, NOT NULL), `developer_share` (Decimal(5,2), default 70.00, NOT NULL), `start_date` (date, NOT NULL), `end_date` (date, NOT NULL, ≥ `start_date`), `status` (enum-string `pending|active|completed`, default `pending`, NOT NULL), `is_active` (boolean, default `true`, NOT NULL), `created_at` (UTC datetime, NOT NULL), `updated_at` (UTC datetime, NOT NULL, app-bumped on every successful write).
- **FR-004**: The `ProjectModule` entity MUST include: `id` (PK, integer), `project_id` (FK → `project.id`, NOT NULL), `name` (string, 1..200, NOT NULL), `description` (text, nullable), `assigned_developer_id` (FK → `user.id`, NOT NULL), `progress` (integer, 0..100, default 0, NOT NULL), `status` (enum-string `pending|in_progress|completed`, default `pending`, NOT NULL, derived from `progress`), `share_percentage` (Decimal(5,2), 0.01..70.00, NOT NULL), `is_active` (boolean, default `true`, NOT NULL), `created_at` (UTC datetime, NOT NULL), `updated_at` (UTC datetime, NOT NULL, app-bumped on every successful write).

**Reads**

- **FR-005**: `POST /projects` MUST validate that `client_id` references an `is_active = true` row in the `client` table; otherwise HTTP 422.
- **FR-006**: `start_date` and `end_date` are dates; on every create or update that touches them, `end_date >= start_date` is mandatory (HTTP 422 otherwise).
- **FR-007**: The system MUST expose `GET /projects` returning every `is_active = true` project. Admins and managers see every row; developers see only projects they have at least one assigned active module on (FR-008).
- **FR-008**: `GET /projects` and `GET /projects/{id}` MUST filter the result for developers to projects with at least one `project_module` row where `assigned_developer_id = current_user.id` AND `is_active = true`. A developer reading a project they are not assigned to MUST receive HTTP 404 (not 403; the existence is hidden).
- **FR-022**: `GET /projects/{id}/progress` MUST return `{project_id, progress, modules: [...]}` where `progress` is the simple arithmetic mean of the `progress` values of every `is_active = true` module on the project, or `0.0` when there are no active modules.

**Writes**

- **FR-009**: `POST /projects/{id}/modules` and `PATCH /modules/{id}` (when `assigned_developer_id` is provided) MUST validate that the referenced user exists, has `role = "developer"`, and `is_active = true`; otherwise HTTP 422.
- **FR-010**: `POST /projects/{id}/modules` MUST reject any request that would cause the sum of `share_percentage` across all `is_active = true` modules of the project to exceed 70.00 (HTTP 422). Equality (sum == 70.00) is allowed.
- **FR-011**: `PATCH /modules/{id}` MUST evaluate the share-cap rule with the module's own current share excluded from the sum (a no-op share PATCH never collides with itself).
- **FR-012**: A `PATCH` body that updates no field (empty body, or every provided field is `null`) MUST return HTTP 422.
- **FR-013**: `PATCH /projects/{id}` with `{status:"active"}` MUST run an activation gate: the sum of `share_percentage` across all `is_active = true` modules on the project must equal exactly 70.00 (Decimal). If not, HTTP 422 with the current sum embedded in the detail message.
- **FR-014**: The system MUST NOT accept `status:"completed"` from any client. The `active → completed` transition MUST happen automatically on any successful write (`POST /projects/{id}/modules`, `PATCH /modules/{id}`, `PATCH /modules/{id}/progress`, `DELETE /modules/{id}`) when the post-write state of the project's active modules satisfies: at least one module exists AND every active module has `progress = 100`.
- **FR-015**: Backwards transitions (`active → pending`, `completed → active`, `completed → pending`) MUST be rejected (HTTP 422). The only legal manual transition is `pending → active`. The only legal automatic transition is `active → completed`. Restoration of completed → active is out of scope.
- **FR-016**: `POST /projects/{id}/modules` and any module mutation (`PATCH /modules/{id}`, `PATCH /modules/{id}/progress`, `DELETE /modules/{id}`) MUST be rejected with HTTP 422 when the parent project is in `status = "completed"`. The detail message says `"cannot mutate modules on a completed project"`.
- **FR-021**: `PATCH /modules/{id}/progress` MUST be rejected with HTTP 422 when the parent project is NOT in `status = "active"` (i.e. `pending` or `completed`).
- **FR-017**: All write endpoints MUST set `updated_at` (on the affected entity, AND on the parent project for any module-level write) to the current UTC time.
- **FR-018**: Request bodies on every endpoint in this feature MUST be closed (`extra="forbid"`); unknown fields cause HTTP 422. Server-set fields (`id`, `created_at`, `updated_at`, `is_active`, `company_share`, `developer_share`, `status` on create, `progress` on create) MUST NOT appear in `*Create` schemas — supplying them is HTTP 422.
- **FR-019**: `PATCH /modules/{id}/progress` MAY be called by admins, managers, or the developer who is currently `assigned_developer_id` on the module. Any other developer receives HTTP 403.
- **FR-020**: On every successful `PATCH /modules/{id}/progress` (and on every `POST /projects/{id}/modules`), the system MUST set the module's `status` from `progress`: `0 → "pending"`, `1..99 → "in_progress"`, `100 → "completed"`. Clients MUST NOT supply `status` on these endpoints.
- **FR-023**: Soft-deleted modules MUST be invisible to every read endpoint and MUST be excluded from the share-cap sum (FR-010), the activation gate (FR-013), the auto-completion rule (FR-014), and the progress aggregator (FR-022). A soft-deleted module's `share_percentage` is therefore freed for re-use within the same project.

**Authorisation invariants**

- **FR-024**: All endpoints in this feature MUST require a valid bearer token; unauthenticated requests MUST return HTTP 401.
- **FR-025**: Role checks MUST be enforced via the existing `require_admin` / `require_any` dependencies from `app.modules.auth.dependencies`. No ad-hoc role checks inside service or route code, except the developer-assignment check on `PATCH /modules/{id}/progress` (FR-019), which MUST live in the service layer.
- **FR-026**: A request that targets a non-existent (or soft-deleted) project / module id MUST return HTTP 404 with a generic body. The body MUST NOT distinguish "never existed" from "soft-deleted".

**Module boundaries**

- **FR-027**: The `projects` module MUST NOT import any business logic from `auth.service`, `auth.repository`, `users.service`, `payments.*`, or any future module. It MAY import:
  - `app.modules.auth.dependencies` (infrastructure: `get_current_user`, `require_admin`, `require_any`),
  - `app.modules.auth.schema` for the role `Literal` (closed contract),
  - `app.modules.users.repository` for read-only developer lookups (`get_user_by_id`, optional `list_developers`),
  - `app.modules.clients.repository` for read-only `get_client_by_id` (FR-005 enforcement).
  A grep audit script MUST enforce this (mirror of `audit_clients_imports.sh`) and run in CI.
- **FR-028**: The `Project` and `ProjectModule` SQLModels MUST live only in `app/modules/projects/model.py`. No other module may redefine them.

### Key Entities

- **Project**: a unit of paid work for a Client. Owns its lifecycle (`pending → active → completed`) and the 30/70 split as immutable defaults set at creation time.
  - `id` — PK.
  - `client_id` — FK to `client.id` (the Client owns the relationship; one Client → many Projects).
  - `name`, `description` — display.
  - `total_amount` — agreed-upon project value (currency unit is implicit; see Assumptions).
  - `company_share`, `developer_share` — fixed at 30 and 70. Server-set; clients cannot supply.
  - `start_date`, `end_date` — calendar dates; `end_date ≥ start_date`.
  - `status` — `pending` (default), `active` (after manual activation gate passes), `completed` (auto when all modules at 100).
  - `is_active` — soft-delete flag.
  - `created_at`, `updated_at` — UTC.
- **ProjectModule**: a sub-task on a Project, owned by exactly one developer.
  - `id` — PK.
  - `project_id` — FK to `project.id` (one Project → many Modules).
  - `assigned_developer_id` — FK to `user.id`; the user must have `role = "developer"` and `is_active = true` at assignment time. May be reassigned later.
  - `name`, `description` — display.
  - `progress` — integer 0..100; the developer's primary mutation surface.
  - `status` — derived from `progress`; `pending` at 0, `in_progress` at 1..99, `completed` at 100.
  - `share_percentage` — Decimal(5,2), 0.01..70.00; the slice of the project's 70% developer pool this module is worth. The sum of active modules' `share_percentage` on a project ≤ 70.00 always; equals 70.00 to activate.
  - `is_active` — soft-delete flag.
  - `created_at`, `updated_at` — UTC.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin or manager can create a project in under 200 ms (median, against the in-memory test database). Verified by an integration test that posts a valid payload and asserts HTTP 201.
- **SC-002**: An admin can walk the full project lifecycle (`POST project → POST 3 modules summing to 70 → PATCH activate → PATCH each module progress to 100 → assert auto-complete → DELETE project`) without ever issuing a direct database query and without a single 4xx surprise. Verified by a single integration scenario.
- **SC-003**: A developer who attempts any forbidden endpoint in this feature returns HTTP 403; a developer who attempts a read on a project they are not assigned to returns HTTP 404 (never 403, never 200). Verified by a parametrised test that walks every endpoint with a developer token in both states.
- **SC-004**: The system never permits the sum of active modules' `share_percentage` on a project to exceed 70.00, and never permits a project to leave `pending` until that sum equals exactly 70.00. Verified by integration tests covering both the boundary cases (`60 + 10 = 70`, `60 + 11 = 422`, activation at 60 = 422, activation at 70 = 200).
- **SC-005**: A project flips from `active` to `completed` automatically the first moment every active module reads `progress = 100`, with no client request to do so. Verified by an integration scenario that watches the status field across three progress updates.
- **SC-006**: Soft-deleted projects and modules are invisible to every public read and excluded from every aggregate computation. Verified by an integration test that deletes a module mid-project and asserts both that `GET /projects/{id}/progress` excludes it and that its `share_percentage` is freed for re-use.
- **SC-007**: The `Project` and `ProjectModule` SQLModels exist in exactly one module. Verified by a CI grep audit that fails if `class Project(SQLModel, table=True)` or `class ProjectModule(SQLModel, table=True)` appears outside `app/modules/projects/model.py`.
- **SC-008**: The `projects` module imports nothing from `auth.service`, `auth.repository`, `users.service`, or `payments.*`, and from `users` it imports only `repository.get_user_by_id` (and optionally `list_developers`). Verified by `backend/scripts/audit_projects_imports.sh` running in CI.

## Assumptions

- **Pagination**: `GET /projects` returns the full active list during MVP. Cardinality is expected to remain under a few hundred rows. Same future-compatibility hatch as features 002–004: when pagination becomes necessary, the response is wrapped in `{"items": [...], "next_cursor": "..."}`.
- **Currency**: `total_amount` is a Decimal with no currency code attached. The platform is single-currency for MVP. A future `currency` column or a platform-wide setting will be the upgrade path; not preempted.
- **30/70 immutability**: `company_share` and `developer_share` are stored on each project but never accepted from clients. This is deliberate: even though they are server-fixed today, persisting them means a future ADR can change the split for new projects without rewriting old ones (the column carries the rule that was active at create time).
- **Decimal vs float for `share_percentage`**: stored as `Decimal(5,2)`. The cap check (FR-010) and activation gate (FR-013) use Decimal arithmetic. The `progress` aggregator (FR-022) returns a `float` rounded to one decimal — the average is presentational, not a financial figure.
- **Soft delete is one-way**: like clients (feature 004), there is no restoration endpoint. A future `restore` slice can be added without breaking this feature's invariants.
- **Auto-completion fires once**: the moment every active module hits 100. If a module is later soft-deleted from a `completed` project, the project does NOT flip back to `active` (a `completed` project rejects all module mutations per FR-016).
- **Developer-only mutation surface**: the only endpoint a developer may call is `PATCH /modules/{id}/progress` (and only on their own modules). All other writes are admin/manager-only. This is stricter than US7 of feature 003 (where developers had read access to themselves) — and is the intended permission model: developers report progress, they do not allocate work.
- **Concurrency on share-cap**: handled by the in-transaction proactive read; for SQLite-tests the race is structurally absent (single connection). Postgres-prod is sufficient at default isolation because the cap check is the cheap path; the rare race results in one of the two requests returning 422 on a retry, which is acceptable for an MVP.
- **Audit trail**: every write bumps `updated_at` on the row (and on the parent project for module writes). A separate audit log (who changed what, before/after) is **not** part of this feature; it lives in a future `audit` module.
- **Role enum source**: the `Literal["admin", "manager", "developer"]` continues to live in `app.modules.auth.schema`. Projects imports it (does not redefine).
- **Calendar / timezone**: `start_date` / `end_date` are `date`, not `datetime`. The platform is single-region for MVP; a future enhancement may attach a project-level timezone.
- **No FK on `assigned_developer_id` to a developer-only constraint**: the FK references `user.id`. The role-must-be-developer rule (FR-009) is enforced at the application layer, not via DB CHECK, because the user's role can change in principle (admins are mortal and may be demoted). Today the rule is enforced at write time; a future trigger or a dedicated `developer_user` view is the upgrade path.

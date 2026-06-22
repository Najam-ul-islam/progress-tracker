# Feature Specification: Scoped Financial Visibility for Developer Dashboard

**Feature Branch**: `016-scoped-financial-visibility`
**Created**: 2026-06-21
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Projects + Reporting. Enforce least-privilege financial visibility. Developers must only see data scoped to their own assigned modules: module_allocation, module_status, earned_amount. They must NEVER see total_project_amount, company_reserve, or other developers' module data. Admins see full financial breakdown. Two distinct schemas: DeveloperProjectView (scoped) and AdminProjectView (full). Authorization checks user_id == assigned_developer_id on the module record itself. Enforce at API/schema level, not just UI hiding.

**Resolved decisions** (from this session):

1. **Schema split**: `GET /projects`, `GET /projects/{id}`, and `GET /projects/{id}/progress` return different shapes based on caller role. Admin/manager receive full `ProjectRead` (existing). Developer receives new `DeveloperProjectView` with only their own modules and computed financial fields.
2. **Endpoint scoping**: The developer-facing paths filter to `assigned_developer_id = requester.id` at the repository level (not just in the response serializer), so a developer cannot enumerate other developers' modules by manipulating request parameters.
3. **Computed fields**: `module_allocation` = `total_amount * share_percentage / 100` (derived from the 30/70 split); `earned_amount` = `module_allocation * (progress / 100)`.
4. **Progress endpoint**: `GET /projects/{id}/progress` already filters visibility via `get_project_for_user`; the remaining leak is that it returns ALL active modules for the project. We add an additional filter: `modules` array is further reduced to `assigned_developer_id == requester.id` when the caller is a developer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin/manager reads full project view (Priority: P1)

An admin or manager calls `GET /projects` or `GET /projects/{id}` and receives the full `ProjectRead` response: `id, name, description, client_id, total_amount, company_share, developer_share, start_date, end_date, status, is_active, created_at, updated_at`. They also see the full module breakdown via `GET /projects/{id}/progress` (or the reporting layer), including every module's `assigned_developer_id`, `share_percentage`, and progress.

**Why this priority**: P1 because admin/manager visibility is the existing contract; this story preserves it unchanged and defines the baseline the developer view is carved away from.

**Independent Test**: Seed a project with two modules assigned to two different developers. Login as admin, call `GET /projects/{id}` and `GET /projects/{id}/progress`. Assert both responses contain `total_amount`, `company_share`, `developer_share`, and both modules (with their distinct `assigned_developer_id` values).

**Acceptance Scenarios**:

1. **Given** an admin and an existing project with two modules, **When** `GET /projects/{id}` is called, **Then** the response is HTTP 200 with `total_amount`, `company_share`, `developer_share`, `client_id`, and all project metadata.
2. **Given** a manager, **When** `GET /projects/{id}` is called, **Then** the response is HTTP 200 with the same full shape.
3. **Given** an admin, **When** `GET /projects/{id}/progress` is called, **Then** the response contains every active module with its `assigned_developer_id`, `share_percentage`, and `progress`.
4. **Given** no `Authorization` header, **When** any read endpoint is called, **Then** the response is HTTP 401.

---

### User Story 2 — Developer reads scoped project view (Priority: P1)

A developer calls `GET /projects` and sees only projects they are assigned to, each rendered as `DeveloperProjectView`: `id, name, description, status, is_active, modules: [{id, name, progress, status, module_allocation, earned_amount}]`. They call `GET /projects/{id}` for an assigned project and see the same scoped shape. The response never includes `total_amount`, `company_share`, `developer_share`, `client_id`, or any module belonging to another developer.

**Why this priority**: P1 because least-privilege financial visibility is the core security requirement of this feature. A developer reading a project they are assigned to must learn their own module's financials — and nothing else.

**Independent Test**: Seed a project with two modules: module A (developer 1, 35% share, progress 50) and module B (developer 2, 35% share, progress 100). Login as developer 1, call `GET /projects/1` and `GET /projects/1/progress`. Assert HTTP 200. Assert the response body contains NO keys `total_amount`, `company_share`, `developer_share`, `client_id`. Assert `modules` contains exactly one entry (module A) with `module_allocation = 3500.00` and `earned_amount = 1750.00` (for a 10000-total project). Repeat as developer 2 and assert module B only.

**Acceptance Scenarios**:

1. **Given** a developer assigned to module A on project 1, **When** `GET /projects/1` is called, **Then** the response is HTTP 200 with `DeveloperProjectView`: `{id, name, description, status, is_active, modules:[{id, name, progress, status, module_allocation, earned_amount}]}`. The response body MUST NOT contain `total_amount`, `company_share`, `developer_share`, `client_id`, or `assigned_developer_id` in the module entries.
2. **Given** the same developer, **When** `GET /projects/{id}/progress` is called, **Then** the response is HTTP 200 with `{project_id, progress, modules:[{id, name, progress, share_percentage, module_allocation, earned_amount}]}` and the `modules` array contains only the developer's own module(s).
3. **Given** a developer with two modules on the same project, **When** either endpoint is called, **Then** the response contains both of that developer's modules (no merging into a single total).
4. **Given** a developer, **When** `GET /projects` is called, **Then** the response is HTTP 200 and contains only projects where the developer has at least one assigned module; each project entry uses `DeveloperProjectView`.
5. **Given** a developer not assigned to any module on project X, **When** `GET /projects/X` or `GET /projects/X/progress` is called, **Then** the response is HTTP 404 (invisible).
6. **Given** no `Authorization` header, **When** any read endpoint is called, **Then** the response is HTTP 401.

---

### User Story 3 — Developer cannot read another developer's module data (Priority: P1)

A developer who is NOT the `assigned_developer_id` on a module receives HTTP 403 if they attempt to access it through any endpoint that would reveal its financial data. Calling `GET /projects/{id}/progress` for a project they are assigned to (via a different module) returns only their own module(s); they never see the progress, share, or financials of other developers' modules on the same project.

**Why this priority**: P1 because cross-developer data leakage is the exact security hole this feature closes. The authorization check lives on the module record (not just role-based checks) so guessing/changing a module ID has no effect.

**Independent Test**: Seed project 1 with module A (dev 1, 35%, progress 50) and module B (dev 2, 35%, progress 100). Login as dev 1. Call `GET /projects/1/progress` — assert the response contains only module A. Attempt to call the same endpoint for a project where dev 1 has NO modules — assert HTTP 404.

**Acceptance Scenarios**:

1. **Given** a developer assigned to module A on project 1 (but not module B), **When** `GET /projects/1/progress` is called, **Then** the `modules` array contains only module A. Module B's `progress`, `share_percentage`, and any computed financials are absent.
2. **Given** a developer, **When** they attempt to access `GET /projects/{id}` for a project they are assigned to (via module A), **Then** the response is HTTP 200 but the `modules` array contains only their own modules.
3. **Given** a developer, **When** they call `GET /projects/{id}/progress` for a project they are NOT assigned to, **Then** the response is HTTP 404.

---

### Edge Cases

- **Multiple modules, same developer**: if a developer owns two modules on one project, both appear in the `modules` array. No single `total_earned` field replaces the per-module breakdown.
- **Progress edge**: `earned_amount = module_allocation * (progress / 100)` uses integer progress; `module_allocation` is derived from `total_amount × share_percentage / 100` (consistent with the 30/70 split).
- **Soft-deleted module**: excluded from the developer's view just as it is from the admin view (continuity from FR-023 of feature 005).
- **Reassignment**: if an admin moves a module from dev A to dev B, dev A no longer sees it; dev B sees it on their next read.
- **Decimal precision**: `module_allocation` and `earned_amount` are `Decimal` serialized as JSON strings (two fractional digits), matching the platform's money convention.
- **Existing consumer contracts**: `GET /projects` and `GET /projects/{id}` for admin/manager continue to return `ProjectRead` exactly as before. Only the developer path changes shape.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-029**: `GET /projects/{id}` and `GET /projects` MUST return `DeveloperProjectView` (not `ProjectRead`) when the caller is a developer. The `DeveloperProjectView` shape MUST NOT include `total_amount`, `company_share`, `developer_share`, or `client_id`.
- **FR-030**: `GET /projects/{id}/progress` MUST return only modules where `assigned_developer_id == requester.id` when the caller is a developer. Admin/manager receive all active modules (unchanged behavior).
- **FR-031**: Each module entry in `DeveloperProjectView` MUST include:
  - `id`, `name`, `progress`, `status` (existing read fields)
  - `module_allocation`: Decimal string, computed as `project.total_amount * module.share_percentage / 100`
  - `earned_amount`: Decimal string, computed as `module_allocation * (module.progress / 100)`
- **FR-032**: Authorization MUST check `user_id == assigned_developer_id` at the repository query level (not in the response formatter), so a developer cannot leak other developers' data by guessing module IDs or project IDs.
- **FR-033**: A developer assigned to a project MUST receive HTTP 200 from `GET /projects/{id}`; a developer NOT assigned MUST receive HTTP 404 (continuity from FR-008 / FR-026 of feature 005).
- **FR-034**: A developer with no assigned modules MUST receive `[]` from `GET /projects` (HTTP 200), not 404.
- **FR-035**: `GET /payments/developer/me` and the new project developer view MUST never cross-leak. The project developer view shows project-level scoped data; the payments developer view shows payment-row scoped data. Neither exposes the other's aggregate totals.
- **FR-036**: All developer-facing endpoints MUST enforce the closed-schema rule (`extra="forbid"`) on request bodies (continuity from FR-018 of feature 005).

### Key Entities

- **DeveloperProjectView**: a scoped read DTO for developers. Contains the project's identity and status fields but excludes all financial aggregates. Its `modules` array contains only the caller's own active modules, each annotated with `module_allocation` and `earned_amount`.
  - Fields: `id`, `name`, `description`, `status`, `is_active`, `modules: [DeveloperModuleView]`
- **DeveloperModuleView**: a scoped read DTO for a single module as seen by its assignee.
  - Fields: `id`, `name`, `progress`, `status`, `module_allocation`, `earned_amount`
- **AdminProjectView**: the existing `ProjectRead` schema (unchanged). Admins and managers continue to receive full financial exposure through the existing endpoints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-009**: A developer calling `GET /projects/{id}` for an assigned project receives HTTP 200 with a body that contains NO keys `total_amount`, `company_share`, `developer_share`, or `client_id`. Verified by integration test.
- **SC-010**: A developer calling `GET /projects/{id}/progress` receives a `modules` array whose every entry's `assigned_developer_id` equals the caller's id. Verified by test with two developers on the same project.
- **SC-011**: A developer calling `GET /projects` receives only projects where they have at least one assigned module. Verified by seeding two projects and asserting the unassigned project is absent.
- **SC-012**: A developer with no assignments receives `[]` from `GET /projects` (HTTP 200), not 404. Verified by test fixture.
- **SC-013**: Admin and manager responses are unchanged. `GET /projects/{id}` still returns `ProjectRead` with all original fields. Verified by regression tests on the admin path.
- **SC-014**: `module_allocation` and `earned_amount` are computed from `total_amount × share_percentage / 100` and match the payments module's distribution arithmetic to the cent. Verified by cross-checking against a seeded Payment.

## Assumptions

- **No pagination**: developer module arrays remain under a handful of rows in MVP.
- **Single currency**: all `module_allocation` and `earned_amount` values follow the single-currency convention.
- **Closed schema**: all response schemas continue to be documented; developer-facing schemas explicitly omit sensitive fields rather than returning `null` for them.
- **Progress endpoint is additive**: the `modules` array in `GET /projects/{id}/progress` for developers is reduced to their own modules; no other fields in the response change for the developer path (the top-level `project_id` and `progress` aggregate remain, computed over all active modules to preserve roadmap value).
- **No frontend migration**: this spec is backend-only. The frontend may optionally adopt `DeveloperProjectView` for its project-detail page, but masking is enforced at the API boundary regardless of what the UI does.

# Feature Specification: Projects Dashboard (Frontend)

**Feature Branch**: `012-projects-dashboard`
**Created**: 2026-06-14
**Status**: Draft
**Backend Reference**: `005-projects` (API endpoints: `/projects`, `/modules`)
**Input**: User description (verbatim):
> Build project management UI.
> Pages: Projects dashboard, Project details, Module assignment page, Progress tracking page.
> Features: Kanban/table views, Progress bars, Module assignment, Developer assignment, Timeline tracking, Status badges.

## User Scenarios & Testing

### User Story 1 — Admin or Manager Views Projects Dashboard (Priority: P1)

An admin or manager opens the "Projects" page and sees a list of all active projects. They can toggle between a **Table view** (for data density) and a **Kanban-style view** (grouped by status: Pending, Active, Completed). Each project card/row shows the project name, client name, total amount, aggregate progress bar, and status badge.

**Independent Test**: Login as admin/manager -> navigate to `/projects` -> assert table renders with columns (Name, Client, Amount, Progress, Status). Toggle to Kanban view -> assert columns (Pending, Active, Completed) exist and projects are grouped correctly. Developer login -> assert they only see projects they are assigned to.

**Acceptance Scenarios**:
1. **Given** multiple projects exist, **When** an admin navigates to `/projects`, **Then** they see a table with all active projects.
2. **Given** a status-based Kanban view, **When** toggled, **Then** projects appear in columns: "Pending", "Active", "Completed".
3. **Given** a project with modules at 50% average progress, **Then** a progress bar shows 50% filled.
4. **Given** a project in "Pending" status, **Then** it has a "Pending" badge (slate/gray). "Active" is blue/indigo, "Completed" is green.

---

### User Story 2 — Admin or Manager Manages Project Details & Modules (Priority: P1)

An admin or manager clicks a project to see its details. They see the project's metadata (Client, Dates, Total Amount) and a list of modules. They can "Add Module" via a dialog, assigning a developer and a share percentage (validated against the 70% cap).

**Independent Test**: Admin clicks Project A -> sees details. Clicks "Add Module" -> enters name, selects Developer X from dropdown, enters share (e.g., 20%). On save -> module appears in list, project aggregate progress updates.

**Acceptance Scenarios**:
1. **Given** a Project Details page, **When** "Add Module" is clicked, **Then** a dialog appears with fields for name, description, developer selection (dropdown of active developers), and share percentage.
2. **Given** a share percentage input, **When** entering a value that would exceed the 70% project total, **Then** the UI shows a validation error before submission (or handles the 422 from backend).
3. **Given** a "Pending" project with exactly 70% modules allocated, **When** the "Activate" button is clicked, **Then** the project status flips to "Active".

---

### User Story 3 — Developer Tracks and Updates Progress (Priority: P1)

A developer logs in and sees a "My Modules" dashboard (or a filtered view in the Projects list). They can see their assigned modules and update the progress percentage (0-100) via a slider or input.

**Independent Test**: Login as Developer X -> navigate to "My Modules" -> see "Auth Slice" module for "Project A". Move slider to 100% -> module status updates to "Completed". If all other modules for Project A are also 100% -> Project status updates to "Completed" on next refresh.

**Acceptance Scenarios**:
1. **Given** a developer's dashboard, **When** they view their modules, **Then** they see a "Update Progress" affordance for each.
2. **Given** a progress update dialog/row, **When** progress is set to 100, **Then** the status badge for that module turns green/Completed.
3. **Given** a developer is not assigned to a module, **Then** they cannot see the project or its details (FR-008).

---

## Requirements

### UI Components

- **ProjectList**:
  - `ProjectTable`: Columns: Name, Client, Budget, Progress Bar, Status, Dates, Actions.
  - `ProjectKanban`: Columns: Pending, Active, Completed. Project cards with name, client, progress bar.
- **ProjectDetails**:
  - `ProjectInfoCard`: Client, Total Amount, Dates (Timeline), Status Badge.
  - `ModulesList`: Table showing Name, Assigned Developer, Share %, Progress, Status.
- **Modals/Dialogs**:
  - `CreateProjectDialog` (Admin/Manager).
  - `CreateModuleDialog` (Admin/Manager): Includes Developer search/dropdown.
  - `UpdateProgressDialog` (Developer/Manager/Admin): Slider/Number input (0-100).
- **Widgets**:
  - `ProgressBar`: Visual fill based on `progress` value.
  - `StatusBadge`: Colors per status (Pending=Slate, Active=Blue, Completed=Green).
  - `TimelineTracking`: Visual "Start -> End" indicator or date range.

### Functional Requirements

- **FR-001 (Dashboard Views)**: Support toggling between Table and Kanban views on the main projects page.
- **FR-002 (RBAC Filtering)**: Developers see only projects/modules where they are the `assigned_developer_id`.
- **FR-003 (Share Validation)**: Frontend should warn if module share sum > 70% before submitting `POST /projects/{id}/modules`.
- **FR-004 (Activation Gate)**: "Activate" button on Project Details is only enabled/visible when project is `pending` and module sum is exactly 70.00.
- **FR-005 (Progress Sync)**: Module progress updates should trigger a refresh of the parent project status/progress (TanStack Query invalidation).
- **FR-006 (Timeline)**: Display "Days Remaining" or "Duration" based on `start_date` and `end_date`.

### Success Criteria

- **SC-001**: Admin can create a project, add modules totalling 70%, and activate it entirely through the UI.
- **SC-002**: Developer can find their assigned module and push progress to 100%.
- **SC-003**: The UI correctly handles 422 errors (validation) and 403 errors (RBAC) with user-friendly alerts.
- **SC-004**: Kanban view correctly groups projects by status.

## Technical Context

- **Routing**:
  - `/projects`: Main dashboard (Table/Kanban).
  - `/projects/:id`: Details + Module management.
  - `/my-modules`: (Optional) dedicated developer view or just filtered `/projects`.
- **API (from 005-projects)**:
  - `GET /projects`: List.
  - `GET /projects/{id}`: Detail.
  - `POST /projects`: Create.
  - `PATCH /projects/{id}`: Update/Activate.
  - `POST /projects/{id}/modules`: Add module.
  - `PATCH /modules/{id}/progress`: Developer update.
  - `GET /projects/{id}/progress`: Aggregate data.
- **State Management**: React Query (TanStack Query) for server state. Query keys: `['projects']`, `['projects', id]`, `['projects', id, 'progress']`.
- **Forms**: React Hook Form + Zod.

# Feature Specification: Developer Dashboard (Frontend)

**Feature Branch**: `017-developer-dashboard`
**Created**: 2026-06-22
**Status**: Draft
**Backend References**: `005-projects` (`GET /projects`, `PATCH /modules/{id}/progress`), `006-payments-distribution` (`GET /payments/developer/me`), `007-reporting` (`GET /reports/developers/me`), `008-notifications` (`GET /notifications`)
**Input**: User description (verbatim):

> MODULE: Developer Dashboard
>
> PURPOSE: Provide developers with a dedicated workspace to manage assigned modules, update progress, view earnings, deadlines, and project activity.
>
> FEATURES: 1. Dashboard Overview (Assigned Projects, Assigned Modules, Pending Tasks, Upcoming Deadlines, Earnings Summary). 2. My Modules (List assigned modules, Progress percentage, Status badges, Deadline tracking). 3. Module Progress Updates (Update progress 0-100, Change status, Add work notes/comments, View update history). 4. My Projects (View assigned projects, Project progress, Client name, Timeline). 5. Earnings (Project earnings, Module share %, Paid amount, Pending amount). 6. Notifications (New assignments, Deadline reminders, Payment updates).
>
> RBAC: Developer can view assigned projects, view assigned modules, update assigned module progress, view own earnings. Developer cannot create projects, delete projects, assign modules, or modify other developers' work.
>
> PROJECT PROGRESS: Project progress is derived from module progress. Developers update modules only.
>
> SUCCESS: Developer can manage daily work from one dashboard.

## Context

This feature is the **frontend** developer workspace layered on top of already-shipped backend slices. It introduces **no backend changes**. The platform already exposes everything a developer needs:

- `GET /reports/developers/me` (feature 007) returns the developer's self-report: their module list (with `module_id`, `module_name`, `project_id`, `project_name`, `progress`, `status`, `share_percentage`, `amount_paid`, `amount_pending`), module counts by status, an earnings block, and project completion counts.
- `PATCH /modules/{id}/progress` (feature 005) updates a single module's progress (integer 0–100). Module **status is derived from progress on the backend** (0 = pending, 1–99 = in_progress, 100 = completed); there is no independent status field a developer can set, and progress updates are gated so a developer may only update modules where they are the `assigned_developer_id`.
- `GET /payments/developer/me` (feature 006) returns the developer's own `DeveloperPayment` rows (per-module `share_percentage`, `amount`, `status` of `pending|paid`, plus `project_id`). Other developers' rows and the company reserve are never disclosed.
- `GET /projects` (feature 005) returns only the projects a developer is assigned to when called with a developer token.
- `GET /notifications` (feature 008) returns the caller's personal notification feed, including `type` values `assignment | payment | payment_paid | deadline | system`.

The `009-auth-ui` MVP established the frontend foundation (Axios `http`, Zustand `session.store`, TanStack Query, React Router with `RequireAuth`, `AppHeader` chrome, shadcn primitives). Dashboards `010`–`015` established the page/module/RBAC conventions this feature follows, including `frontend/src/lib/rbac.ts` helpers (`canViewProjects`, `canViewEarnings`, `canUpdateProgress`, `canViewOwnPerformance`) and the existing `/earnings` and `/analytics/developers` routes. This feature unifies those scattered developer-facing surfaces into one cohesive, developer-first dashboard so a developer never has to navigate admin-oriented pages to do their daily work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer sees their day at a glance (Priority: P1) 🎯 MVP

A developer signs in and lands on a **Developer Dashboard** home view that summarizes their work in one screen: the count of projects they are assigned to, the count of assigned modules broken down by status (pending / in progress / completed), the modules still needing attention ("pending tasks"), the modules with the nearest deadlines ("upcoming deadlines"), and an earnings summary (total earned, paid, pending). This is the single landing surface that answers "what do I need to do today, and what am I owed?" without drilling into admin pages.

**Why this priority**: This is the smallest end-to-end slice that delivers the feature's stated success criterion ("Developer can manage daily work from one dashboard"). It is the entry point every other story hangs off of, and it is fully deliverable from the existing `GET /reports/developers/me` payload plus the deadline data already on assigned projects/modules.

**Independent Test**: Sign in as a developer seeded with assignments across 2 projects and 4 modules (1 completed, 2 in progress, 1 pending) and a mix of paid/pending earnings. Navigate to the dashboard home. Confirm the overview shows `Assigned Projects = 2`, an assigned-modules breakdown of `completed 1 / in progress 2 / pending 1`, a pending-tasks list containing the 3 non-completed modules, an upcoming-deadlines section ordered by nearest deadline, and an earnings summary whose paid + pending totals match the seeded data.

**Acceptance Scenarios**:

1. **Given** a signed-in developer with assignments, **When** the dashboard home renders, **Then** they see overview cards for Assigned Projects (count), Assigned Modules (count with status breakdown), Pending Tasks (count of non-completed modules), Upcoming Deadlines, and Earnings Summary (total / paid / pending).
2. **Given** a developer with zero assignments, **When** the dashboard home renders, **Then** each section shows a friendly empty state ("No assigned modules yet") rather than empty boxes or errors.
3. **Given** the dashboard data is still loading, **When** the page renders, **Then** skeleton/pulse loaders appear in place of each card rather than a flash of empty content.
4. **Given** the dashboard fetch fails, **When** the page renders, **Then** an inline error with a "Try again" affordance renders and retrying recovers without a full page reload.
5. **Given** a non-developer (admin or manager) navigates to the developer dashboard route, **When** the route resolves, **Then** they are redirected to their own home/dashboard or shown an access-denied state (this workspace is developer-scoped).
6. **Given** modules with deadlines in the past and future, **When** the Upcoming Deadlines section renders, **Then** modules are ordered by nearest deadline first and overdue items are visually flagged (e.g., red).

---

### User Story 2 — Developer browses and updates their modules (Priority: P1)

A developer opens a **My Modules** view listing every module assigned to them, each showing the module name, parent project, progress percentage (with a progress bar), a status badge (Pending / In Progress / Completed), and its deadline. From a module row the developer opens an **Update Progress** control (slider or numeric input, 0–100) and saves. On save, the module's progress and derived status update, the parent project's aggregate progress reflects the change, and the dashboard earnings/overview re-fetch.

**Why this priority**: Updating progress is the single write action a developer performs and the core of "manage assigned modules." It is P1 because a read-only dashboard does not let a developer *manage* their work. It is fully served by `PATCH /modules/{id}/progress`.

**Independent Test**: Sign in as a developer with an in-progress module at 40%. Open My Modules, confirm the row shows 40% and an "In Progress" badge. Open the update control, set progress to 100, save. Confirm the row now shows 100% and a "Completed" badge, the parent project's progress increases, and a non-assigned module is not editable (its update control is absent or disabled).

**Acceptance Scenarios**:

1. **Given** a developer with assigned modules, **When** they open My Modules, **Then** each module shows name, parent project, progress bar with percentage, status badge, and deadline.
2. **Given** a module row, **When** the developer opens the update control and sets progress to a value 0–100 and saves, **Then** the request succeeds, the row's progress and derived status update, and the view reflects the new value without a full page reload.
3. **Given** progress is set to 100, **When** saved, **Then** the status badge becomes "Completed" (green).
4. **Given** progress is set to 0, **When** saved, **Then** the status badge becomes "Pending"; any value 1–99 yields "In Progress".
5. **Given** the developer attempts to submit a value outside 0–100, **When** they save, **Then** the UI prevents submission with an inline validation message (and gracefully handles a backend 422 if one occurs).
6. **Given** a module the developer is **not** assigned to (should not appear, but as a guard), **When** rendered, **Then** no editable update control is offered for it.
7. **Given** the update request fails (network/500/403), **When** the developer saves, **Then** an error message appears, the optimistic value rolls back, and the developer can retry.
8. **Given** a module is updated, **When** the save succeeds, **Then** the dashboard overview earnings and the parent project progress re-fetch so all surfaces stay consistent (query invalidation).

---

### User Story 3 — Developer reviews their projects (Priority: P2)

A developer opens a **My Projects** view listing the projects they are assigned to. Each project shows the project name, client name, an aggregate progress bar (derived from its modules), the timeline (start → end / days remaining), and a status badge. Selecting a project reveals the developer's own modules within it. The developer cannot create, edit, delete, or assign — this view is read-only context for the work they do in My Modules.

**Why this priority**: Project context (client, timeline, overall progress) helps a developer prioritize across modules, but it is secondary to seeing and updating the modules themselves (US1/US2 already surface module-level deadlines and progress). P2 because the dashboard is useful without it.

**Independent Test**: Sign in as a developer assigned to 2 projects. Open My Projects; confirm both appear with client name, aggregate progress, timeline, and status. Confirm no "Create Project", "Edit", "Delete", or "Assign Module" affordances are present. Open one project; confirm only the developer's own modules within it are listed.

**Acceptance Scenarios**:

1. **Given** a developer assigned to projects, **When** they open My Projects, **Then** each project shows name, client name, aggregate progress bar, timeline (start/end or days remaining), and a status badge.
2. **Given** the My Projects view, **When** it renders for a developer, **Then** no project create/edit/delete/assign controls are visible (read-only).
3. **Given** a project with modules at mixed progress, **When** the aggregate progress bar renders, **Then** it reflects the project's derived progress (share-weighted, consistent with backend computation).
4. **Given** a developer opens a project, **When** the detail renders, **Then** only modules assigned to that developer are shown.
5. **Given** a developer with zero assigned projects, **When** they open My Projects, **Then** a friendly empty state renders.

---

### User Story 4 — Developer views their earnings (Priority: P2)

A developer opens an **Earnings** view summarizing what they have earned and what is outstanding. They see total earnings, paid amount, and pending amount, plus a per-module/per-project breakdown showing each module's share percentage, the amount, and its payment status (Pending / Paid). Other developers' amounts and the company reserve are never shown.

**Why this priority**: Earnings visibility is core developer value, but the headline totals already appear in the US1 overview; this view is the drill-down. P2 because the summary on the dashboard home already answers "what am I owed?" at a glance.

**Independent Test**: Sign in as a developer with 2 paid earning rows and 1 pending row across 2 projects. Open Earnings; confirm total = paid + pending, the breakdown lists 3 rows each with project/module, share %, amount, and a status badge, and that no other developer's rows or any company-reserve figure appears.

**Acceptance Scenarios**:

1. **Given** a developer with earning rows, **When** they open Earnings, **Then** they see total, paid, and pending summary figures and a per-row breakdown (project, module, share %, amount, status).
2. **Given** a row whose payment status is `paid`, **When** it renders, **Then** it shows a "Paid" badge; `pending` rows show a "Pending" badge.
3. **Given** a developer with no earnings, **When** they open Earnings, **Then** a friendly empty state renders and all totals show as zero.
4. **Given** any earnings surface, **When** it renders for a developer, **Then** no other developer's amounts and no company-reserve figure are ever displayed (confidentiality).

---

### User Story 5 — Developer stays informed via notifications (Priority: P3)

From the developer dashboard, the developer can see and reach their personal notifications relevant to their work: new module assignments, deadline reminders, and payment updates. The dashboard surfaces a recent-notifications affordance (and/or a count) and links to the existing notifications center; clicking a notification can deep-link to the relevant module/project where applicable.

**Why this priority**: The notifications center (feature 014) already provides the full feed and unread bell in the app header for all roles. This story is convenience integration into the developer workspace, not net-new capability — hence P3.

**Independent Test**: Sign in as a developer seeded with an `assignment`, a `deadline`, and a `payment` notification. Confirm the dashboard surfaces a recent-notifications affordance reflecting them and that a "View all" link navigates to `/notifications`.

**Acceptance Scenarios**:

1. **Given** a developer with recent notifications of types `assignment`, `deadline`, and `payment`/`payment_paid`, **When** the dashboard renders, **Then** a recent-notifications affordance shows them newest-first with type and relative time.
2. **Given** the dashboard notifications affordance, **When** the developer clicks "View all", **Then** they navigate to the notifications page (`/notifications`).
3. **Given** a developer with no notifications, **When** the affordance renders, **Then** a friendly empty state ("You're all caught up") is shown.

---

### Edge Cases

- **Developer with zero assignments**: every section (overview, modules, projects, earnings) renders a friendly empty state, never an error or blank box.
- **Module without a deadline**: the Upcoming Deadlines section and module rows handle a null/absent deadline gracefully (e.g., "No deadline set") rather than rendering an invalid date.
- **Overdue module/project**: deadlines already past are visually flagged (e.g., red) and sorted to the top of the deadlines list.
- **Concurrent progress edit**: if a developer updates progress while the dashboard is showing a stale value, the optimistic update reconciles against the server response; on conflict the server value wins.
- **Progress 100 on the last open module of a project**: the parent project's aggregate progress and status reflect completion after re-fetch; the developer view does not need to mutate the project directly.
- **Soft-deleted project with historical earnings**: per feature 006, earnings rows remain readable even if the underlying project was soft-deleted; the Earnings view must still display those historical rows without crashing on missing project metadata.
- **Role drift mid-session**: if a non-developer reaches a developer-only route, they are redirected/denied (US1 #5).
- **Backend status is derived, not set**: the UI never offers a free-form status picker; status is presented as a read-only badge that follows progress. (See Assumptions.)

## Requirements *(mandatory)*

### UI Components

- **DeveloperDashboardPage** (home/overview): cards for Assigned Projects, Assigned Modules (with status breakdown), Pending Tasks, Upcoming Deadlines, Earnings Summary; skeleton, empty, and error states.
- **MyModulesPage / MyModulesList**: rows with module name, parent project, `ProgressBar`, `StatusBadge`, deadline; an `UpdateProgressControl` (slider/number input, 0–100) per editable row.
- **MyProjectsPage / MyProjectsList**: read-only project rows with client name, aggregate `ProgressBar`, `TimelineTracking`, `StatusBadge`; project detail listing the developer's own modules.
- **EarningsView**: total/paid/pending summary plus a per-row breakdown (project, module, share %, amount, `StatusBadge`).
- **RecentNotifications affordance**: recent items (type, relative time) with a "View all" link to `/notifications`.
- **Shared widgets** (reuse existing where present): `ProgressBar`, `StatusBadge` (Pending = slate, In Progress = blue/indigo, Completed = green; payment Paid = green, Pending = amber), `KpiCard`, empty/error/loading states.
- **RequireDeveloperWorkspace** guard: restricts developer-only routes to the `developer` role.

### Functional Requirements

- **FR-001 (Single workspace)**: System MUST provide a developer-scoped dashboard home that aggregates Assigned Projects, Assigned Modules (with status breakdown), Pending Tasks, Upcoming Deadlines, and an Earnings Summary in one view.
- **FR-002 (RBAC — developer scope)**: Developer-only routes MUST be accessible to the `developer` role; admin/manager reaching them MUST be redirected or shown an access-denied state. All data shown MUST be the caller's own (assigned projects/modules, own earnings).
- **FR-003 (Read-only project/module data)**: The dashboard MUST NOT expose project create, edit, delete, or module-assignment controls to developers (consistent with backend RBAC).
- **FR-004 (Progress update)**: Developers MUST be able to update the progress (integer 0–100) of a module they are assigned to via `PATCH /modules/{id}/progress`; the UI MUST prevent out-of-range submission and handle backend 422/403 gracefully.
- **FR-005 (Derived status)**: The UI MUST present module status as a read-only badge derived from progress (0 = Pending, 1–99 = In Progress, 100 = Completed); it MUST NOT offer an independent status editor, because the backend derives status from progress.
- **FR-006 (Progress sync)**: After a successful progress update, the UI MUST invalidate/refetch the affected queries so the module list, parent project aggregate progress, dashboard overview, and earnings stay consistent.
- **FR-007 (Earnings confidentiality)**: Earnings surfaces MUST display only the caller's own amounts/share/status and MUST NEVER display another developer's figures or the company reserve.
- **FR-008 (Deadline tracking)**: The dashboard MUST surface upcoming deadlines ordered nearest-first and MUST visually flag overdue items; modules without a deadline MUST render gracefully.
- **FR-009 (Project context)**: My Projects MUST show, per assigned project, the client name, aggregate progress (derived from modules), timeline, and status badge.
- **FR-010 (Notifications integration)**: The dashboard MUST surface the developer's relevant recent notifications (assignment, deadline, payment) and link to the existing notifications center; it MUST NOT introduce a new notifications backend.
- **FR-011 (Loading/empty/error states)**: Every data-backed surface MUST render skeleton loaders while loading, friendly empty states when there is no data, and inline errors with a retry affordance on failure, without full page reloads.
- **FR-012 (No backend changes)**: The feature MUST consume only the existing endpoints from features 005/006/007/008 and MUST NOT require new backend endpoints, schema, or migrations.
- **FR-013 (Authentication)**: All developer dashboard routes MUST require an authenticated session (via the existing `RequireAuth`) and MUST handle an expired/invalid session by redirecting to login.

### Key Entities *(read-only projections of existing backend entities)*

- **DeveloperSelfReport** (from `GET /reports/developers/me`): the developer's module list (`module_id`, `module_name`, `project_id`, `project_name`, `progress`, `status`, `share_percentage`, `amount_paid`, `amount_pending`), counts (`module_count`, `modules_completed`, `modules_in_progress`, `modules_pending`, `projects_completed`, `projects_pending`), and an earnings block. Primary source for the overview, My Modules, and Earnings summary.
- **Module** (from `005-projects`): `id`, `name`, `project_id`, `assigned_developer_id`, `progress` (0–100), derived `status`, `share_percentage`, deadline (via parent project / module dates). Updated via `PATCH /modules/{id}/progress`.
- **Project** (from `005-projects`, developer-filtered `GET /projects`): `id`, `name`, client reference, `status`, aggregate progress, timeline (`start_date`/`end_date`). Read-only context.
- **DeveloperPayment** (from `GET /payments/developer/me`): per-module `share_percentage`, `amount`, `status` (`pending|paid`), `project_id`. Source for the Earnings breakdown.
- **Notification** (from `008-notifications`): `id`, `title`, `message`, `type` (`assignment | payment | payment_paid | deadline | system`), `is_read`, `created_at`. Surfaced as recent items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (One-stop workspace)**: A developer can answer "what do I work on today and what am I owed?" entirely from the dashboard home without navigating to any admin-oriented page — verified by a walkthrough where every overview figure (projects, modules-by-status, pending tasks, deadlines, earnings) is present on one screen.
- **SC-002 (Progress in under 30 seconds)**: A developer can locate an assigned module and push its progress to a new value (e.g., 100%) in under 30 seconds from landing on the dashboard, with the module status badge and parent project progress updating without a page reload.
- **SC-003 (Strict scoping)**: 0 instances of a developer seeing another developer's earnings, another developer's modules, or any project create/edit/delete/assign control — verified across the test suite.
- **SC-004 (Resilient states)**: 100% of data-backed surfaces render a skeleton while loading, a friendly empty state with no data, and a retryable error on failure — verified by toggling each state in component tests.
- **SC-005 (Deadline accuracy)**: Upcoming deadlines are ordered nearest-first with overdue items flagged; verified against seeded modules spanning past and future deadlines.
- **SC-006 (No backend footprint)**: The feature ships with zero new backend endpoints, schema changes, or migrations — verified by diffing the backend tree (frontend-only change).
- **SC-007 (Access control)**: A non-developer reaching a developer-only route is redirected/denied 100% of the time — verified by role-based route tests.

## Assumptions

- **Frontend-only, on existing backend.** Like dashboards 010–015, this feature adds no backend endpoints, schema, or migrations. All data comes from features 005/006/007/008. (FR-012, SC-006.)
- **Work notes / comments and update history are OUT OF SCOPE.** The feature request lists "Add work notes/comments" and "View update history," but no backend support exists for module-level notes or an audit/history trail, and the established pattern is frontend-on-existing-backend with no invented contracts. These are deferred to a future feature that would add the backend tables/endpoints first. The MVP delivers progress update (the one supported write) without notes/history.
- **Status is derived, not independently set.** The feature request lists "Change status," but the backend derives module status from progress (0 = pending, 1–99 = in_progress, 100 = completed) and exposes no independent status field on the progress endpoint. The UI therefore shows status as a read-only badge that follows progress; "changing status" is achieved by changing progress. (FR-005.)
- **Deadline source.** Deadlines are taken from the module's parent project timeline (`start_date`/`end_date`) and/or any module-level date already present in the existing schema; if no module-level deadline exists, project end date is used as the deadline proxy and modules without any date render "No deadline set."
- **Earnings totals reconcile** between the `DeveloperSelfReport` earnings block (overview) and `GET /payments/developer/me` (breakdown); the overview uses the report's aggregate while the Earnings drill-down lists individual `DeveloperPayment` rows.
- **Routing.** New developer routes are added under the existing `RequireAuth` tree (e.g., `/developer` or `/my-modules`, `/my-projects`); the existing `/earnings` and `/notifications` routes are reused. Exact paths are an implementation/plan decision.
- **Reuse existing primitives.** Axios `http`, Zustand `session.store`, TanStack Query, React Router, shadcn primitives, `rbac.ts` helpers, and existing `KpiCard`/chart/state components are reused rather than reinvented.

## Out of Scope

- Any backend changes (endpoints, schema, migrations).
- Module-level work notes/comments and progress update history (no backend support; deferred).
- An independent module status editor (status is derived from progress).
- Creating/editing/deleting projects or assigning modules (admin/manager capability).
- Real-time push/websockets for notifications (the existing polling-based notifications center is reused as-is).
- Admin/manager analytics dashboards (features 013/015) — this workspace is developer-scoped.

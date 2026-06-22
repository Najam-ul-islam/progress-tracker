# Phase 1 Data Model: Developer Dashboard (Frontend)

This feature adds **no backend entities and no persistence**. The "data model" here is the set of **read-only frontend view models** that the developer workspace consumes, plus the one **derived** view model (deadline join) computed client-side. All monetary/share fields are **decimal strings** — format via `@/lib/format`, never float-math.

## Consumed view models (existing — reused as-is)

### DeveloperSelfReport — `GET /reports/developers/me`
Defined in `frontend/src/modules/earnings/types.ts` (do not redefine). Primary source for the overview, module list, and earnings totals.

| Field | Type | Used by |
|-------|------|---------|
| `id` | number | — |
| `name` | string | overview greeting |
| `module_count` | number | overview: Assigned Modules total |
| `modules_completed` | number | overview status breakdown |
| `modules_in_progress` | number | overview status breakdown |
| `modules_pending` | number | overview: Pending Tasks count |
| `earnings` | `{ paid, pending, total }` (strings) | `EarningsCards` summary |
| `modules` | `DeveloperSelfModule[]` | `AssignedModulesTable`, deadline join |
| `projects_completed` | number | overview KPI |
| `projects_pending` | number | overview KPI |
| `earnings_from_completed_projects` | string | overview KPI |

**DeveloperSelfModule**: `module_id`, `module_name`, `project_id`, `project_name`, `progress` (0–100), `status` (`pending|in_progress|completed`), `share_percentage` (string), `amount_paid` (string), `amount_pending` (string). **No deadline field** (see derived model).

### DeveloperPaymentMineRead — `GET /payments/developer/me`
Defined under `frontend/src/modules/payments/types.ts` (referenced by `earnings/api.listMyEarnings`). Source for the Earnings per-row breakdown: per-module `share_percentage`, `amount`, `status` (`pending|paid`), `project_id`. Other developers' rows / company reserve never present (backend-enforced).

### Project — `GET /projects` (developer-filtered, server-side)
Mapped by `frontend/src/modules/projects/services/projects.api.ts` → `Project` (camelCase). Fields used: `id`, `name`, `clientId`, `status`, `startDate`, `endDate`, plus aggregate progress via `GET /projects/{id}/progress` (`ProjectProgress`). Source for `AssignedProjectsTable` and the deadline join.

> Note: `Project` carries `clientId` but not the client *name*. Client name display options: (a) show the existing project metadata the developer can already see, or (b) if a client name is required and not available to developers, show the project name as primary and omit client name gracefully. Decision deferred to tasks; spec FR-009 lists client name — confirm developer visibility of client name during implementation (developers have no `/clients` access). If unavailable, render "—".

### Notification — `GET /notifications`
Defined in `frontend/src/modules/notifications/types.ts`. Fields used: `id`, `title`, `message`, `type` (`assignment|payment|payment_paid|deadline|system`), `isRead`/`is_read`, `createdAt`. Source for `NotificationsPanel`.

## Derived view model (new — computed client-side)

### ModuleWithDeadline (overview + My Modules)
Computed by `useUpcomingDeadlines` / a pure util joining `DeveloperSelfModule` → parent `Project` by `project_id`.

| Field | Source | Notes |
|-------|--------|-------|
| `moduleId` | `DeveloperSelfModule.module_id` | |
| `moduleName` | `module_name` | |
| `projectId` | `project_id` | |
| `projectName` | `project_name` | |
| `progress` | `progress` | 0–100 |
| `status` | `status` | derived badge (read-only) |
| `deadline` | parent `Project.endDate` | `null` when project has no end date → "No deadline set" |
| `isOverdue` | `deadline != null && deadline < today && status !== "completed"` | visual flag |
| `daysRemaining` | `deadline` − today (when present) | for "Upcoming Deadlines" copy |

**Derivation rules**:
- Sort upcoming-deadlines list by `deadline` ascending; modules with `null` deadline sink to the bottom.
- Overdue items (past deadline, not completed) sort to the top and render with an alert/red treatment.
- "Pending Tasks" = modules where `status !== "completed"` (i.e., `modules_pending + modules_in_progress`).

## Write model (existing — reused)

### ModuleProgressUpdate — `PATCH /modules/{id}/progress`
Body: `{ progress: number }` (integer 0–100, `extra=forbid`). No status field (status derived server-side, R3). Implemented by `projectsApi.updateModuleProgress`. UI guards 0–100 before submit; handles 422/403 via existing `ProjectsApiError` mapping.

## Validation & state rules (frontend)

- Progress input constrained to integer 0–100; out-of-range blocked with inline message (FR-004).
- Status is never user-set; badge follows progress (FR-005).
- Earnings surfaces show only caller's own data (backend-enforced; FR-007).
- Every list/data surface: skeleton while loading, empty state when zero, retryable error on failure (FR-011).
- Decimal strings formatted via `@/lib/format`; no arithmetic on money beyond display (R6).

## State transitions

None owned by this feature. Module status transitions (pending → in_progress → completed) are a **server-side projection of progress**; the frontend only displays them and triggers them indirectly by writing progress.

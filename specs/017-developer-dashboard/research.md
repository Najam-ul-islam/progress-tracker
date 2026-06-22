# Phase 0 Research: Developer Dashboard (Frontend)

All Technical Context items were resolvable from the existing codebase; there are no open NEEDS CLARIFICATION items. The research below records the decisions that shape the design.

## R1 — Deadline source for "Upcoming Deadlines" and module deadline tracking

**Decision**: Derive each module's deadline from its **parent project's `end_date`**, obtained via the developer-filtered `GET /projects` list, joined client-side to the self-report modules by `project_id`. Render "No deadline set" when a project has no `end_date`. Sort nearest-first; flag any deadline in the past as overdue.

**Rationale**: The `DeveloperSelfReport.modules` payload (`/reports/developers/me`) carries `progress`, `status`, `share_percentage`, `amount_paid`, `amount_pending` — but **no date field**. The backend `ProjectModule` model likewise has no deadline column; only `Project` has `start_date`/`end_date`. Since the spec's FR-008 requires deadline tracking and the constitution forbids inventing backend contracts, the only correct source is the project timeline. This is consistent with the spec Assumption ("project end date is used as the deadline proxy").

**Alternatives considered**:
- *Add a module-level deadline column* — rejected: requires a backend migration, violating FR-012/SC-006 (frontend-only).
- *Use `GET /reports/projects`* — rejected: that endpoint is admin/manager-only (403 for developers); `GET /projects` is the developer-accessible source already filtered to assignments server-side.

## R2 — Reuse vs. build (avoid duplicate logic per constitution Hard Constraints)

**Decision**: Reuse existing data-access and primitives; build only the workspace composition + deadline join + routing/guard.

| Need | Reuse (existing) | Build (new) |
|------|------------------|-------------|
| Self-report (overview, modules, earnings totals) | `earnings/hooks/useMySelfReport`, `earnings/api.getMySelfReport`, `earnings/types.DeveloperSelfReport` | — |
| Earnings per-row breakdown | `earnings/api.listMyEarnings` (`/payments/developer/me`) | `EarningsCards` view that consumes it |
| Module progress write | `projects/services/projects.api.updateModuleProgress`, `projects/components/UpdateProgressDialog` | optional thin `useUpdateModuleProgress` wrapper for invalidation set |
| Projects (read-only) | `projects/services/projects.api.list` (developer-filtered server-side) | `useMyProjects` hook, `AssignedProjectsTable` |
| Notifications | `notifications` hooks/components (`useNotificationFeed`, `NotificationItem`, `NotificationTypeIcon`) | `NotificationsPanel` composition |
| Widgets/states | `reporting/components/{KpiCard,EmptyState,ErrorState}`, `projects/components/{ProgressBar,StatusBadge}`, `components/ui/skeleton` | `DashboardStats`, `UpcomingDeadlines` |

**Rationale**: A developer self-report data flow, a progress-update dialog, and notification feed components already exist and are tested. Rebuilding them would create duplicate business logic (explicitly forbidden) and divergent behavior. The net-new work is genuinely new: the overview composition, deadline derivation, and developer routing.

**Alternatives considered**: *New standalone module duplicating self-report fetching* — rejected for duplication; *Cram everything into `dashboard` module* — rejected: the dashboard module is the generic shell; a dedicated `developer` module keeps domains isolated (constitution §II).

## R3 — Module status is derived, not independently set

**Decision**: Present module status as a **read-only badge** (`StatusBadge`) that follows `progress`; the only write is progress (0–100) via the existing dialog. No status picker.

**Rationale**: Backend derives status from progress (0 = pending, 1–99 = in_progress, 100 = completed) and `ModuleProgressUpdate` accepts only `{progress}` (extra fields forbidden). Offering a status editor would be a contract the backend rejects. Recorded in spec Assumptions and FR-005.

## R4 — Routing & role guard

**Decision**: Add developer routes under the existing `RequireAuth` tree. Introduce `RequireDeveloperWorkspace` (mirrors `RequireDashboardAccess`/`RequireAnalyticsAccess` pattern) that allows only `role === "developer"` and otherwise redirects admin/manager to `/` (or shows access-denied). Reuse the existing `/earnings` and `/notifications` routes; add `/my-modules` and `/my-projects` (and optionally `/developer` as the overview alias — the role-aware `/` already renders `DeveloperDashboardContent`, so the overview can stay on `/` for developers).

**Rationale**: The codebase already role-gates the home route (`DashboardPage` branches on role) and the sidebar via `navigation.config.ts` `roles`. Following the same pattern keeps RBAC consistent across backend and frontend (constitution success criterion) without a new auth mechanism.

**Alternatives considered**: *Separate `/developer/*` route subtree with its own layout* — viable but heavier; deferred. The simplest viable change keeps the developer overview on `/` and adds two list routes, matching existing conventions.

## R5 — Query keys & cache invalidation

**Decision**: On a successful progress update, invalidate: `["reports","developers","me"]` (self-report → overview + modules + earnings totals), `PROJECTS_QUERY_KEYS.progress(projectId)` and `PROJECTS_QUERY_KEYS.detail(projectId)` (existing), and `["projects","list"]` (My Projects aggregate progress). This satisfies FR-006 (all surfaces stay consistent).

**Rationale**: The self-report is the overview/earnings source; project list/progress feed My Projects. The existing `UpdateProgressDialog` already invalidates project detail/progress; we extend the invalidation set (via a wrapper hook or by passing additional keys) to also refresh the self-report so the developer overview reflects new earnings/status without a reload.

**Alternatives considered**: *Optimistic update only* — rejected as the sole mechanism (server derives status/earnings); optimistic value is acceptable for the slider UX but must reconcile against server (spec edge case "concurrent edit").

## R6 — Money formatting & types

**Decision**: All monetary/share fields are **decimal strings**; format exclusively via `@/lib/format` (`formatCurrency`, `formatPercent`). No `Number()` arithmetic on amounts beyond display rounding already established in existing pages.

**Rationale**: Matches `reporting/types.ts` and `earnings/types.ts` conventions and the constitution's auditable-financials principle. Prevents float drift.

## Summary of resolved unknowns

- Deadline source → parent project `end_date` (R1).
- Reuse map established; net-new = composition + deadline join + routing/guard (R2).
- Status is read-only/derived (R3).
- Routing pattern mirrors existing role guards (R4).
- Invalidation set defined for FR-006 (R5).
- Decimal-string money handling confirmed (R6).

No outstanding NEEDS CLARIFICATION.

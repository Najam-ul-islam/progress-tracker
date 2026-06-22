# Consumed Endpoint Contracts: Developer Dashboard (Frontend)

This feature defines **no new endpoints**. It consumes the following existing, already-implemented backend contracts. Each row notes the owning feature, the developer-role behavior, and the frontend consumer. Authoritative schemas live in each owning feature's spec/contracts; this file is the consumption map for traceability (FR-012, SC-006).

## Reads

### `GET /reports/developers/me` — developer self-report (feature 007)
- **RBAC**: `developer` only (admin/manager → 403). Returns the caller's own report.
- **Response**: `DeveloperSelfReport` (see data-model.md). Includes module list, status counts, earnings block, project completion counts.
- **Consumer**: `earnings/hooks/useMySelfReport` (reused) → overview `DashboardStats`, `AssignedModulesTable`, `EarningsCards` totals.
- **Query key**: `["reports","developers","me"]`.

### `GET /payments/developer/me` — developer earnings rows (feature 006)
- **RBAC**: `developer` only (admin/manager → 403). Returns only the caller's `DeveloperPayment` rows.
- **Response**: `DeveloperPaymentMineRead[]` — per row `share_percentage`, `amount`, `status` (`pending|paid`), `project_id`. No other developer's rows; no company reserve.
- **Consumer**: `earnings/api.listMyEarnings` (reused) → `EarningsCards` per-row breakdown.

### `GET /projects` — assigned projects (feature 005)
- **RBAC**: developer token returns **only assigned** projects (server-side filter).
- **Response**: `Project[]` (mapped to camelCase by `projects.api`). Fields used: `id`, `name`, `clientId`, `status`, `startDate`, `endDate`.
- **Consumer**: new `developer/hooks/useMyProjects` (wraps `projectsApi.list`) → `AssignedProjectsTable`, deadline join.
- **Query key**: `["projects","list"]`.

### `GET /projects/{id}/progress` — aggregate project progress (feature 005)
- **RBAC**: visible for assigned developer.
- **Response**: `ProjectProgress` — `projectId`, `progress` (0–100 / float), `modules[]`.
- **Consumer**: `projectsApi.getProgress` (reused) → `AssignedProjectsTable` progress bar (optional; list `Project` may already suffice).
- **Query key**: `["projects","progress", id]`.

### `GET /notifications` — personal feed (feature 008)
- **RBAC**: any authenticated user; returns only the caller's notifications.
- **Response**: `{ items: Notification[], unread_count, total, limit, offset }`.
- **Consumer**: `notifications/hooks/useNotificationFeed` (reused) → `NotificationsPanel` (filtered/sliced to recent dev-relevant types: `assignment`, `deadline`, `payment`, `payment_paid`).

## Writes

### `PATCH /modules/{id}/progress` — update module progress (feature 005)
- **RBAC**: admin/manager OR the **assigned** developer (`assigned_developer_id === caller`). Others → 403.
- **Request**: `{ progress: number }` — integer 0–100, closed schema (extra fields → 422). **No status field** (status derived server-side).
- **Response**: `ModuleRead` (updated module with derived `status`).
- **Consumer**: `projectsApi.updateModuleProgress` via `UpdateProgressDialog` (reused) → on success, invalidate `["reports","developers","me"]`, `["projects","list"]`, `["projects","progress",projectId]`, `["projects","detail",projectId]` (FR-006).

## Error handling (consistent with existing `projects.api` mapping)

| Status | Meaning | UI treatment |
|--------|---------|--------------|
| 401 | session expired/invalid | redirect to `/login` (existing `RequireAuth` / interceptor) |
| 403 | role/ownership denied | access-denied state / hide affordance (RBAC) |
| 404 | target missing | not-found message; retry/back |
| 422 | validation (e.g., progress out of range) | inline field error; block submit pre-emptively |
| network/5xx | transient | retryable error state ("Try again") |

## Non-goals (explicitly NOT consumed/created)

- No module notes/comments endpoint (does not exist — deferred).
- No module update-history endpoint (does not exist — deferred).
- No module status-set endpoint (status is derived; only progress is writable).
- No admin/manager aggregate reporting endpoints (`/reports/dashboard`, `/reports/projects`, `/reports/developers`, `/reports/payments`) — those are 403 for developers and out of scope for this workspace.

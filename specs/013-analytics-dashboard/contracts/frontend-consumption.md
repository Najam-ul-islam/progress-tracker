# Frontend Consumption Contract: Analytics & Reporting Dashboard

**Feature**: `013-analytics-dashboard`
**Date**: 2026-06-15
**Backend contract (source of truth)**: `specs/007-reporting/contracts/reporting.openapi.yaml`

This feature introduces **no new backend endpoints**. This document specifies the **frontend consumption layer** that maps the existing `/reports/*` API to module API functions, React Query keys, routes, and RBAC guards. It is the contract the implementation and tests are written against.

---

## 1. API service layer  — `frontend/src/modules/reporting/services/reporting.api.ts`

All calls use the shared Axios `http` client (base URL already configured; JWT attached by interceptor). **Base path is `/reports`** (backend-verified; corrects the existing `/reporting/*` drift).

```ts
const BASE = "/reports";

// US1 — KPI overview
getDashboardSummary(): Promise<DashboardSummary>
  → GET /reports/dashboard

// US2 — Revenue analytics
getFinancialReport(filter: AnalyticsFilter): Promise<FinancialReportResponse>
  → GET /reports/payments?date_from&date_to&project_status&client_id
  (developer_id NOT sent for this endpoint)

// US3 — Project analytics
getProjectsReport(filter: AnalyticsFilter): Promise<ProjectReportRow[]>
  → GET /reports/projects?date_from&date_to&project_status&client_id&developer_id

// US4 — Developer performance
getDevelopersReport(filter: AnalyticsFilter): Promise<DeveloperReportRow[]>
  → GET /reports/developers?date_from&date_to&project_status&client_id&developer_id
```

```ts
// US5 — Developer self-service  — frontend/src/modules/earnings/services (or api.ts)
getMySelfReport(): Promise<DeveloperSelfReport>
  → GET /reports/developers/me      // NO query params ever sent (scope-isolation, FR-012)
```

**Param serialization rule**: only defined filter fields are appended to the query string (undefined/empty omitted). `developer_id` is never appended to the `/reports/payments` request even if present in the URL filter.

---

## 2. React Query keys (cache isolation per filter)  — query-key factory

```ts
export const REPORTING_QUERY_KEYS = {
  dashboard:  ()                       => ["reports", "dashboard"] as const,
  payments:   (f: AnalyticsFilter)     => ["reports", "payments", normalizeForKey(f, ["developer_id"])] as const,
  projects:   (f: AnalyticsFilter)     => ["reports", "projects", normalizeForKey(f)] as const,
  developers: (f: AnalyticsFilter)     => ["reports", "developers", normalizeForKey(f)] as const,
  selfReport: ()                       => ["reports", "developers", "me"] as const,
};
```

- `normalizeForKey` produces a stable, order-independent object of the filter fields relevant to that endpoint (excluding fields the endpoint ignores, e.g. `developer_id` for payments) so cache keys are correct and minimal.
- Hooks: `useDashboardSummary()`, `useFinancialReport(filter)`, `useProjectsReport(filter)`, `useDevelopersReport(filter)`, `useMySelfReport()` — each `useQuery` with `staleTime: 30_000`, `refetchOnWindowFocus: true` (R4).

---

## 3. Routes & guards  — `frontend/src/routes.tsx`

| Route | Element | Guard | Roles |
|---|---|---|---|
| `/analytics` | `AnalyticsDashboardPage` (KPI) | `RequireAnalyticsAccess` | admin, manager |
| `/analytics/revenue` | `RevenueAnalyticsPage` | `RequireAnalyticsAccess` | admin, manager |
| `/analytics/projects` | `ProjectAnalyticsPage` | `RequireAnalyticsAccess` | admin, manager |
| `/analytics/developers` | `DeveloperPerformancePage` | `RequireAnalyticsAccess` | admin, manager |
| `/earnings` *(existing, enriched)* | `DeveloperEarningsPage` | developer-only render | developer |

- `/reports/financial` (current) → **migrated** to `/analytics/revenue`; the old route may redirect or be removed. The "Financial Reports" nav link is replaced by the "Analytics" entry.
- `RequireAnalyticsAccess` renders `<AccessDenied/>` when `!canViewAnalytics(role)` (FR-021, FR-022). All routes already sit inside `RequireAuth` (401 → login, FR-023).

---

## 4. RBAC helpers  — `frontend/src/lib/rbac.ts`

```ts
// Analytics RBAC (mirrors 007-reporting security model):
// admin + manager → aggregate reports (dashboard/payments/projects/developers); denied /me.
// developer → /developers/me only; denied all aggregate reports.
export function canViewAnalytics(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}
export function canViewOwnPerformance(role: Role | null): boolean {
  return role === "developer";
}
```

**RBAC behaviour matrix** (verified against backend 401→403→404→422 ordering):

| Surface | admin | manager | developer | unauth |
|---|---|---|---|---|
| Nav: "Analytics" entry | shown | shown | hidden | n/a |
| Nav: "My Earnings" entry | hidden | hidden | shown | n/a |
| `/analytics*` (aggregate) | view | view | **Access denied** | → login |
| `/earnings` (`/me`) | (not their entry) | (not their entry) | view | → login |
| Backend `/reports/dashboard\|payments\|projects\|developers` | 200 | 200 | 403 | 401 |
| Backend `/reports/developers/me` | 403 | 403 | 200 | 401 |

---

## 5. Navigation  — `frontend/src/modules/auth/components/AppHeader.tsx`

- Replace the `IfRole roles={["admin","manager"]}` "Financial Reports" → `/reports/financial` link with an **"Analytics" → `/analytics`** link (same role gate).
- Keep the existing `IfRole roles={["developer"]}` "My Earnings" → `/earnings` link (US5 home).

---

## 6. Error & state contract (per view)

| React Query state | UI |
|---|---|
| `isLoading` (>200ms) | `Skeleton` KPI cards / table / chart placeholders (FR-017) |
| `isError` | `ErrorState` with "Try again" → `refetch()` (FR-017, SC-006) |
| `data` empty (array length 0 / zero rows) | `EmptyState` ("no data" / "no rows match filters" + "Clear filters") (FR-017) |
| 401 (any request) | global `http` interceptor → redirect to login, preserve URL (FR-023) |
| 403 (wrong role hits route) | guard renders `AccessDenied` before fetch (FR-022) |
| 422 (bad filter id/date) | inline filter error message, do not clear figures misleadingly (FR-015) |

---

## 7. Test contract (what the tests assert — drives `/sp.tasks`)

- **Unit**: `analytics-filter.schema` parse/serialize round-trip incl. `date_from > date_to` rejection; `formatCurrency`/`formatPercent` for representative decimal strings (`"1800.00"→$1,800.00`, `"66.7"→66.7%`) (SC-007); `reporting.api` builds correct query strings and omits `developer_id` from payments; RBAC fns truth table.
- **Component (MSW)**: each page renders loading→data; KPI values match mocked `/reports/dashboard`; revenue totals + row reconciliation; project progress + module-count invariant; developer rows + chart presence; self-service scope (only own data); filter change updates URL + refetches; 422 surfaces inline; error→Try again→recovers; empty states.
- **RBAC (MSW)**: per (role, route) — developer→aggregate route = AccessDenied; admin/manager nav has Analytics, no My Earnings; developer nav has My Earnings, no Analytics; deep-link guards. (SC-003, SC-004.)
- **Path-fix regression**: assert requests target `/reports/*` (not `/reporting/*`); MSW handlers updated accordingly (R3).

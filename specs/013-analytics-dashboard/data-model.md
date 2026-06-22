# Phase 1 Data Model: Analytics & Reporting Dashboard (Frontend)

**Feature**: `013-analytics-dashboard`
**Date**: 2026-06-15

This feature owns **no persistent state and no backend tables**. All "entities" below are **read-only frontend view models** typed in TypeScript to mirror the backend `007-reporting` response schemas (`contracts/reporting.openapi.yaml`), plus one **client-only** filter model. Monetary and average fields are typed as **`string`** (decimal strings) per the contract and research R2 — the existing scaffolding's `number` typing is corrected.

All types live in `frontend/src/modules/reporting/types.ts` (aggregate views) and `frontend/src/modules/earnings/types.ts` (self-service). `ModuleStatus` and `ProjectStatus` are shared string-literal unions.

---

## Shared enums

```ts
export type ProjectStatus = "pending" | "active" | "completed";
export type ModuleStatus  = "pending" | "in_progress" | "completed";
```

---

## 1. DashboardSummary  (US1 — KPI overview)  ← `GET /reports/dashboard`

| Field | Type | Notes |
|---|---|---|
| `projects.total` | `number` | int ≥ 0 |
| `projects.pending` | `number` | int ≥ 0 |
| `projects.active` | `number` | int ≥ 0 |
| `projects.completed` | `number` | int ≥ 0 |
| `projects.overdue` | `number` | int ≥ 0 |
| `developers.total` | `number` | int ≥ 0 |
| `developers.with_active_assignments` | `number` | int ≥ 0 |
| `developers.average_module_progress` | `string` | decimal string, 1 dp (e.g. "66.7") → `formatPercent` |
| `payments.total_revenue` | `string` | decimal string → `formatCurrency` |
| `payments.total_company_reserve` | `string` | decimal string → `formatCurrency` |
| `payments.total_developer_disbursed` | `string` | decimal string → `formatCurrency` |
| `payments.pending_amount` | `string` | decimal string → `formatCurrency` |

**Validation/Display rules**: counts render as integers; decimal-string fields pass through `formatCurrency`/`formatPercent` (FR-002). Empty system → all zeros, structurally valid (FR-003).

---

## 2. ProjectReportRow  (US3 — Project analytics)  ← `GET /reports/projects` (array)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | |
| `name` | `string` | |
| `client_id` | `number` | |
| `client_name` | `string` | |
| `status` | `ProjectStatus` | badge color mapping |
| `start_date` | `string` | ISO date |
| `end_date` | `string` | ISO date |
| `overall_progress` | `number` | int 0–100 → progress bar |
| `module_count` | `number` | int ≥ 0 |
| `modules_completed` | `number` | int ≥ 0 |
| `modules_in_progress` | `number` | int ≥ 0 |
| `modules_pending` | `number` | int ≥ 0 |
| `invoiced_amount` | `string` | decimal string → `formatCurrency` |
| `outstanding_amount` | `string` | decimal string → `formatCurrency` |
| `modules` | `ProjectReportModule[]` | nested, see below |

**Invariant** (FR-008): `modules_completed + modules_in_progress + modules_pending === module_count`.

### ProjectReportModule (nested)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | |
| `name` | `string` | |
| `assigned_developer_id` | `number` | |
| `assigned_developer_name` | `string` | |
| `progress` | `number` | int 0–100 |
| `status` | `ModuleStatus` | |
| `share_percentage` | `string` | decimal string → `formatPercent` |

---

## 3. DeveloperReportRow  (US4 — Developer performance)  ← `GET /reports/developers` (array)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | |
| `name` | `string` | |
| `email` | `string` | |
| `module_count` | `number` | int ≥ 0 |
| `modules_completed` | `number` | int ≥ 0 |
| `modules_in_progress` | `number` | int ≥ 0 |
| `modules_pending` | `number` | int ≥ 0 |
| `earnings` | `EarningsBlock` | see below |
| `earnings_by_project` | `EarningsByProject[]` | chart-ready array |

### EarningsBlock (shared with self-service)

| Field | Type | Notes |
|---|---|---|
| `paid` | `string` | decimal string → `formatCurrency` |
| `pending` | `string` | decimal string → `formatCurrency` |
| `total` | `string` | decimal string → `formatCurrency` |

### EarningsByProject

| Field | Type | Notes |
|---|---|---|
| `project_id` | `number` | |
| `project_name` | `string` | chart label |
| `paid` | `string` | decimal string |
| `pending` | `string` | decimal string |
| `total` | `string` | decimal string (chart value) |

---

## 4. FinancialReportResponse  (US2 — Revenue analytics)  ← `GET /reports/payments`

```ts
interface FinancialReportResponse {
  rows: FinancialReportRow[];
  totals: FinancialTotals;
}
```

### FinancialReportRow

| Field | Type | Notes |
|---|---|---|
| `project_id` | `number` | |
| `project_name` | `string` | |
| `client_id` | `number` | |
| `client_name` | `string` | |
| `status` | `ProjectStatus` | |
| `invoiced` | `string` | decimal string → `formatCurrency` |
| `company_share` | `string` | decimal string → `formatCurrency` |
| `developer_share` | `string` | decimal string → `formatCurrency` |
| `outstanding` | `string` | decimal string → `formatCurrency` |
| `payment_count` | `number` | int ≥ 0 |

### FinancialTotals

| Field | Type | Notes |
|---|---|---|
| `invoiced` | `string` | decimal string |
| `company_share` | `string` | decimal string |
| `developer_share` | `string` | decimal string |
| `outstanding` | `string` | decimal string |

**Invariant** (FR-006): table footer (sum of rows per column) reconciles to `totals`. Display only — the frontend does NOT compute totals; it renders the backend `totals` block and asserts reconciliation in tests.

---

## 5. DeveloperSelfReport  (US5 — Developer self-service)  ← `GET /reports/developers/me`

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | |
| `name` | `string` | |
| `module_count` | `number` | int ≥ 0 |
| `modules_completed` | `number` | int ≥ 0 |
| `modules_in_progress` | `number` | int ≥ 0 |
| `modules_pending` | `number` | int ≥ 0 |
| `earnings` | `EarningsBlock` | reused |
| `modules` | `DeveloperSelfModule[]` | per-module detail |

### DeveloperSelfModule

| Field | Type | Notes |
|---|---|---|
| `module_id` | `number` | |
| `module_name` | `string` | |
| `project_id` | `number` | |
| `project_name` | `string` | |
| `progress` | `number` | int 0–100 |
| `status` | `ModuleStatus` | |
| `share_percentage` | `string` | decimal string → `formatPercent` |
| `amount_paid` | `string` | decimal string → `formatCurrency` |
| `amount_pending` | `string` | decimal string → `formatCurrency` |

> **Correction**: existing `earnings/types.ts` types `EarningsBlock`, `share_percentage`, `amount_paid`, `amount_pending` as `number`. These become `string` to match the contract.

---

## 6. AnalyticsFilter  (client-only — US6)  — URL query string is the source of truth

| Field | Type | Applies to | URL param | Validation |
|---|---|---|---|---|
| `date_from` | `string \| undefined` | Revenue, Project, Developer | `date_from` | ISO date (YYYY-MM-DD) |
| `date_to` | `string \| undefined` | Revenue, Project, Developer | `date_to` | ISO date; must be ≥ `date_from` (client-side pre-check) |
| `project_status` | `ProjectStatus \| undefined` | Revenue, Project, Developer | `project_status` | enum {pending,active,completed} |
| `client_id` | `number \| undefined` | Revenue, Project, Developer | `client_id` | positive int |
| `developer_id` | `number \| undefined` | Project, Developer (NOT Revenue) | `developer_id` | positive int |

**Zod schema** (`schemas/analytics-filter.schema.ts`), mirroring `clients-filter.schema.ts`:
- `parseFilter(params: URLSearchParams): AnalyticsFilter` — tolerant parse, drops invalid params to defaults.
- `filterToParams(filter): Record<string,string>` — omits empty fields (so the URL stays clean).
- A separate refinement reports `date_from > date_to` as a client-side validation error surfaced inline (FR-015), without issuing a request.

**State transitions**: none (read-only). The only "transition" is filter-set change → new React Query key → refetch (R4). Clearing filters resets to `{}` → full unfiltered scope (FR-014).

---

## Field-typing correction summary (FR-026)

| File | Field(s) | Before | After |
|---|---|---|---|
| `reporting/types.ts` | `invoiced, company_share, developer_share, outstanding` (row + totals) | `number` | `string` |
| `earnings/types.ts` | `EarningsBlock.*`, `share_percentage`, `amount_paid`, `amount_pending` | `number` | `string` |
| (new) `reporting/types.ts` | `DashboardSummary`, `ProjectReportRow`, `DeveloperReportRow` + nested | — | added per above |

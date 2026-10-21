# Phase 1 Data Model: Reporting & Analytics

**Feature**: `007-reporting`
**Date**: 2026-05-08

This feature owns **zero new tables** and introduces **zero migrations**. Every "entity" below is a Pydantic v2 *response model* (a read-only DTO) projected from queries against the existing tables: `project`, `project_module`, `payment`, `developer_payment`, `user`, `client`. No SQLModel `table=True` classes are added.

---

## Source tables (read-only inputs)

| Table | Owned by feature | Columns we read |
|---|---|---|
| `project` | 005-projects | `id`, `name`, `client_id`, `status`, `start_date`, `end_date`, `is_active`, `created_at` |
| `project_module` | 005-projects | `id`, `project_id`, `name`, `assigned_developer_id`, `progress`, `status`, `share_percentage`, `is_active` |
| `payment` | 006-payments-distribution | `id`, `project_id`, `total_amount`, `company_amount`, `developer_amount`, `status`, `created_at` |
| `developer_payment` | 006-payments-distribution | `id`, `payment_id`, `developer_id`, `module_id`, `share_percentage`, `amount`, `status`, `created_at` |
| `user` | 003-users-management | `id`, `name`, `email`, `role`, `is_active` |
| `client` | 004-clients-management | `id`, `name`, `is_active` |

No mutation occurs on any of these. The `audit_reporting_imports.sh` script enforces this at CI time by forbidding `session.add`, `session.delete`, `session.merge`, and `session.commit` anywhere under `backend/app/modules/reporting/`.

---

## Response DTOs (Pydantic v2 models in `schema.py`)

All sums are exposed as decimal-strings on the wire (Pydantic v2 default for `Decimal`). All counts are integers. All progress percentages are integers in 0..100; averages are decimals to one place.

### `DashboardSummary`

```text
DashboardSummary
├── projects: ProjectsBlock
│   ├── total: int
│   ├── pending: int
│   ├── active: int
│   ├── completed: int
│   └── overdue: int          # status='active' AND end_date < today AND is_active=true
├── developers: DevelopersBlock
│   ├── total: int                          # all users with role='developer' AND is_active=true
│   ├── with_active_assignments: int        # distinct developer_id with ≥1 active module on active project
│   └── average_module_progress: Decimal    # 1 decimal place; 0.0 on empty
└── payments: PaymentsBlock                 # delegated to payments.repository.summary_aggregates
    ├── total_revenue: Decimal              # sum(payment.total_amount)
    ├── total_company_reserve: Decimal      # sum(payment.company_amount)
    ├── total_developer_disbursed: Decimal  # sum(payment.developer_amount)
    └── pending_amount: Decimal             # sum(payment.total_amount) where status != 'paid'
```

### `ProjectReportRow`

```text
ProjectReportRow
├── id: int
├── name: str
├── client_id: int
├── client_name: str
├── status: Literal["pending", "active", "completed"]
├── start_date: date
├── end_date: date
├── overall_progress: int            # share-weighted: sum(progress × share / 70), 0..100, integer
├── module_count: int
├── modules_completed: int
├── modules_in_progress: int
├── modules_pending: int
├── invoiced_amount: Decimal         # sum(payment.total_amount) for this project
├── outstanding_amount: Decimal      # sum(payment.total_amount where status != 'paid')
└── modules: list[ProjectReportModule]
        ├── id: int
        ├── name: str
        ├── assigned_developer_id: int
        ├── assigned_developer_name: str
        ├── progress: int
        ├── status: Literal["pending", "in_progress", "completed"]
        └── share_percentage: Decimal

ProjectReportResponse = list[ProjectReportRow]
```

Soft-deleted modules (`project_module.is_active = false`) are excluded from `modules`. Soft-deleted projects are excluded from the response entirely.

### `DeveloperReportRow`

```text
DeveloperReportRow
├── id: int
├── name: str
├── email: str
├── module_count: int
├── modules_completed: int
├── modules_in_progress: int
├── modules_pending: int
├── earnings: EarningsBlock
│   ├── paid: Decimal              # sum(developer_payment.amount where status='paid')
│   ├── pending: Decimal           # sum(developer_payment.amount where status='pending')
│   └── total: Decimal             # paid + pending
└── earnings_by_project: list[EarningsByProject]
        ├── project_id: int
        ├── project_name: str
        ├── paid: Decimal
        ├── pending: Decimal
        └── total: Decimal

DeveloperReportResponse = list[DeveloperReportRow]
```

`earnings_by_project` is the chart-ready breakdown referenced in FR-025.

### `FinancialReportResponse`

```text
FinancialReportResponse
├── rows: list[FinancialReportRow]
│   ├── project_id: int
│   ├── project_name: str
│   ├── client_id: int
│   ├── client_name: str
│   ├── status: Literal["pending", "active", "completed"]
│   ├── invoiced: Decimal
│   ├── company_share: Decimal
│   ├── developer_share: Decimal
│   ├── outstanding: Decimal
│   └── payment_count: int
└── totals: FinancialTotals
    ├── invoiced: Decimal
    ├── company_share: Decimal
    ├── developer_share: Decimal
    └── outstanding: Decimal
```

Per-project rows appear even when `payment_count = 0` (FR-015) so that a manager can see at a glance which projects have not yet been invoiced.

### `DeveloperSelfReport`

```text
DeveloperSelfReport
├── id: int                          # current_user.id
├── name: str
├── module_count: int
├── modules_completed: int
├── modules_in_progress: int
├── modules_pending: int
├── earnings: EarningsBlock          # same shape as DeveloperReportRow.earnings
└── modules: list[DeveloperSelfModule]
        ├── module_id: int
        ├── module_name: str
        ├── project_id: int
        ├── project_name: str
        ├── progress: int
        ├── status: Literal["pending", "in_progress", "completed"]
        ├── share_percentage: Decimal
        ├── amount_paid: Decimal      # sum(developer_payment.amount where status='paid' AND module_id=this)
        └── amount_pending: Decimal   # sum(developer_payment.amount where status='pending' AND module_id=this)
```

The endpoint returns this single object (not a list) because it always describes exactly one user.

---

## Filter context (internal — not exposed)

```text
FilterContext (dataclass — internal)
├── date_from: date | None
├── date_to: date | None
├── project_status: Literal["pending", "active", "completed"] | None
├── client_id: int | None
└── developer_id: int | None
```

Built by `service._normalise_filters(...)`. Validation rules:

- `date_from` and `date_to` MUST both be valid ISO dates if either is supplied; `date_from <= date_to`. Else → `InvalidDateRange` → 422.
- `project_status` MUST be one of the three values. Else → `InvalidProjectStatus` → 422.
- `client_id` MUST exist via `clients.repository.get_client_by_id`. Else → `ClientNotFound` → 422.
- `developer_id` MUST exist via `users.repository.get_user_by_id` AND the user MUST have `role = 'developer'`. Else → `DeveloperNotFound` → 422.

The dashboard endpoint does NOT accept any of these filters (Decision 1 in research.md). The `/me` endpoint does NOT accept `developer_id` (Decision 4).

---

## Aggregation queries (one per repository function)

| Function | Returns | Round-trips |
|---|---|---|
| `dashboard_project_counts(session)` | dict with 5 ints (total, pending, active, completed, overdue) | 1 (one `GROUP BY status` + a CASE for overdue) |
| `dashboard_developer_metrics(session)` | dict (total, with_active_assignments, avg_progress) | 2 (one user count, one join+aggregate over modules) |
| `dashboard_payment_aggregates(session)` | dict (matches `summary_aggregates` shape + pending_amount) | 1 (delegates to `payments.repository.summary_aggregates`, augments with one additional COALESCE-SUM) |
| `project_report_rows(session, ctx)` | list of typed dicts | 3 (projects + clients join; modules grouped by project; payment sums grouped by project) |
| `developer_report_rows(session, ctx)` | list of typed dicts | 3 (users + module-status counts; per-project earnings; total earnings) |
| `financial_report_rows(session, ctx)` | list of typed dicts | 2 (projects + clients join; payment sums grouped by project) |
| `developer_self_breakdown(session, developer_id)` | typed dict + list | 2 (modules + project join; developer_payment sums grouped by module) |

All sums use `func.coalesce(func.sum(...), 0)`. All counts use `func.count(...)`. All averages use `func.avg(...)` with a Python-side `or 0.0` fallback for the empty case.

---

## State transitions

None. This module owns no mutable state.

---

## Validation rules (centralised in service)

| Filter | Rule | Exception | HTTP |
|---|---|---|---|
| `date_from`, `date_to` | both parseable; `from <= to` | `InvalidDateRange` | 422 |
| `project_status` | ∈ `{pending, active, completed}` | `InvalidProjectStatus` | 422 |
| `client_id` | row exists | `ClientNotFound` | 422 |
| `developer_id` | user exists with role='developer' | `DeveloperNotFound` | 422 |
| RBAC | role matches endpoint | (auth.dependencies) | 401/403 |
| auth | bearer token valid | (auth.dependencies) | 401 |

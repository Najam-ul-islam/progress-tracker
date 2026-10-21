# Feature Specification: Reporting & Analytics

**Feature Branch**: `007-reporting`
**Created**: 2026-05-08
**Status**: Draft
**Input**: User description: "MODULE: Reporting — centralized analytics, dashboards & reporting for projects, developers, payments & business revenue. Read-only aggregation over existing entities. RBAC: Admin → full, Manager → project/payment analytics, Developer → own stats only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operations dashboard at a glance (Priority: P1)

An administrator opens the dashboard and sees, in one payload, the live state of the business: how many projects are running vs. completed vs. overdue, how many developers are assigned and how productive they are on average, and how money is flowing through the system (total invoiced, company reserve so far, paid out to developers, still pending). They use this single view to decide where to focus the next operational action — no drill-down required to answer "is the business healthy today?"

**Why this priority**: Without this single landing view, every other report requires manual cross-referencing across the projects, payments, and users surfaces. P1 because it is the entry point the role-2/role-3 stakeholders use most often, and it must exist before any of the deeper drill-down reports become useful.

**Independent Test**: Seed a representative mix of projects (≥1 each in pending, active, completed, overdue), developers (some with active assignments, some without), and payments (mix of pending, partial, paid). Hit the dashboard endpoint as an admin. The returned counts and sums match the underlying tables exactly when computed directly via SQL.

**Acceptance Scenarios**:

1. **Given** the system has 8 projects (2 pending, 4 active, 1 completed, 1 active-but-past-end-date), **When** an admin requests the dashboard, **Then** the response shows `projects.total = 8`, `active = 4`, `completed = 1`, `overdue = 1`, `pending = 2`.
2. **Given** the system has 5 developers (3 with at least one active module assignment), **When** an admin requests the dashboard, **Then** `developers.total = 5`, `developers.with_active_assignments = 3`, and `developers.average_module_progress` is the arithmetic mean of the `progress` field across all *active* modules.
3. **Given** the payments table contains 1 paid Payment of `1000.00`, 1 partial of `2000.00`, 1 pending of `3000.00`, **When** an admin requests the dashboard, **Then** `payments.total_revenue = 6000.00`, `total_company_reserve = 1800.00`, `total_developer_disbursed = 4200.00`, `pending_amount = 5000.00` (sum of partial + pending parents).

---

### User Story 2 - Per-project progress and assignment report (Priority: P2)

A manager (or admin) needs to see, for any given project or filtered list of projects, how complete each one is, which developers are assigned to which modules, and how much money has already been distributed against it. They use this view in status meetings to spot stalled modules and unbalanced workloads before the deadline slips.

**Why this priority**: Builds on the dashboard's "overdue / active" counts by letting the user drill into *which* projects and modules need attention. Cannot be P1 because the dashboard summary already gives an actionable signal; this is the "next layer" of investigation.

**Independent Test**: Seed two projects with different module counts and progress values. Request the projects report unfiltered — both appear with correct progress percentages and module counts. Request again with a `client_id` filter — only projects for that client appear.

**Acceptance Scenarios**:

1. **Given** project P1 has 3 modules with progress `[100, 60, 0]` and project P2 has 2 modules with progress `[100, 100]`, **When** the user requests the projects report, **Then** P1's `overall_progress` is the share-weighted average across its modules and P2's is `100`, and both projects list their assigned developers.
2. **Given** the user filters by `project_status=active`, **When** the report is requested, **Then** only projects whose `status = 'active'` appear.
3. **Given** the user filters by `client_id=42`, **When** the report is requested, **Then** every row has `client_id = 42` and projects of other clients are absent.
4. **Given** the user filters by a date_range that spans only May 2026, **When** the report is requested, **Then** only projects whose `created_at` falls inside the range are returned.

---

### User Story 3 - Per-developer workload and earnings report (Priority: P2)

A manager (or admin) wants to know, for any developer or all developers, what they are working on, how far along they are, and how much they have earned (paid + pending). This view supports performance reviews, payout planning, and capacity decisions.

**Why this priority**: Same priority tier as US2 because both are "drill-down from dashboard" views, but on the people axis instead of the project axis. Required before any compensation conversation.

**Independent Test**: Seed two developers each with assignments on different projects. Request the developers report unfiltered — both appear with their module list and earnings totals. Request with `developer_id=X` — only that developer's row appears.

**Acceptance Scenarios**:

1. **Given** developer D1 is assigned to 2 modules across 2 projects with `progress = [100, 50]`, **When** the report is requested, **Then** D1's row lists both modules, shows `modules_completed = 1`, `modules_in_progress = 1`, and aggregates earnings across all developer payments belonging to D1.
2. **Given** D1 has 2 paid developer payments totaling `700.00` and 1 pending of `300.00`, **When** the report is requested, **Then** D1's `earnings.paid = 700.00`, `earnings.pending = 300.00`, `earnings.total = 1000.00`.
3. **Given** the user filters by `developer_id=D2`, **When** the report is requested, **Then** only D2's row is present.

---

### User Story 4 - Financial report for the business (Priority: P3)

An administrator needs a finance-grade view of money flow: company earnings (the 30% reserve), total payouts to developers, and per-project profitability so they can identify which client engagements actually contribute margin. This view is used at month-end and quarter-end review.

**Why this priority**: P3 because it is read-derivable from the dashboard plus the projects report. It is required for executive reviews but not for daily operations, and the underlying numbers are already computed elsewhere — this report is purely a finance-shaped re-projection.

**Independent Test**: Seed three projects each with a payment in a different status. Request the financial report. Per-project rows show `invoiced`, `company_share` (30% of invoiced), `developer_share` (70%), and `outstanding` (parent payments not yet `paid`). Totals at the foot of the payload equal the sum of the rows.

**Acceptance Scenarios**:

1. **Given** project P1 has invoiced `10000.00` (status=paid), P2 has invoiced `5000.00` (status=partial), P3 has nothing invoiced, **When** an admin requests the financial report, **Then** P1 row shows `outstanding = 0`, P2 row shows `outstanding = 5000.00`, P3 row appears with all-zero amounts.
2. **Given** the reporting date_range is restricted to a window that excludes P3's creation, **When** the report is requested, **Then** only P1 and P2 appear and the totals reconcile against their two rows.
3. **Given** a manager (not admin) requests the financial report, **When** the request is made, **Then** access is granted because managers participate in payment analytics per the RBAC contract.

---

### User Story 5 - Developer self-service stats (Priority: P2)

A developer logs into their own dashboard view and sees only their own work and money: which modules they have been assigned, how far along they are, and what they have earned (paid vs. pending). They cannot see the company reserve, other developers' earnings, or aggregate revenue.

**Why this priority**: Without this, developers must ask managers for their own numbers — friction the system already eliminates for the rest of the business. P2 because it is independently shippable and does not block US1/US2/US3.

**Independent Test**: Seed two developers with disjoint assignments. As developer A, hit the self-service endpoint — only A's modules and earnings appear. As developer B, the response is scoped to B. As admin or manager, the endpoint is denied.

**Acceptance Scenarios**:

1. **Given** developer A has 2 modules and 1 paid developer payment of `400.00`, **When** A requests their self-service report, **Then** the response lists only A's modules and `earnings.paid = 400.00`, `earnings.pending = 0`.
2. **Given** an administrator hits the self-service endpoint, **When** the request is made, **Then** the response is forbidden (403) — admins use the global developers report instead.
3. **Given** a developer with no assignments hits the self-service endpoint, **When** the request is made, **Then** the response is a well-formed empty payload (not an error).

---

### Edge Cases

- **Empty system.** When there are no projects, developers, or payments, every report MUST return a structurally complete payload with zero counts and zero sums (never null, never an error).
- **Soft-deleted entities.** Soft-deleted projects, modules, and clients (`is_active = false`) MUST be excluded from operational metrics (active counts, dashboard, in-progress reports) but MUST remain visible in financial history (already-issued payments and developer earnings) so the ledger reconciles.
- **Overdue definition.** A project counts as `overdue` when `status = 'active'` AND `end_date < today` AND `is_active = true`. Completed projects past their end date are not overdue.
- **Date-range filter on payments.** When `date_range` is supplied, payment-side aggregations filter on `payment.created_at`; project-side aggregations filter on `project.created_at`. The two sides may produce sums that do not line up if the user supplies a window that splits a project from its payments — this is documented behavior, not a bug.
- **Filter combinations.** Filters compose as AND, not OR. Supplying both `client_id` and `developer_id` returns rows that match both. Supplying a `developer_id` to the projects report restricts to projects that have at least one module assigned to that developer.
- **Stale aggregates.** All reports are computed live on each request from the source tables. There is no caching layer in this feature; correctness is preferred over latency.
- **Forbidden filter combinations on self-service.** A developer hitting `/reports/developers/me` MUST NOT be able to widen scope by supplying a `developer_id` for a different user; supplying any `developer_id` value other than the caller's own MUST be ignored or rejected.
- **Invalid filter values.** A `date_range` whose `from > to`, or a `project_status` that is not one of `pending|active|completed`, or an unknown `client_id`/`developer_id` MUST return 422 with a clear message — never silently fall back to "all".

## Requirements *(mandatory)*

### Functional Requirements

#### Endpoints & RBAC (FR-001 — FR-007)

- **FR-001**: System MUST expose `GET /reports/dashboard` returning a single composite payload covering project counts, developer engagement, and payment flow.
- **FR-002**: System MUST expose `GET /reports/projects` returning per-project progress, module completion, and assigned developers, with optional filters `date_range`, `project_status`, `client_id`, `developer_id`.
- **FR-003**: System MUST expose `GET /reports/developers` returning per-developer module load and earnings, with optional filters `date_range`, `developer_id`, `project_status`, `client_id`.
- **FR-004**: System MUST expose `GET /reports/payments` returning company earnings, payouts, and per-project profitability with optional filters `date_range`, `client_id`, `project_status`.
- **FR-005**: System MUST expose `GET /reports/developers/me` returning the caller's own modules, progress, and earnings — and only those.
- **FR-006**: System MUST authorise endpoints as: dashboard → admin + manager; projects/developers/payments reports → admin + manager; developers/me → developer only. Any other role MUST receive 403.
- **FR-007**: Unauthenticated requests to any reporting endpoint MUST return 401. The 401 → 403 → 404 → 422 guard ordering MUST be honoured on every route.

#### Data correctness (FR-008 — FR-016)

- **FR-008**: All metrics MUST be computed live from the source tables (projects, project_modules, payments, developer_payments, users) on each request. The reporting feature MUST NOT introduce its own database tables, migrations, or persistent state.
- **FR-009**: Project counts MUST classify each project as exactly one of: `pending`, `active`, `completed`, `overdue`. `overdue` is defined as `status = 'active'` AND `end_date < today` AND `is_active = true`. Soft-deleted projects MUST be excluded entirely from these counts.
- **FR-010**: Developer "active assignments" MUST be defined as the count of distinct developers who have at least one `project_module` row with `is_active = true` belonging to a project with `is_active = true`.
- **FR-011**: "Average module progress" MUST be the arithmetic mean of `project_module.progress` across all active modules belonging to active projects, rounded to one decimal place. When there are zero active modules the value MUST be `0.0`.
- **FR-012**: Payment aggregates MUST be derived from the existing payments tables exactly as `total_revenue = sum(payment.total_amount)`, `total_company_reserve = sum(payment.company_amount)`, `total_developer_disbursed = sum(payment.developer_amount)`, and `pending_amount = sum(payment.total_amount where status != 'paid')`.
- **FR-013**: Per-project progress in the projects report MUST be computed as the share-weighted average of module progress, where each module's contribution is `progress × share_percentage / 70`. Projects with zero modules MUST report `0` and never raise.
- **FR-014**: Per-developer earnings MUST aggregate `developer_payment.amount` filtered by `developer_id`, split into `paid` (status = 'paid') and `pending` (status = 'pending'), with `total = paid + pending`.
- **FR-015**: Financial report per-project rows MUST report `invoiced` (sum of payment.total_amount for that project), `company_share` (sum of payment.company_amount), `developer_share` (sum of payment.developer_amount), and `outstanding` (sum of payment.total_amount where parent status ≠ 'paid'). Rows MUST appear for every project in scope, including those with no payments yet (all-zero amounts).
- **FR-016**: Self-service `/reports/developers/me` MUST scope every aggregation to `developer_id = current_user.id`. Any client-side attempt to broaden scope (e.g., supplying a `developer_id` query param for another user) MUST be ignored or rejected with 422.

#### Filters & validation (FR-017 — FR-021)

- **FR-017**: When `date_range` is supplied, both `from` and `to` MUST be valid ISO dates with `from <= to`. Violations MUST return 422.
- **FR-018**: When `project_status` is supplied, it MUST be one of `pending|active|completed`. Other values MUST return 422.
- **FR-019**: When `client_id` or `developer_id` is supplied and the referenced row does not exist, the system MUST return 422 with a clear "not found" message — not 404, since 404 is reserved for the resource path itself, and not silent empty results.
- **FR-020**: When no filters are supplied, every report MUST return the full unfiltered scope (every active project / developer / payment in the system), bounded only by RBAC.
- **FR-021**: Filters MUST compose as AND. Conflicting or empty filter combinations MUST return a structurally valid empty payload, not an error.

#### Architecture & non-functional (FR-022 — FR-026)

- **FR-022**: Routes MUST contain zero business logic — only request validation, dependency injection, and exception-to-HTTP mapping. All aggregation, filtering, and RBAC scoping MUST be implemented in the service layer.
- **FR-023**: The reporting module MUST only import sibling-module symbols from an explicit allow-list: `projects.repository`, `projects.model` (read-only — for filter typing), `payments.repository`, `users.repository`, `auth.dependencies`, `auth.schema`. Importing from any other sibling module's `service` or `routes` is forbidden.
- **FR-024**: Each report endpoint MUST issue at most a small constant number of database round-trips regardless of result size. N+1 query patterns are forbidden — joins or grouped aggregations MUST be used instead.
- **FR-025**: Response shapes MUST be frontend-optimised: counts as integers, sums as decimal-strings (never floats), buckets keyed by status name, and chart-ready arrays (lists of `{label, value}` records) where the underlying view is a chart.
- **FR-026**: All endpoints MUST be safe to call with no query parameters and MUST never produce a 500 response for valid authenticated requests, even on an empty database.

### Key Entities *(read-only views over existing data)*

- **DashboardSummary**: A composite payload with three sub-blocks — `projects` (total, pending, active, completed, overdue), `developers` (total, with_active_assignments, average_module_progress), and `payments` (total_revenue, total_company_reserve, total_developer_disbursed, pending_amount).
- **ProjectReport**: A per-project record exposing identifier, name, client name, status, start/end dates, overall progress (share-weighted), module list (with name, assigned developer name, progress, module status), invoiced amount, paid amount, outstanding amount.
- **DeveloperReport**: A per-developer record exposing identifier, name, count of assigned modules, modules_completed, modules_in_progress, modules_pending, earnings (paid, pending, total), and a chart-ready breakdown of earnings by project.
- **FinancialReport**: A two-level payload — per-project rows (project_id, project_name, client_name, invoiced, company_share, developer_share, outstanding, status) and totals (sum of each column over all rows in scope).
- **DeveloperSelfReport**: The `/me` shape — same fields as a single DeveloperReport row plus per-module detail (project_name, module_name, progress, status, amount_pending, amount_paid).

### Assumptions

- The reporting feature owns no persistent state. Every metric is derivable from existing tables; no migration is required.
- "Today" for the overdue calculation is the server's UTC date. Time zones are not part of this feature's scope.
- Responses are not paginated in this iteration. The system size during the next 6 months is bounded enough (low thousands of rows total) that returning every project / developer in one payload is acceptable.
- Reports are computed live; there is no read-replica or caching layer. If load grows beyond the bounds above, caching is a future enhancement and not part of this spec.
- Decimal arithmetic in this feature is *summation only* — there is no rounding, no redistribution, and no monetary computation. All redistribution math already happened in the payments feature; reporting only sums what is already in the database.
- "Active assignments" excludes soft-deleted modules and projects so that operational counts reflect today's reality, not historical assignments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user (admin, manager, or developer) loads the report relevant to their role and sees a complete, structurally valid payload in under 1 second on a database with up to 1,000 projects, 100 developers, and 10,000 payments.
- **SC-002**: For any seeded fixture, the dashboard's project counts, developer counts, and payment sums match a hand-computed reference within ±0 (exact equality), verified by automated tests across at least 6 fixture variations covering empty system, single-project, mixed-status, overdue-included, soft-deleted-excluded, and large-fanout cases.
- **SC-003**: A developer hitting `/reports/developers/me` sees their own data in 100% of attempts and never sees data attributable to another developer, verified by a scope-isolation test that seeds two disjoint developers and asserts the response cardinality and payload composition.
- **SC-004**: Cross-role access attempts (admin → /me, developer → /dashboard, etc.) are rejected with the correct status code (403) in 100% of automated test cases — at least one negative test per (role, endpoint) pair.
- **SC-005**: Each report endpoint issues no more than 4 database round-trips per request regardless of dataset size, verified by query counting in the test harness.
- **SC-006**: Adding the reporting feature introduces zero new database migrations and zero changes to the existing payments, projects, users, or clients modules — verified by `git diff` review at PR time.
- **SC-007**: The audit script (analogous to `audit_payments_imports.sh`) verifies the reporting module imports only from the allow-listed sibling symbols (FR-023) and exits 0 in CI.
- **SC-008**: At least 25 automated test cases cover the five user stories collectively, with every functional requirement (FR-001 — FR-026) exercised by at least one passing test.
- **SC-009**: Filter validation rejects every malformed input (bad date_range ordering, unknown status, non-existent client_id/developer_id) with HTTP 422 and a clear message, with at least one negative test per filter on each endpoint that supports it.
- **SC-010**: The full backend test sweep (existing 222 tests + new reporting tests) remains green after this feature lands; no regression in any prior module.

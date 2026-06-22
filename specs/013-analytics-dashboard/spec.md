# Feature Specification: Analytics & Reporting Dashboard (Frontend)

**Feature Branch**: `013-analytics-dashboard`
**Created**: 2026-06-15
**Status**: Draft
**Backend Reference**: `007-reporting` (API endpoints: `/reports/dashboard`, `/reports/projects`, `/reports/developers`, `/reports/payments`, `/reports/developers/me`)
**Input**: User description (verbatim):

> Build an analytics and reporting dashboard.
>
> Features:
> - KPI cards
> - Revenue analytics
> - Project analytics
> - Developer performance charts
> - Filters/date ranges

## Context

The backend `007-reporting` slice already owns the read-only analytics contract and is the source of truth for every field shape, RBAC rule, error code, and aggregation defined here. Its `contracts/reporting.openapi.yaml` exposes five endpoints under `/reports`:

- `GET /reports/dashboard` → composite KPI summary (project counts, developer engagement, payment flow).
- `GET /reports/projects` → per-project progress, module completion, assigned developers — filterable by `date_from`, `date_to`, `project_status`, `client_id`, `developer_id`.
- `GET /reports/developers` → per-developer module load and earnings — same filter set.
- `GET /reports/payments` → per-project financial rows plus overall totals — filterable by `date_from`, `date_to`, `project_status`, `client_id`.
- `GET /reports/developers/me` → the calling developer's own modules, progress, and earnings (no filters).

This feature is the **frontend** analytics dashboard layered on top of that contract. It introduces **no backend changes**. It builds on the foundation established by `009-auth-ui` (Axios `http` client, Zustand `session.store`, TanStack Query, React Router with `RequireAuth`, shadcn primitives, role-based navigation, 401 interceptor) and the dashboard patterns established by `010-users-dashboard`, `011-clients-dashboard`, and `012-projects-dashboard` (list/detail surfaces, client-side filtering, RBAC-aware chrome, skeleton/empty/error states). Partial scaffolding already exists under `frontend/src/modules/reporting/` (a financial report page) and `frontend/src/modules/earnings/` (a developer self-service earnings page); this feature consolidates and completes them into a coherent analytics dashboard.

Three RBAC facts from the backend (`reporting.openapi.yaml` security model) shape every story below:

1. **Admin** has full access to all four aggregate reports (dashboard, projects, developers, payments) but is **denied** `/reports/developers/me` (403) — admins use the global developers report instead.
2. **Manager** has access to all four aggregate reports and is likewise **denied** `/reports/developers/me`.
3. **Developer** is **denied all four aggregate reports** (403) and may call **only** `/reports/developers/me`. A developer must never see the analytics navigation link, the KPI cards, or any aggregate (cross-developer, revenue, company-reserve) data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operations KPI overview at a glance (Priority: P1)

An authenticated admin or manager opens the "Analytics" (or "Dashboard") page from the app navigation and immediately sees a row of KPI cards summarising the live state of the business: how many projects are pending / active / completed / overdue, how many developers are engaged and their average module progress, and the money flow (total revenue, company reserve, disbursed to developers, pending). This single view answers "is the business healthy today?" without any drill-down. A developer opening the same URL is denied entirely.

**Why this priority**: Without the KPI overview, every deeper analytics view requires manual cross-referencing. It is the entry point the role-1/role-2 stakeholders use most often, and it is the smallest end-to-end slice that delivers value. Every other story in this feature is reached from, or contextualised by, this landing view.

**Independent Test**: Sign in as admin against a seeded dataset (mix of project statuses, developers with/without assignments, payments in mixed statuses), open `/analytics`, and confirm the KPI cards render counts and sums matching the `/reports/dashboard` payload. Sign in as manager and confirm the same cards render. Sign in as developer and confirm the page is blocked with an "Access denied" state showing no aggregate data.

**Acceptance Scenarios**:

1. **Given** an admin session and a seeded dataset, **When** the admin navigates to the Analytics page, **Then** KPI cards render showing project counts (total, pending, active, completed, overdue), developer engagement (total, with-active-assignments, average module progress), and payment flow (total revenue, company reserve, developer disbursed, pending amount), each matching the `/reports/dashboard` response.
2. **Given** the same setup, **When** a manager navigates to the Analytics page, **Then** the same KPI cards render.
3. **Given** a developer session, **When** the developer navigates to `/analytics` (via link or direct URL), **Then** an "Access denied" state renders and no aggregate KPI data is shown.
4. **Given** an empty system (zero projects, developers, payments), **When** an admin loads the page, **Then** every KPI card renders a structurally valid zero value (e.g. `0`, `0.0`, monetary `0.00`) rather than blank, null, or an error.
5. **Given** the page is loading from a slow backend, **When** the data has not arrived after 200 ms, **Then** skeleton placeholders are visible in each KPI card — the user never sees a flash of empty content followed by data.
6. **Given** the backend returns an error or the network drops, **When** the page loads, **Then** an inline error state explains the failure and offers a "Try again" action that retries the fetch without reloading the page.
7. **Given** monetary KPIs, **When** the cards render, **Then** decimal-string amounts from the backend are displayed as formatted currency (never as raw floats or scientific notation) and integer counts as whole numbers.

---

### User Story 2 — Revenue analytics with charts (Priority: P1)

An admin or manager opens the Revenue analytics view and sees the financial picture: total invoiced, company share (the 30% reserve), developer share (70%), and outstanding, both as headline figures and as a per-project breakdown table, plus a chart visualising revenue composition (company vs. developer share) and per-project profitability. They use this to identify which client engagements contribute margin.

**Why this priority**: Revenue is the headline business outcome. The KPI cards give the totals; this view gives the composition and the per-project drill-down that makes the totals actionable. P1 because finance visibility is a primary reason the dashboard exists and both admin and manager are entrusted with it.

**Independent Test**: Sign in as admin, open the Revenue view, and confirm the headline totals match `/reports/payments` `totals`, the per-project table lists one row per in-scope project with invoiced / company-share / developer-share / outstanding, and a chart renders the share composition. Apply a date range and confirm the figures and rows update. Sign in as manager and confirm the same view works. Sign in as developer and confirm no Revenue affordance exists.

**Acceptance Scenarios**:

1. **Given** an admin or manager session, **When** they open the Revenue analytics view, **Then** headline cards show total invoiced, company share, developer share, and outstanding matching the `/reports/payments` `totals`.
2. **Given** the same view, **When** it renders, **Then** a per-project table shows one row per in-scope project with project name, client name, status, invoiced, company share, developer share, outstanding, and payment count.
3. **Given** the financial response, **When** the view renders, **Then** at least one chart visualises revenue composition (e.g. company share vs. developer share, or invoiced vs. outstanding) using the chart-ready figures from the response.
4. **Given** a project with no payments yet, **When** it appears in the table, **Then** its monetary columns render `0.00` rather than blank or absent.
5. **Given** the table footer, **When** it renders, **Then** the column totals equal the `totals` block from the response (the rows reconcile to the totals).
6. **Given** a developer session, **When** they attempt to reach the Revenue view (link or URL), **Then** an "Access denied" state renders and no revenue data is shown.

---

### User Story 3 — Project analytics (Priority: P1)

An admin or manager opens the Project analytics view and sees, across all projects (or a filtered subset), each project's overall progress, module completion breakdown (completed / in-progress / pending), assigned developers, and financial status (invoiced, outstanding). A chart visualises progress distribution or status mix across the portfolio so stalled or overdue work is visible at a glance.

**Why this priority**: Project health is the operational counterpart to the financial view. It turns the dashboard's "overdue / active" counts into a per-project picture of *which* projects and modules need attention. P1 because portfolio visibility is core to the daily operations the dashboard serves.

**Independent Test**: Sign in as admin, open the Project analytics view, and confirm each in-scope project renders with overall progress, module counts (completed/in-progress/pending), assigned developers, and invoiced/outstanding amounts matching `/reports/projects`. Apply a `project_status` filter and confirm only matching projects appear. Sign in as developer and confirm the view is blocked.

**Acceptance Scenarios**:

1. **Given** an admin or manager session, **When** they open the Project analytics view, **Then** a table or card grid renders one entry per in-scope project showing name, client, status, overall progress (0–100), module completion breakdown, and invoiced/outstanding amounts matching `/reports/projects`.
2. **Given** a project with modules, **When** its entry renders, **Then** a progress indicator reflects the project's `overall_progress` and the module breakdown shows completed / in-progress / pending counts that sum to `module_count`.
3. **Given** the portfolio view, **When** it renders, **Then** a chart visualises the project distribution (e.g. count by status, or progress distribution) using the report data.
4. **Given** a `project_status` filter set to `active`, **When** the view re-fetches, **Then** only projects with status `active` appear.
5. **Given** the view shows zero projects after filtering, **When** it re-renders, **Then** a friendly empty state explains no projects match the current filters and offers a "Clear filters" action.
6. **Given** a developer session, **When** they attempt to reach the Project analytics view, **Then** an "Access denied" state renders and no project data is shown.

---

### User Story 4 — Developer performance charts (Priority: P2)

An admin or manager opens the Developer performance view and sees, per developer, their module load (assigned / completed / in-progress / pending), their earnings (paid / pending / total), and a chart comparing developers' performance and earnings. They use this for capacity planning, performance reviews, and payout planning.

**Why this priority**: P2 (not P1) because the KPI overview, revenue, and project views together already give an actionable operational picture; the per-developer drill-down is the next layer of investigation on the people axis. It is independently shippable and does not block US1–US3.

**Independent Test**: Sign in as admin, open the Developer performance view, and confirm each in-scope developer renders with module counts and earnings matching `/reports/developers`, and a chart compares developers by a performance/earnings metric. Apply a `developer_id` filter and confirm only that developer appears. Sign in as developer and confirm the view is blocked (they use their own self-service view in US5).

**Acceptance Scenarios**:

1. **Given** an admin or manager session, **When** they open the Developer performance view, **Then** a table renders one row per in-scope developer showing name, module counts (total, completed, in-progress, pending), and earnings (paid, pending, total) matching `/reports/developers`.
2. **Given** the developers report, **When** the view renders, **Then** at least one chart compares developers on a performance or earnings dimension (e.g. earnings per developer, or completed modules per developer).
3. **Given** a `developer_id` filter, **When** the view re-fetches, **Then** only the selected developer's row appears.
4. **Given** a developer with no assignments and no earnings, **When** they appear in the report, **Then** their counts render `0` and earnings render `0.00` rather than blank.
5. **Given** a developer session, **When** they attempt to reach the aggregate Developer performance view, **Then** an "Access denied" state renders and no cross-developer data is shown.

---

### User Story 5 — Developer self-service performance view (Priority: P2)

A developer opens their own analytics view and sees only their own work and earnings: the modules they are assigned, their progress and status per module, and their earnings (paid vs. pending), visualised in a personal performance chart. They never see the company reserve, other developers' earnings, or aggregate revenue.

**Why this priority**: Without this, developers must ask managers for their own numbers — friction the system already removes for the rest of the business. P2 because it is independently shippable and does not block the admin/manager stories; it is the developer-scoped counterpart to US4.

**Independent Test**: Seed two developers with disjoint assignments. Sign in as developer A and confirm the self-service view shows only A's modules and earnings from `/reports/developers/me`. Sign in as developer B and confirm the view is scoped to B. Sign in as admin or manager and confirm the developer self-service view is not their landing surface (they see the aggregate views; the `/me` endpoint returns 403 for them).

**Acceptance Scenarios**:

1. **Given** a developer session with assignments, **When** the developer opens their self-service analytics view, **Then** it renders only their own modules (project name, module name, progress, status, share, amount paid, amount pending) and their earnings (paid, pending, total) from `/reports/developers/me`.
2. **Given** a developer with no assignments, **When** they open the self-service view, **Then** a structurally valid empty state renders (zero modules, `0.00` earnings) rather than an error.
3. **Given** the self-service view, **When** it renders, **Then** a personal chart visualises the developer's progress or earnings breakdown.
4. **Given** an admin or manager session, **When** the app renders, **Then** the developer self-service surface is not presented as their navigation entry; their analytics navigation routes to the aggregate views instead.
5. **Given** the self-service view is loading, **When** data has not arrived after 200 ms, **Then** a skeleton state is visible.

---

### User Story 6 — Filters and date ranges (Priority: P1)

Across the Revenue, Project, and Developer aggregate views, an admin or manager can narrow the analytics by a date range and by the report-appropriate dimension filters (`project_status`, `client_id`, `developer_id`). Filters compose as AND, are reflected in the URL so a filtered view is shareable, and invalid filter combinations surface a clear message rather than failing silently.

**Why this priority**: Date ranges and dimension filters are explicitly called out in the feature request and are what turn static reports into an investigative tool ("revenue for this client in Q2", "active projects only"). P1 because the analytics views are materially less useful without scoping, and the filter behaviour must be consistent across all three aggregate views.

**Independent Test**: On the Revenue view, set a date range that includes only some payments and confirm the figures and rows narrow accordingly; set `from > to` and confirm a clear validation message appears and no malformed request is sent. On the Project view, set `project_status` and `client_id` together and confirm only projects matching both appear. Confirm the active filters appear in the URL query string and survive a page reload.

**Acceptance Scenarios**:

1. **Given** any aggregate analytics view (Revenue, Project, Developer), **When** the user sets a date range (`from`/`to`), **Then** the view re-fetches with `date_from`/`date_to` and the displayed figures reflect only data within that range.
2. **Given** a date range where `from` is later than `to`, **When** the user applies it, **Then** the UI surfaces a clear validation message (matching the backend's 422 contract) and does not render stale or misleading figures.
3. **Given** the Project or Developer view, **When** the user applies `project_status`, `client_id`, and/or `developer_id` filters, **Then** the view re-fetches and only rows matching all applied filters (AND composition) appear.
4. **Given** any filter that the backend rejects (unknown status, non-existent client_id/developer_id, bad date range → 422), **When** the request returns, **Then** the view surfaces a clear inline message and offers a way to clear or correct the filter.
5. **Given** active filters, **When** they are applied, **Then** they are encoded in the URL query string so the filtered view is shareable and restored on reload/deep-link.
6. **Given** a "Clear filters" action, **When** the user invokes it, **Then** all filters reset and the view returns to the full unfiltered scope.

---

### User Story 7 — RBAC-aware analytics navigation (Priority: P1)

The application chrome renders the analytics navigation entry appropriately per role: admin and manager see the aggregate analytics entry (KPI overview + Revenue / Project / Developer views); developers see only their self-service performance entry. Developers never see the aggregate analytics link, the KPI cards, or any cross-developer / revenue / company-reserve data. Session expiry and mid-session role changes are handled gracefully.

**Why this priority**: This is the gate that lets the feature ship to the whole user base under least privilege. Without it, developers see UI that 403s on click, and the analytics surface leaks aggregate business data to roles that may not see it. P1 because it makes the dashboard safe and coherent for all three roles.

**Independent Test**: Sign in as each of admin, manager, developer in turn. In each session: (a) check the analytics navigation entry matches the matrix below, (b) deep-link to each analytics route and confirm the expected result (rendered view vs. access-denied vs. self-service redirect), (c) confirm session expiry and role change behaviours.

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the app renders, **Then** the navigation contains an "Analytics" entry leading to the KPI overview, and the Revenue, Project, and Developer aggregate views are all reachable.
2. **Given** a manager session, **When** the app renders, **Then** the navigation contains the same aggregate "Analytics" entry and all aggregate views are reachable (managers have the same report access as admin for these four reports).
3. **Given** a developer session, **When** the app renders, **Then** the navigation does NOT contain the aggregate "Analytics" entry; the developer sees only their self-service performance entry, and deep-linking to any aggregate analytics route shows an "Access denied" state with no aggregate data.
4. **Given** a user whose session expires while on an analytics page, **When** they next trigger a request (apply a filter, retry a fetch, navigate to another analytics view), **Then** they are redirected to login with a "session ended" notice and the URL they were on is preserved so they return there after signing in.
5. **Given** a user whose role changes in another tab (e.g. admin demoted to developer), **When** the next interaction occurs in this tab, **Then** the navigation and accessible analytics views re-render against the new role without a full page reload (aggregate views become inaccessible for the demoted user).

---

### Edge Cases

- **Empty system.** When there are no projects, developers, or payments, every view MUST render a structurally complete zero-state (KPI cards show zeros, tables show a "no data yet" empty state) — never a blank screen, null, or error.
- **Decimal-string money.** The backend returns monetary and average-progress values as decimal strings (e.g. `"1800.00"`, `"66.7"`), never floats. The UI MUST parse and format these for display without floating-point rounding artifacts, and MUST never display raw scientific notation.
- **Date-range split between projects and payments.** Per the backend, when a `date_range` is supplied, payment-side aggregations filter on payment `created_at` and project-side on project `created_at`. A window that splits a project from its payments can yield figures that do not line up across views — this is documented backend behaviour, surfaced as-is, not a frontend bug.
- **Filters compose as AND.** Supplying both `client_id` and `developer_id` (where supported) returns only rows matching both; an over-constrained combination yields a valid empty result, shown as an empty state, not an error.
- **Developer scope isolation.** A developer's self-service view MUST never be widenable by tampering with query params; the frontend MUST NOT send a `developer_id` for another user from the `/me` surface, and the backend ignores/rejects any such attempt.
- **Forbidden cross-role access.** An admin or manager hitting `/reports/developers/me` receives 403; a developer hitting any aggregate report receives 403. The UI must present these as "Access denied" states, never as a generic crash.
- **Live (uncached-by-backend) data.** Reports are computed live on each backend request; the frontend MAY cache responses within a short freshness window (per the established TanStack Query pattern) and refresh on window focus, but MUST treat each report as the live truth at fetch time.
- **Stale filter in URL.** A deep-linked URL carrying a `client_id`/`developer_id` that no longer exists MUST surface the backend's 422 as a correctable inline message, not a blank or crashing view.
- **Large portfolios.** The first iteration assumes the backend returns the full in-scope list and the frontend renders/charts it directly; if dataset sizes grow past the backend's stated bounds, server-side pagination of report rows becomes a follow-up.

## Requirements *(mandatory)*

### Functional Requirements

#### KPI overview (dashboard)

- **FR-001**: The Analytics landing page MUST render KPI cards sourced from `GET /reports/dashboard`, grouped into project counts (total, pending, active, completed, overdue), developer engagement (total, with active assignments, average module progress), and payment flow (total revenue, company reserve, developer disbursed, pending amount).
- **FR-002**: KPI cards MUST display integer counts as whole numbers and decimal-string values (money, average progress) as formatted figures without floating-point artifacts.
- **FR-003**: On an empty system the KPI cards MUST render structurally valid zero values rather than blank, null, or an error.

#### Revenue analytics

- **FR-004**: The Revenue view MUST render headline totals (invoiced, company share, developer share, outstanding) from the `totals` block of `GET /reports/payments`, and a per-project table with one row per in-scope project (project name, client name, status, invoiced, company share, developer share, outstanding, payment count).
- **FR-005**: The Revenue view MUST render at least one chart visualising revenue composition or per-project profitability from the financial response.
- **FR-006**: The per-project table totals MUST reconcile to the response `totals` block, and projects with no payments MUST render zero amounts rather than being omitted.

#### Project analytics

- **FR-007**: The Project view MUST render one entry per in-scope project from `GET /reports/projects`, showing name, client, status, overall progress (0–100), module completion breakdown (completed / in-progress / pending), and invoiced/outstanding amounts.
- **FR-008**: The Project view MUST render a progress indicator per project reflecting `overall_progress`, with the module breakdown counts summing to `module_count`.
- **FR-009**: The Project view MUST render at least one chart visualising the portfolio (e.g. project count by status, or progress distribution).

#### Developer performance

- **FR-010**: The aggregate Developer view MUST render one row per in-scope developer from `GET /reports/developers`, showing name, module counts (total, completed, in-progress, pending), and earnings (paid, pending, total).
- **FR-011**: The aggregate Developer view MUST render at least one chart comparing developers on a performance or earnings dimension.
- **FR-012**: The developer self-service view MUST render the calling developer's own modules and earnings from `GET /reports/developers/me`, scoped strictly to that developer, with a personal performance chart; it MUST render a valid empty state for a developer with no assignments.

#### Filters & date ranges

- **FR-013**: The Revenue, Project, and Developer aggregate views MUST provide a date-range filter that maps to `date_from`/`date_to`, plus the report-appropriate dimension filters (`project_status` for Revenue and Project; `client_id` for Revenue and Project; `developer_id` for Project and Developer).
- **FR-014**: Filters MUST compose as AND, and applying them MUST trigger a re-fetch scoped by the active filter set; clearing filters MUST return the view to the full unfiltered scope.
- **FR-015**: A date range with `from > to`, or any filter value the backend rejects with 422 (unknown status, non-existent client_id/developer_id), MUST surface a clear inline message and MUST NOT leave stale/misleading figures on screen.
- **FR-016**: Active filters MUST be encoded in the URL query string so a filtered view is shareable and restored on reload/deep-link.

#### Shared view behaviour

- **FR-017**: Every analytics view MUST render a skeleton/loading state while its data is fetched (no flash of empty content), an inline error state with a "Try again" action on fetch failure, and an empty state when a report returns no rows.
- **FR-018**: Each view MUST cache its fetched data within the established freshness window and reuse it on revisit, refreshing when the window regains focus, while treating each report as the live truth at fetch time.
- **FR-019**: Monetary and average values returned as decimal strings MUST be formatted for display without floating-point rounding artifacts; the UI MUST NOT coerce them through lossy float arithmetic before display.

#### RBAC-aware UI

- **FR-020**: The aggregate "Analytics" navigation entry (KPI overview + Revenue / Project / Developer views) MUST render for admin and manager sessions only.
- **FR-021**: Developers MUST see only the self-service performance navigation entry; the aggregate analytics link MUST NOT exist in the DOM for developers, and deep-linking to any aggregate analytics route MUST render an "Access denied" state with no aggregate data.
- **FR-022**: Each aggregate analytics route MUST be guarded so that a developer reaching it (via URL) sees "Access denied", and the self-service route MUST be guarded so that an admin/manager reaching it sees the appropriate non-developer result (redirect to aggregate views or access-denied), consistent with the backend's 403 contract.
- **FR-023**: When the current session loses authentication mid-page (a request returns 401), the user MUST be redirected to login with a "session ended" notice, and the URL they were on MUST be preserved so they return there after signing in.
- **FR-024**: When the current session's role changes, the navigation and accessible analytics views MUST re-render against the new role without a full page reload.

#### Consistency & non-functional

- **FR-025**: The frontend MUST consume the `007-reporting` contract unchanged and introduce no backend changes; all field names, filter parameters, error codes, and RBAC rules are taken from `reporting.openapi.yaml`.
- **FR-026**: The feature MUST reconcile and reuse the existing partial scaffolding under `frontend/src/modules/reporting/` and `frontend/src/modules/earnings/` rather than duplicating report-fetching logic, and MUST correct any endpoint-path drift so requests target the documented `/reports/*` paths.

### Key Entities *(read-only views over existing backend data)*

- **DashboardSummary** (read-only): The KPI payload — `projects` (total, pending, active, completed, overdue), `developers` (total, with_active_assignments, average_module_progress as decimal string), `payments` (total_revenue, total_company_reserve, total_developer_disbursed, pending_amount as decimal strings). Source of truth: `GET /reports/dashboard`.
- **ProjectReportRow** (read-only): Per-project analytics record — id, name, client, status, dates, overall_progress, module counts, invoiced/outstanding amounts, and a module list. Source: `GET /reports/projects`.
- **DeveloperReportRow** (read-only): Per-developer analytics record — id, name, email, module counts, earnings block (paid/pending/total), and earnings-by-project breakdown for charting. Source: `GET /reports/developers`.
- **FinancialReportResponse** (read-only): Revenue analytics payload — per-project `rows` (invoiced, company_share, developer_share, outstanding, payment_count) plus a `totals` block. Source: `GET /reports/payments`.
- **DeveloperSelfReport** (read-only): The developer's own analytics — module counts, earnings block, and per-module detail (progress, status, share, amount_paid, amount_pending). Source: `GET /reports/developers/me`.
- **AnalyticsFilter** (client-only): The active filter set for an aggregate view — `date_from`, `date_to`, `project_status`, `client_id`, `developer_id` — held in the URL query string so a filtered view is shareable and restorable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin or manager loads the Analytics page and sees a complete, structurally valid set of KPI cards (or skeletons — never a blank flash) within 1 second on a typical broadband connection.
- **SC-002**: For any seeded fixture, the figures shown in the KPI cards, Revenue totals, Project rows, and Developer rows match the corresponding `/reports/*` API responses exactly (no transcription or rounding error), verified across at least 5 fixture variations covering empty system, single-project, mixed-status, overdue-included, and large-fanout cases.
- **SC-003**: A developer accessing the analytics surface sees only their own self-service data in 100% of attempts and never sees aggregate revenue, company-reserve, or other developers' data — verified by a scope-isolation test seeding two disjoint developers plus negative deep-link tests against every aggregate route.
- **SC-004**: Cross-role access attempts (developer → any aggregate route, admin/manager → `/me`) render the correct guarded state (Access denied / redirect) in 100% of automated test cases — at least one negative test per (role, route) pair.
- **SC-005**: Applying a date range or dimension filter narrows the displayed figures correctly and updates the URL query string in 100% of cases, and a malformed filter (e.g. `from > to`, unknown id → 422) surfaces a clear inline message without leaving stale figures, verified by at least one negative test per filter on each aggregate view.
- **SC-006**: 100% of analytics views display a "Try again" affordance (or retry-able inline error) when the backend is unreachable and recover without a page reload once connectivity returns.
- **SC-007**: Each chart and table renders monetary/decimal values from the backend's decimal strings with no floating-point rounding artifact, verified by tests asserting formatted output for representative values (e.g. `"1800.00"` → `$1,800.00`, `"66.7"` → `66.7%`).
- **SC-008**: Keyboard-only and screen-reader users can reach and operate every analytics view and filter (navigate views, set a date range, apply/clear filters) without a mouse, and charts expose an accessible text/table equivalent of their data.
- **SC-009**: Adding this feature introduces zero backend changes — verified by `git diff` showing no edits under `backend/app/modules/reporting/` or other backend report logic at PR time.

## Assumptions

- The backend `007-reporting` slice is deployed and its `contracts/reporting.openapi.yaml` is the stable wire contract: endpoint paths (`/reports/dashboard`, `/reports/projects`, `/reports/developers`, `/reports/payments`, `/reports/developers/me`), filter parameters (`date_from`, `date_to`, `project_status`, `client_id`, `developer_id`), field shapes (money/average as decimal strings, counts as integers), and error codes (401/403/422) are pulled from there.
- The `009-auth-ui` foundation (`RequireAuth`, session store, `http` 401 interceptor, role selectors, cross-tab `storage` sync) and the `010/011/012` dashboard patterns (skeleton/empty/error states, RBAC-aware chrome, URL-encoded filters) are in place and reused.
- **Charts are rendered client-side** from the report payloads. The backend returns chart-ready arrays (e.g. `earnings_by_project`) and aggregate figures; the frontend selects a charting approach consistent with the existing stack — no new backend chart endpoints are introduced.
- **Manager has the same access as admin** for the four aggregate reports (dashboard, projects, developers, payments) per the backend RBAC; the only role asymmetry surfaced here is that developers are restricted to `/me` and admin/manager are denied `/me`.
- The analytics views are read-only; there are no create/edit/delete actions in this feature (unlike the clients/projects dashboards).
- Existing partial scaffolding (`frontend/src/modules/reporting/FinancialReportPage.tsx`, `frontend/src/modules/earnings/DeveloperEarningsPage.tsx`) is treated as a starting point to be consolidated, with any endpoint-path drift (e.g. `/reporting/payments` vs. the documented `/reports/payments`) corrected against the contract.
- The current dataset fits within the backend's stated bounds (low thousands of rows), so each report is fetched as a single payload and charted directly; server-side pagination of report rows is a follow-up if those bounds are exceeded.
- "Today" for overdue and date semantics is the server's UTC date, consistent with the backend; the frontend displays dates as provided and does not re-derive overdue status client-side.

## Out of Scope

- Any backend change — this feature consumes the existing `007-reporting` contract unchanged; no new endpoints, fields, or migrations.
- Server-side pagination, sorting, or aggregation of report rows beyond what the backend already returns.
- Export to CSV/PDF or scheduled/emailed reports.
- Persisted user-defined dashboards, saved filter presets, or per-user layout customisation.
- Drill-through from an analytics row into the editable clients/projects/payments dashboards (cross-linking is a possible follow-up, not part of this read-only analytics slice).
- Real-time/streaming updates or auto-refresh beyond the established focus-refresh freshness window.
- A caching/materialised-view layer — reports are computed live by the backend on each request.
- Forecasting, trend prediction, or any analytics not directly derivable from the five existing `/reports/*` endpoints.

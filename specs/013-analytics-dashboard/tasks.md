---
description: "Task list for 013-analytics-dashboard implementation"
---

# Tasks: Analytics & Reporting Dashboard (Frontend)

**Input**: Design documents from `/specs/013-analytics-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/frontend-consumption.md, contracts/reporting.openapi.yaml, quickstart.md

**Tests**: INCLUDED — the spec's Success Criteria (SC-002..SC-008) and `contracts/frontend-consumption.md §7` define a test contract (unit + component/MSW + RBAC), and the constitution mandates loading/error/RBAC test coverage. Tests for a story are written before its implementation and must fail first.

**Organization**: Grouped by user story (US1–US7 from spec.md) for independent implementation and testing. This is a **frontend-only** feature consuming the existing `007-reporting` API — **no backend changes**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7; Setup/Foundational/Polish carry no story label
- All paths are repo-relative under `frontend/`

## Path Conventions

- App code: `frontend/src/...`
- Tests: `frontend/tests/{unit,component}/...`, mocks in `frontend/tests/mocks/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and the shared cross-cutting primitives.

- [X] T001 Install Recharts: run `npm install recharts` in `frontend/` and confirm it lands in `frontend/package.json` dependencies (research R1).
- [X] T002 [P] Create shared formatting util `frontend/src/lib/format.ts` exposing `formatCurrency(value: string | number)` and `formatPercent(value: string | number)` using `Intl.NumberFormat`, parsing decimal strings only at the display boundary (research R2, FR-019).
- [X] T003 [P] Create shared chart primitive `frontend/src/components/ui/chart.tsx` wrapping Recharts (ResponsiveContainer + theming via Tailwind tokens), exporting the bar/pie/stacked-bar building blocks the analytics charts will use (research R1).

**Checkpoint**: Charting + formatting available; nothing wired yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, API layer (with the `/reporting/*`→`/reports/*` path fix), query keys, filter schema+hook, RBAC, guard, shared states, MSW mocks, and route scaffolding that ALL stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Add/retype aggregate view-model types in `frontend/src/modules/reporting/types.ts`: `DashboardSummary`, `ProjectReportRow`, `ProjectReportModule`, `DeveloperReportRow`, `EarningsBlock`, `EarningsByProject`, `FinancialReportResponse`, `FinancialReportRow`, `FinancialTotals`, shared `ProjectStatus`/`ModuleStatus` — all monetary/average fields typed as `string` (data-model.md §1–4, FR-026).
- [X] T005 [P] Retype self-service types in `frontend/src/modules/earnings/types.ts`: `EarningsBlock.{paid,pending,total}`, `DeveloperSelfModule.{share_percentage,amount_paid,amount_pending}` from `number` → `string` (data-model.md §5, FR-026).
- [X] T006 Create `frontend/src/modules/reporting/services/reporting.api.ts` with base path `/reports` and functions `getDashboardSummary()`, `getFinancialReport(filter)`, `getProjectsReport(filter)`, `getDevelopersReport(filter)` plus the `REPORTING_QUERY_KEYS` factory; serialize only defined filter fields and OMIT `developer_id` from the `/reports/payments` request (contracts §1–2, R3/R4). Remove the obsolete `frontend/src/modules/reporting/api.ts` and update `frontend/src/modules/reporting/index.ts` exports.
- [X] T007 Fix self-service endpoint path in `frontend/src/modules/earnings/api.ts`: `getMySelfReport` must call `/reports/developers/me` (was `/reporting/developers/me`); never send query params (R3, FR-012).
- [X] T008 [P] Create `frontend/src/modules/reporting/schemas/analytics-filter.schema.ts`: Zod schema + `parseFilter(URLSearchParams)` and `filterToParams(filter)`, with a refinement flagging `date_from > date_to` as a client-side error (mirrors `clients-filter.schema.ts`; R5, data-model.md §6).
- [X] T009 [P] Create `frontend/src/modules/reporting/hooks/useAnalyticsFilter.ts` binding the filter to the URL via `useSearchParams` (read = `parseFilter`, write = `filterToParams`), exposing `{ filter, setFilter, clearFilters, dateError }` (R5, FR-016).
- [X] T010 [P] Add RBAC helpers to `frontend/src/lib/rbac.ts`: `canViewAnalytics(role)` → admin|manager; `canViewOwnPerformance(role)` → developer (contracts §4, FR-020..022).
- [X] T011 Create `frontend/src/modules/reporting/components/AccessDenied.tsx` and `frontend/src/modules/reporting/components/RequireAnalyticsAccess.tsx` (renders `AccessDenied` when `!canViewAnalytics(role)`), mirroring `RequireClientsAccess` (R6, FR-022).
- [X] T012 [P] Create shared state components `frontend/src/modules/reporting/components/EmptyState.tsx` and `frontend/src/modules/reporting/components/ErrorState.tsx` (Try-again calls `refetch`), mirroring the clients module (R8, FR-017).
- [X] T013 Create `frontend/tests/mocks/reporting-handlers.ts` with MSW handlers for all five `/reports/*` endpoints (including role-based 401/403) and register them in `frontend/tests/mocks/server.ts`; correct any pre-existing `/reporting/*` paths in mocks (R3, contracts §7 path-fix).
- [X] T014 Add aggregate routes in `frontend/src/routes.tsx` (`/analytics`, `/analytics/revenue`, `/analytics/projects`, `/analytics/developers`, each wrapped in `RequireAnalyticsAccess`) and migrate the existing `/reports/financial` route to `/analytics/revenue`; pages may be temporary stubs until their story phase (contracts §3).

### Foundational tests

- [X] T015 [P] Unit test `frontend/tests/unit/analytics-filter.schema.test.ts`: parse/serialize round-trip, empty-field omission, and `date_from > date_to` rejection (SC-005).
- [X] T016 [P] Unit test `frontend/tests/unit/format.test.ts`: `formatCurrency("1800.00") → $1,800.00`, `formatPercent("66.7") → 66.7%`, no float artifacts (SC-007).
- [X] T017 [P] Unit test `frontend/tests/unit/reporting.api.test.ts`: builds correct `/reports/*` query strings and OMITS `developer_id` from the payments request (R3, contracts §7).
- [X] T018 [P] Unit test `frontend/tests/unit/rbac.analytics.test.ts`: truth table for `canViewAnalytics` / `canViewOwnPerformance` across all roles + null.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Operations KPI overview (Priority: P1) 🎯 MVP

**Goal**: Admin/manager see KPI cards (project counts, developer engagement, payment flow) at `/analytics`; developers are denied.

**Independent Test**: Sign in as admin → `/analytics` shows KPI cards matching `/reports/dashboard`; empty DB → zeros; developer → Access denied.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T019 [P] [US1] Component test `frontend/tests/component/AnalyticsDashboardPage.test.tsx`: skeleton→data, KPI values match mocked `/reports/dashboard`, empty-system zeros, error→Try again recovers (SC-001/002, FR-001/003).
- [X] T020 [P] [US1] RBAC test `frontend/tests/component/RequireAnalyticsAccess.test.tsx`: developer deep-linking `/analytics` sees Access denied with no data (SC-004).
- [X] T021 [P] [US1] Create `frontend/src/modules/reporting/hooks/useDashboardSummary.ts` (React Query, `staleTime 30_000`, `refetchOnWindowFocus`).
- [X] T022 [P] [US1] Create `frontend/src/modules/reporting/components/KpiCard.tsx` and `KpiCardGrid.tsx` (integer counts raw; decimal-string fields via `formatCurrency`/`formatPercent`).
- [X] T023 [US1] Create `frontend/src/modules/reporting/pages/AnalyticsDashboardPage.tsx` wiring `useDashboardSummary` + `KpiCardGrid` with Skeleton/ErrorState/zero-state; mount at `/analytics` (replace stub from T014).

**Checkpoint**: KPI overview fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 — Revenue analytics with charts (Priority: P1)

**Goal**: Admin/manager see revenue totals + per-project table + composition chart at `/analytics/revenue`.

**Independent Test**: `/analytics/revenue` totals match `/reports/payments` `totals`, rows reconcile to totals, a composition chart renders; developer denied.

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Component test `frontend/tests/component/RevenueAnalyticsPage.test.tsx`: totals + row reconciliation, zero-payment project shows `0.00`, chart present, currency formatting, error/empty states (FR-004/005/006, SC-007).
- [X] T025 [P] [US2] Create `frontend/src/modules/reporting/hooks/useFinancialReport.ts` (accepts `AnalyticsFilter`, default empty = full scope; query key from factory).
- [X] T026 [P] [US2] Create `frontend/src/modules/reporting/components/charts/RevenueCompositionChart.tsx` (company vs developer share / invoiced vs outstanding) on the `chart.tsx` primitive, with an accessible table/summary equivalent (SC-008).
- [X] T027 [US2] Create `frontend/src/modules/reporting/pages/RevenueAnalyticsPage.tsx` by refactoring the existing `pages/FinancialReportPage.tsx` onto `useFinancialReport` + headline cards + per-project table (footer totals from `totals`) + `RevenueCompositionChart` + Skeleton/Error/Empty; mount at `/analytics/revenue`.

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 3 — Project analytics (Priority: P1)

**Goal**: Admin/manager see per-project progress, module breakdown, financials, and a portfolio chart at `/analytics/projects`.

**Independent Test**: `/analytics/projects` rows match `/reports/projects`; progress bar reflects `overall_progress`; module counts sum to `module_count`; chart renders; developer denied.

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] Component test `frontend/tests/component/ProjectAnalyticsPage.test.tsx`: rows render, `modules_completed+in_progress+pending === module_count`, progress indicator, status/progress chart present, empty/error states (FR-007/008/009).
- [X] T029 [P] [US3] Create `frontend/src/modules/reporting/hooks/useProjectsReport.ts` (accepts filter; query key from factory).
- [X] T030 [P] [US3] Create `frontend/src/modules/reporting/components/charts/ProjectStatusChart.tsx` (count by status / progress distribution) with accessible equivalent (SC-008).
- [X] T031 [US3] Create `frontend/src/modules/reporting/pages/ProjectAnalyticsPage.tsx` wiring `useProjectsReport` + per-project table/cards (reuse `ProgressBar`/`StatusBadge` from projects module) + `ProjectStatusChart` + states; mount at `/analytics/projects`.

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 — Developer performance charts (Priority: P2)

**Goal**: Admin/manager see per-developer module load + earnings + comparison chart at `/analytics/developers`.

**Independent Test**: `/analytics/developers` rows match `/reports/developers`; chart compares developers; zero-assignment developer shows `0`/`0.00`; developer role denied.

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] Component test `frontend/tests/component/DeveloperPerformancePage.test.tsx`: rows + earnings, comparison chart present, zero-state values, error/empty states (FR-010/011).
- [X] T033 [P] [US4] Create `frontend/src/modules/reporting/hooks/useDevelopersReport.ts` (accepts filter; query key from factory).
- [X] T034 [P] [US4] Create `frontend/src/modules/reporting/components/charts/DeveloperEarningsChart.tsx` (earnings or completed-modules per developer) with accessible equivalent (SC-008).
- [X] T035 [US4] Create `frontend/src/modules/reporting/pages/DeveloperPerformancePage.tsx` wiring `useDevelopersReport` + table + `DeveloperEarningsChart` + states; mount at `/analytics/developers`.

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 — Developer self-service performance (Priority: P2)

**Goal**: A developer sees only their own modules + earnings + a personal chart at `/earnings`.

**Independent Test**: developer A → `/earnings` shows only A's modules/earnings from `/reports/developers/me`; no-assignment developer → valid empty state; no aggregate data leaks.

### Tests for User Story 5 ⚠️

- [X] T036 [P] [US5] Component test `frontend/tests/component/DeveloperEarningsPage.test.tsx`: own-data-only rendering, empty state for no assignments, personal chart present, skeleton state (FR-012, SC-003).
- [X] T037 [P] [US5] Create `frontend/src/modules/earnings/hooks/useMySelfReport.ts` (React Query over `getMySelfReport`, query key `["reports","developers","me"]`).
- [X] T038 [US5] Enrich `frontend/src/modules/earnings/pages/DeveloperEarningsPage.tsx`: use `useMySelfReport`, render per-module detail (project, module, progress, status, share, paid/pending via `formatCurrency`/`formatPercent`) + a personal performance chart + Skeleton/Empty/Error.

**Checkpoint**: US1–US5 independently functional.

---

## Phase 8: User Story 6 — Filters and date ranges (Priority: P1)

**Goal**: Mount the shared filter bar on the three aggregate views; filters compose as AND, sync to URL, validate, and surface 422 inline.

**Independent Test**: Set a date range on Revenue → figures narrow + URL updates + reload restores; `from > to` → inline error, no request; bad id → backend 422 inline; status+client on Projects → only matching rows; Clear filters → full scope.

### Tests for User Story 6 ⚠️

- [X] T039 [P] [US6] Component test `frontend/tests/component/AnalyticsFilters.test.tsx`: applying filters updates URL + triggers refetch; `date_from>date_to` shows inline error and sends no request; mocked 422 surfaces inline; Clear filters resets to full scope (FR-013..016, SC-005).
- [X] T040 [US6] Create `frontend/src/modules/reporting/components/AnalyticsFilters.tsx` (date range inputs + `project_status`/`client_id`/`developer_id` selects, prop-driven to show only the filters a view supports) using `useAnalyticsFilter`, surfacing `dateError` and a Clear-filters action.
- [X] T041 [US6] Mount `AnalyticsFilters` in `RevenueAnalyticsPage.tsx` (date, status, client — NO developer_id) and feed `filter` into `useFinancialReport` (contracts §1).
- [X] T042 [US6] Mount `AnalyticsFilters` in `ProjectAnalyticsPage.tsx` (date, status, client, developer) and feed `filter` into `useProjectsReport`.
- [X] T043 [US6] Mount `AnalyticsFilters` in `DeveloperPerformancePage.tsx` (date, status, client, developer) and feed `filter` into `useDevelopersReport`.
- [X] T044 [US6] Add inline 422 handling across the three pages: map backend `InvalidFilter` (422) to a correctable message near the filter bar without clearing/replacing prior figures misleadingly (FR-015).

**Checkpoint**: Filtering works consistently across all aggregate views.

---

## Phase 9: User Story 7 — RBAC-aware analytics navigation (Priority: P1)

**Goal**: Nav shows the aggregate "Analytics" entry for admin/manager and "My Earnings" for developers; deep-link guards + session-expiry + role-change handled.

**Independent Test**: Per role, nav entries match the matrix; developer deep-link to any `/analytics*` = Access denied; role change in another tab re-renders nav without reload; 401 → login preserving URL.

### Tests for User Story 7 ⚠️

- [X] T045 [P] [US7] RBAC component test `frontend/tests/component/AppHeader.analytics.test.tsx`: admin/manager see "Analytics" (no "My Earnings"), developer sees "My Earnings" (no "Analytics"); plus deep-link guard + role-change re-render assertions (FR-020/021/024, SC-004/006).
- [X] T046 [US7] Update `frontend/src/modules/auth/components/AppHeader.tsx`: replace the "Financial Reports" → `/reports/financial` link with an "Analytics" → `/analytics` link gated `IfRole admin|manager`; keep "My Earnings" → `/earnings` gated `IfRole developer`.
- [X] T047 [US7] Verify/confirm guards on all `/analytics*` routes in `routes.tsx`, that the existing 401 interceptor + `RequireAuth` preserve the return URL (FR-023), and that the session store's role change re-renders nav/views without reload (FR-024).

**Checkpoint**: All seven user stories independently functional and RBAC-correct.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T048 [P] Remove dead code: delete the obsolete `frontend/src/modules/reporting/pages/FinancialReportPage.tsx` (superseded by `RevenueAnalyticsPage`) and any leftover `/reporting/*` references; confirm `index.ts` exports are clean.
- [x] T049 [P] Run `npm run typecheck` and `npm run lint` in `frontend/` — zero errors, no implicit `any`.
- [x] T050 Accessibility pass: confirm every chart has a text/table equivalent and all views + filters are keyboard reachable (SC-008).
- [x] T051 Run the full `npm run test` sweep and the `quickstart.md` manual verification per user story; confirm no regression in prior modules.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories.
- **User Stories (Phases 3–9)**: all depend on Foundational. US1–US5 are mutually independent (different pages/hooks). **US6 depends on US2/US3/US4 pages existing** (it mounts the filter bar onto them). US7 depends on the `/analytics*` routes/guard (Foundational) and is best done after the pages exist.
- **Polish (Phase 10)**: after all targeted stories.

### Critical path (note)

- The endpoint path fix (T006/T007) and MSW mock fix (T013) are in Foundational specifically so every later component test runs against the correct `/reports/*` paths.
- US6 (filters) is P1 but sequenced after the aggregate view pages (US2/US3/US4) because it augments them; the hooks already accept a filter (default empty) from Foundational, so the views work pre-filter.

### Within Each User Story

- Story tests written first and failing → hooks/components ([P]) → page (integration) → checkpoint.

### Parallel Opportunities

- Setup: T002, T003 in parallel (T001 first).
- Foundational: T004, T005, T008, T009, T010, T012 in parallel; then T006 (depends on T004), T007, T011 (depends on T010), T013, T014; tests T015–T018 in parallel.
- Within a story: the `[P]` test, hook, and chart/card tasks run in parallel; the page task integrates them last.
- Across stories: US1–US5 can be built by different developers in parallel once Foundational is done.

---

## Parallel Example: User Story 2

```bash
# After Foundational, launch US2 test + independent pieces together:
Task: "T024 Component test RevenueAnalyticsPage in frontend/tests/component/RevenueAnalyticsPage.test.tsx"
Task: "T025 useFinancialReport hook in frontend/src/modules/reporting/hooks/useFinancialReport.ts"
Task: "T026 RevenueCompositionChart in frontend/src/modules/reporting/components/charts/RevenueCompositionChart.tsx"
# Then integrate:
Task: "T027 RevenueAnalyticsPage page wiring"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** `/analytics` KPI overview → demo.

### Incremental Delivery

Foundation → US1 (MVP) → US2 → US3 → US4 → US5 → US6 (filters across views) → US7 (RBAC nav) → Polish. Each story is an independently testable, demoable increment.

### Story → primary requirement coverage

- US1 → FR-001..003 · US2 → FR-004..006 · US3 → FR-007..009 · US4 → FR-010,011 · US5 → FR-012 · US6 → FR-013..016 · US7 → FR-020..024. Cross-cutting FR-017..019, FR-025/026 covered in Foundational + Polish.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Each story is independently completable/testable; verify story tests fail before implementing.
- Commit after each task or logical group.
- **Zero backend changes** (SC-009) — verify no `backend/` edits at PR time.
- Total tasks: **51** (Setup 3, Foundational 15, US1 5, US2 4, US3 4, US4 4, US5 3, US6 6, US7 3, Polish 4).

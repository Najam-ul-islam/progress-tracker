---
description: "Dependency-ordered task list for feature 007-reporting"
---

# Tasks: Reporting & Analytics

**Input**: Design documents in `specs/007-reporting/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reporting.openapi.yaml, quickstart.md

**Tests**: INCLUDED. Spec mandates ≥25 cases (SC-008) and an audit-script-equivalent test (Decision 7 in research.md).

**Organisation**: Tasks are grouped by user story (US1–US5) so each priority slice ships independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 dashboard P1; US2 projects P2; US3 developers P2; US4 financial P3; US5 self-service P2)
- Paths are absolute under `D:\progress-tracker\` (the repo root) and use forward slashes inside the file content.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependencies and create the empty module skeleton. No business logic.

- [X] T001 Verify dependency state via `cd backend && uv sync` — must report no changes (this feature adds **zero** new packages; if `uv sync` reports any add/remove, STOP and investigate).
- [X] T002 [P] Create the empty six-file module skeleton at `backend/app/modules/reporting/`: `__init__.py`, `model.py` (empty stub — file header comment only, no symbols), `schema.py` (header only), `repository.py` (header only), `service.py` (header only), `routes.py` (header only), `dependencies.py` (empty stub). Each file ≤5 lines.
- [X] T003 [P] Author `backend/scripts/audit_reporting_imports.sh` enforcing the FR-023 allow-list (`projects.repository`, `payments.repository`, `users.repository`, `clients.repository`, `auth.dependencies`, `auth.schema`) AND the read-only contract (forbid `session.add(`, `session.delete(`, `session.merge(`, `session.commit(` anywhere under `backend/app/modules/reporting/`). Mirror the regex style of `backend/scripts/audit_payments_imports.sh`. Make executable; exit 0 on pass, non-zero on violation.
- [X] T004 Add the line `("reporting", "/reports"),` to the `MODULE_REGISTRY` tuple in `backend/app/main.py` immediately after the `("payments", "/payments")` entry. Do not edit any other line. Verify the file still parses with `uv run python -c "from app.main import app"`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story scaffolding — typed exceptions, filter context, helpers — that every user story phase needs.

- [X] T005 In `backend/app/modules/reporting/service.py`, declare 4 typed exceptions: `InvalidDateRange`, `InvalidProjectStatus`, `ClientNotFound`, `DeveloperNotFound`. Each subclasses `Exception`; each carries a single human-readable message. Match the exception-class style of `backend/app/modules/payments/service.py`.
- [X] T006 In `backend/app/modules/reporting/service.py`, define an internal `FilterContext` dataclass (`@dataclass(frozen=True)`) with fields `date_from: date | None`, `date_to: date | None`, `project_status: str | None`, `client_id: int | None`, `developer_id: int | None`. Pure data; no methods.
- [X] T007 [P] In `backend/tests/_reporting_helpers.py`, author `seed_reporting_landscape(client, session, seed_admin, seed_manager, seed_developer, auth_header) -> dict` that builds: 2 clients, 4 projects (one each: pending, active, completed, active-but-overdue), 6 modules across 3 developers (with progress values [100, 60, 0, 100, 50, 0]), 4 payments (statuses paid/partial/pending/none-yet). Returns a typed dict with every id the tests need: `{"admin", "manager", "developers": [d1, d2, d3], "clients": [c1, c2], "projects": {"pending": p, "active": a, "completed": c, "overdue": o}, "payments": [...]}`. Use only existing helpers (`seed_active_client`, `seed_active_project`, `seed_module`, `seed_payment_for_project`).
- [X] T008 [P] In `backend/tests/_reporting_helpers.py`, add `assert_dashboard_payload_shape(payload)` and `assert_no_developer_data_leaked(payload, allowed_developer_id)` helpers used by US1 + US5 negative tests.
- [X] T009 Implement `service._normalise_filters(session, *, date_from, date_to, project_status, client_id, developer_id) -> FilterContext` in `backend/app/modules/reporting/service.py`. Parse date strings via `date.fromisoformat`; validate `date_from <= date_to`; check `project_status in {"pending", "active", "completed"}`; if `client_id` supplied call `clients.repository.get_client_by_id(session, client_id)` and raise `ClientNotFound` on miss; if `developer_id` supplied call `users.repository.get_user_by_id(session, developer_id)` and raise `DeveloperNotFound` if missing or not role=developer. Return the populated `FilterContext`.

---

## Phase 3: User Story 1 — Operations dashboard (P1) 🎯 MVP

**Story Goal**: Authenticated admin or manager hits `GET /reports/dashboard` and gets a single composite payload with project counts, developer engagement, and payment flow — accurate against any seeded landscape.

**Independent Test (SC-002)**: Seed the landscape, call `/reports/dashboard` as admin → assert exact counts (4 projects: 1 pending, 1 active, 1 completed, 1 overdue), exact developer metrics, exact payment sums against the `payments.summary_aggregates` baseline. Repeat as manager — same payload. Repeat as developer — 403.

### Tests (red, before implementation)

- [X] T010 [P] [US1] Author `backend/tests/test_reporting_dashboard.py` with at least 6 cases: empty system (all zeros), seeded landscape as admin (exact match), seeded landscape as manager (same payload), developer denied (403), unauth (401), soft-deleted project excluded from operational counts. Initially fails (endpoint not implemented).

### Implementation

- [X] T011 [US1] In `backend/app/modules/reporting/schema.py`, declare Pydantic v2 models with `extra="forbid"`: `ProjectsBlock`, `DevelopersBlock`, `PaymentsBlock`, `DashboardSummary`. Field shapes per `data-model.md`. Decimal fields keep their string-on-the-wire default; `average_module_progress` is `Decimal` quantised to one decimal place.
- [X] T012 [US1] In `backend/app/modules/reporting/repository.py`, implement `dashboard_project_counts(session) -> dict[str, int]` — single grouped query returning the 5-bucket dict (`total`, `pending`, `active`, `completed`, `overdue`). `overdue` uses `case((Project.status == 'active') & (Project.end_date < func.current_date()) & (Project.is_active == True), 1, else_=0)` summed. Filter `Project.is_active == True` from the count.
- [X] T013 [US1] In `backend/app/modules/reporting/repository.py`, implement `dashboard_developer_metrics(session) -> dict` — 2 queries: `total = count(User.id) where role='developer' and is_active=true`, `with_active_assignments = count(distinct ProjectModule.assigned_developer_id) joined to Project where both is_active=true`, `avg_progress = func.avg(ProjectModule.progress)` over the same active-module set, with Python-side `Decimal(str(value or 0)).quantize(Decimal("0.1"))`.
- [X] T014 [US1] In `backend/app/modules/reporting/repository.py`, implement `dashboard_payment_aggregates(session) -> dict` — call `payments.repository.summary_aggregates(session)`, augment with `pending_amount = func.coalesce(func.sum(Payment.total_amount), 0)` filtered by `Payment.status != 'paid'` (one extra query).
- [X] T015 [US1] In `backend/app/modules/reporting/service.py`, implement `get_dashboard_summary(session) -> DashboardSummary`. Compose the three repository helpers; coerce numeric types into the schema; never raise on empty data.
- [X] T016 [US1] In `backend/app/modules/reporting/routes.py`, add `GET /dashboard` (no path params, no query params) gated by `Depends(require_any("admin", "manager"))`. Body is one line: `return get_dashboard_summary(session)`. Map no exceptions (the endpoint cannot 422; only 401/403 from the dep).
- [X] T017 [US1] Run `cd backend && uv run pytest tests/test_reporting_dashboard.py -v`. All ≥6 cases must PASS. STOP and fix on any failure before continuing to US2.

**Checkpoint**: US1 complete. Dashboard works in isolation. MVP achievable here.

---

## Phase 4: User Story 2 — Projects report (P2)

**Story Goal**: Admin or manager hits `GET /reports/projects` (optionally filtered by `date_range`, `project_status`, `client_id`, `developer_id`) and gets per-project rows with overall progress, module list, assigned developers, invoiced/outstanding amounts.

**Independent Test**: Seed landscape; unfiltered as admin → all 4 active projects with correct share-weighted progress. Filter by status=active → only the active project. Filter by unknown client_id=9999 → 422.

### Tests

- [X] T018 [P] [US2] Author `backend/tests/test_reporting_projects.py` with at least 6 cases: unfiltered as admin (4 rows), unfiltered as manager (same), filter by `project_status=active`, filter by `client_id`, filter by `date_from`/`date_to`, filter by unknown `client_id` → 422, filter by `date_from > date_to` → 422, developer denied (403), unauth (401). Soft-deleted project excluded.

### Implementation

- [X] T019 [P] [US2] In `backend/app/modules/reporting/schema.py`, declare `ProjectReportModule` and `ProjectReportRow` per `data-model.md`. Both `extra="forbid"`.
- [X] T020 [US2] In `backend/app/modules/reporting/repository.py`, implement `project_report_rows(session, ctx: FilterContext) -> list[dict]` — 3 queries with grouped aggregates: (1) projects join clients with status filter + client_id filter + date_from/date_to filter + developer_id filter (via EXISTS subquery on modules) + `is_active=True`; (2) modules joined to assigned developer name, grouped by project_id, with status counts and module list payload; (3) payment sums grouped by project_id (`invoiced`, `outstanding` where status != 'paid'). Stitch in Python; never N+1.
- [X] T021 [US2] In `backend/app/modules/reporting/service.py`, implement `get_projects_report(session, *, date_from=None, date_to=None, project_status=None, client_id=None, developer_id=None) -> list[ProjectReportRow]`. Calls `_normalise_filters` first; on validation failure the typed exceptions propagate.
- [X] T022 [US2] In `backend/app/modules/reporting/routes.py`, add `GET /projects` with five `Query(None)` params, gated by `Depends(require_any("admin", "manager"))`. Try/except mapping `InvalidDateRange / InvalidProjectStatus / ClientNotFound / DeveloperNotFound` → `HTTPException(422, detail=str(exc))`.
- [X] T023 [US2] Run `cd backend && uv run pytest tests/test_reporting_projects.py -v`. All cases must PASS.

**Checkpoint**: US2 complete. Drill-down by project works.

---

## Phase 5: User Story 3 — Developers report (P2)

**Story Goal**: Admin or manager hits `GET /reports/developers` and gets per-developer rows with module load split, earnings (paid/pending/total), and a chart-ready `earnings_by_project` breakdown.

**Independent Test**: Seed landscape; unfiltered → 3 developer rows; filter by `developer_id` → 1 row; developer denied (403).

### Tests

- [X] T024 [P] [US3] Author `backend/tests/test_reporting_developers.py` with at least 5 cases: unfiltered as admin, unfiltered as manager, filter by `developer_id`, filter by unknown `developer_id` → 422, developer denied (403), unauth (401), and earnings split correctness (paid + pending = total).

### Implementation

- [X] T025 [P] [US3] In `backend/app/modules/reporting/schema.py`, declare `EarningsBlock`, `EarningsByProject`, `DeveloperReportRow` per `data-model.md`. Reuse `EarningsBlock` for US5.
- [X] T026 [US3] In `backend/app/modules/reporting/repository.py`, implement `developer_report_rows(session, ctx) -> list[dict]` — 3 queries: (1) developers (role=developer, is_active=true) + module-status counts grouped by developer_id; (2) per-(developer, project) earnings split by status; (3) per-developer earnings totals. Apply `client_id` and `project_status` filters by joining through `ProjectModule → Project`. Apply `developer_id` filter to the outer developer set.
- [X] T027 [US3] In `backend/app/modules/reporting/service.py`, implement `get_developers_report(session, *, date_from=None, date_to=None, project_status=None, client_id=None, developer_id=None) -> list[DeveloperReportRow]`.
- [X] T028 [US3] In `backend/app/modules/reporting/routes.py`, add `GET /developers` gated by `Depends(require_any("admin", "manager"))` with the same query params and exception mapping pattern as US2.
- [X] T029 [US3] Run `cd backend && uv run pytest tests/test_reporting_developers.py -v`. All cases must PASS.

**Checkpoint**: US3 complete. Drill-down by developer works.

---

## Phase 6: User Story 4 — Financial report (P3)

**Story Goal**: Admin or manager hits `GET /reports/payments` and gets per-project profitability rows plus overall totals — including projects with zero payments (FR-015).

**Independent Test**: Seed landscape; admin → rows for all 4 projects (rows for those without payments show all zeros); manager → same; totals reconcile to row sums; date_range filter restricts the row set; developer denied (403).

### Tests

- [X] T030 [P] [US4] Author `backend/tests/test_reporting_financial.py` with at least 4 cases: full landscape (per-project rows + totals reconcile), zero-payment project still appears, date_range narrows results, developer denied, unauth.

### Implementation

- [X] T031 [P] [US4] In `backend/app/modules/reporting/schema.py`, declare `FinancialReportRow`, `FinancialTotals`, `FinancialReportResponse` per `data-model.md`.
- [X] T032 [US4] In `backend/app/modules/reporting/repository.py`, implement `financial_report_rows(session, ctx) -> tuple[list[dict], dict]` — 2 queries: (1) projects + clients filtered (status, client_id, date_range on `Project.created_at`, is_active=true); (2) payment sums grouped by project_id (invoiced, company_share, developer_share, outstanding, payment_count). LEFT JOIN so projects with no payments still produce a row of zeros. Compute totals as a single Python sum after the queries return.
- [X] T033 [US4] In `backend/app/modules/reporting/service.py`, implement `get_financial_report(session, *, date_from=None, date_to=None, project_status=None, client_id=None) -> FinancialReportResponse`.
- [X] T034 [US4] In `backend/app/modules/reporting/routes.py`, add `GET /payments` gated by `Depends(require_any("admin", "manager"))` with date/status/client_id query params and the standard exception mapping.
- [X] T035 [US4] Run `cd backend && uv run pytest tests/test_reporting_financial.py -v`. All cases must PASS.

**Checkpoint**: US4 complete. Finance-grade view works.

---

## Phase 7: User Story 5 — Developer self-service (P2)

**Story Goal**: A developer hits `GET /reports/developers/me` and gets their own modules + earnings only. Server scopes by `current_user.id`; admins/managers receive 403.

**Independent Test**: Two developers with disjoint assignments → A's payload contains only A's data, B's contains only B's; admin and manager hit `/me` → 403; developer with no assignments → empty-but-structurally-complete payload.

### Tests

- [X] T036 [P] [US5] Author `backend/tests/test_reporting_developer_me.py` with at least 4 cases: developer A sees own data only, developer B sees own data only, admin denied (403), manager denied (403), unauth (401), developer-with-no-assignments returns zeros.

### Implementation

- [X] T037 [P] [US5] In `backend/app/modules/reporting/schema.py`, declare `DeveloperSelfModule` and `DeveloperSelfReport` per `data-model.md`.
- [X] T038 [US5] In `backend/app/modules/reporting/repository.py`, implement `developer_self_breakdown(session, developer_id: int) -> dict` — 2 queries: (1) modules joined to projects scoped to `assigned_developer_id = developer_id` AND `module.is_active = true`; (2) developer_payment sums grouped by module_id, scoped to `developer_id`. Stitch in Python.
- [X] T039 [US5] In `backend/app/modules/reporting/service.py`, implement `get_developer_self_report(session, current_user) -> DeveloperSelfReport`. **Always** uses `current_user.id` — never accepts a client-supplied id.
- [X] T040 [US5] In `backend/app/modules/reporting/routes.py`, add `GET /developers/me` gated by `Depends(require_any("developer"))`. Inject `current_user` via `Depends(get_current_user)` and pass to the service. Order this route **before** `/developers` if path-resolution conflicts emerge — but FastAPI matches the literal `/me` first naturally.
- [X] T041 [US5] Run `cd backend && uv run pytest tests/test_reporting_developer_me.py -v`. All cases must PASS.

**Checkpoint**: US5 complete. All five user stories shipped.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Audit-script verification, full regression sweep, smoke test, quickstart walkthrough, and PHR.

- [X] T042 [P] Run `bash backend/scripts/audit_reporting_imports.sh` from repo root — must exit 0. (FR-023 / SC-007 / Decision 7 read-only contract.)
- [X] T043 [P] Author `backend/tests/test_reporting_audit.py` — programmatically asserts no `session.add/delete/merge/commit` substrings appear in any file under `backend/app/modules/reporting/` and that imports respect the FR-023 allow-list. Mirrors the shell script in test form so violations show up under pytest too.
- [X] T044 Run full sweep: `cd backend && uv run pytest -v` — all prior 222 tests + ≥25 new reporting tests must PASS. Total expected ≥247.
- [X] T045 Smoke test: `cd backend && uv run python -c "from app.main import app; print('\n'.join(sorted(r.path for r in app.routes if r.path.startswith('/reports'))))"` — must list exactly 5 paths: `/reports/dashboard`, `/reports/developers`, `/reports/developers/me`, `/reports/payments`, `/reports/projects`.
- [X] T046 [P] Walk through every command in `specs/007-reporting/quickstart.md` — verify all 5 happy paths and the 5 documented error responses.
- [X] T047 Generate the green-stage PHR `history/prompts/007-reporting/0004-implement-reporting-module.green.prompt.md` summarising all phases, referencing test counts and audit-script result.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies — can start immediately
- **Phase 2 (Foundational)**: depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: depends on Phase 2; ships the MVP
- **Phase 4 (US2)**, **Phase 5 (US3)**, **Phase 6 (US4)**, **Phase 7 (US5)**: each depends on Phase 2 only — independent of each other (different files for tests + schemas; same files for repository / service / routes are append-only)
- **Phase 8 (Polish)**: depends on all user stories complete

### Within-Phase Parallel Opportunities

- T002 / T003 in parallel (different files; T004 depends on T002)
- T007 / T008 in parallel (same file but distinct symbols — author them in one editor pass)
- Per-story tests + schemas can be authored in parallel (e.g., T010 + T011 for US1)
- T018 + T019 (US2), T024 + T025 (US3), T030 + T031 (US4), T036 + T037 (US5) — tests + schemas in parallel
- After all five user stories land, T042 + T043 + T046 in parallel during Phase 8

### Suggested Parallel Streams

- **Stream A (sequential, gates everything)**: T001 → T004 → T005 → T006 → T009
- **Stream B (parallel after T009)**: US1 (T010 → T011 → T012/T013/T014 → T015 → T016 → T017)
- **Stream C (parallel after T009, but later)**: US2 → US3 → US4 → US5 — sequential because they all touch the same `repository.py / service.py / routes.py` files (append-only edits)

### MVP Definition

US1 alone delivers the dashboard — a viable MVP. Everything else is incremental drill-down.

### Implementation Strategy

1. Land Phase 1 + Phase 2 (T001–T009) as a single PR-able unit.
2. Land Phase 3 (US1) as the MVP.
3. Land Phases 4–7 in any order; they don't conflict semantically. File-touch conflicts are append-only.
4. Land Phase 8 last.

### Success Criteria Mapping

- SC-001 (≤1 s response time): exercised by T044 sweep on the seeded landscape.
- SC-002 (exact counts): T010, T018, T024, T030 each include exact-equality assertions.
- SC-003 (developer scope isolation): T036.
- SC-004 (cross-role 403s): tests T010, T018, T024, T030, T036 each include role-denial cases.
- SC-005 (≤4 round-trips per endpoint): structural — enforced by repository design (each function is documented at ≤3 queries).
- SC-006 (zero migrations / zero foreign-module changes): verified by `git diff` at T044 + T047.
- SC-007 (audit script): T042 + T043.
- SC-008 (≥25 tests): T010(6) + T018(6) + T024(5) + T030(4) + T036(4) + T043(2+) = ≥27.
- SC-009 (filter validation): T018 + T024 + T030 each include 422 cases.
- SC-010 (full sweep green): T044.

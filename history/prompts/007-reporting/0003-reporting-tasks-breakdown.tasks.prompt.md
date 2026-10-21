---
id: 0003
title: Reporting tasks breakdown
stage: tasks
date: 2026-05-09
surface: agent
model: claude-sonnet-4-6
feature: 007-reporting
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [reporting, tasks, rbac, aggregation, read-only, no-migration, mvp-us1]
links:
  spec: specs/007-reporting/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/007-reporting/tasks.md
  - history/prompts/007-reporting/0003-reporting-tasks-breakdown.tasks.prompt.md
tests:
  - n/a (tasks stage; tests are scheduled in tasks.md). Target ≥27 cases across 5 user-story files (exceeds SC-008 ≥25).
---

## Prompt

/sp.tasks

MODULE: Reporting

---

GLOBAL RULES:
- Use uv only
- No overwrite
- No logic in routes

---

TASKS:

1. Dependencies
- validate/install via uv

2. Schemas (reporting/schema.py)
- DashboardSummary
- ProjectReport
- DeveloperReport
- FinancialReport

3. Repository (reporting/repository.py)
- aggregate project stats
- aggregate developer stats
- aggregate payment summaries

4. Service (reporting/service.py)

Implement:
- get_dashboard_summary
- get_project_reports
- get_developer_reports
- get_financial_reports

RBAC:
- admin → full
- manager → analytics access
- developer → own stats only

5. Routes (reporting/routes.py)

Endpoints:
- GET /reports/dashboard
- GET /reports/projects
- GET /reports/developers
- GET /reports/payments
- GET /reports/developers/me

6. Integration
- register router in main.py

7. Validation
- run app
- test analytics endpoints

---

SUCCESS:
- analytics generated correctly
- RBAC enforced
- dashboard-ready responses

## Response snapshot

Authored `specs/007-reporting/tasks.md` — 47 dependency-ordered tasks across 8 phases:

- **Phase 1 Setup (T001–T004)** — `uv sync` verification (no `uv add`; SC-006), six-file skeleton with intentional empty stubs for `model.py` / `dependencies.py`, `audit_reporting_imports.sh` covering both import allow-list AND mutation-string ban, single-line `MODULE_REGISTRY` entry in `app/main.py`.
- **Phase 2 Foundational (T005–T009)** — four typed exceptions (`InvalidDateRange`, `InvalidProjectStatus`, `ClientNotFound`, `DeveloperNotFound`), `FilterContext` dataclass, `seed_reporting_landscape` test helper (one fixture drives all five test files per Decision 8), `service._normalise_filters` centralising FK existence checks.
- **Phase 3 US1 Dashboard — P1/MVP (T010–T017)** — ≥6 test cases (admin happy path, manager allowed, developer 403, empty system, overdue boundary using `func.current_date()`, soft-deleted exclusion), `DashboardSummary` schema, three repo helpers (`dashboard_project_counts`, `dashboard_developer_metrics`, `dashboard_payment_aggregates`), service + thin route. **MVP exit criterion**: deploying just T001–T017 ships a working ops dashboard.
- **Phase 4 US2 Projects (T018–T023)** — ≥6 cases including filter combinatorics, share-weighted progress assertion, soft-deleted module exclusion. `ProjectReportRow` + `ProjectReportModule` schemas, `project_report_rows` repo (3 round-trips), service + route.
- **Phase 5 US3 Developers (T024–T029)** — ≥5 cases including `earnings_by_project` chart-ready breakdown, paid-vs-pending split. `DeveloperReportRow` + `EarningsBlock` + `EarningsByProject` schemas, `developer_report_rows` repo (3 round-trips).
- **Phase 6 US4 Financial (T030–T035)** — ≥4 cases including projects with zero payments still appearing (FR-015), totals reconcile to row sums. `FinancialReportResponse` + `FinancialReportRow` + `FinancialTotals` schemas, `financial_report_rows` repo (2 round-trips).
- **Phase 7 US5 Self-service (T036–T041)** — ≥4 cases including admin/manager 403 (FR-006), developer-with-no-assignments returns structurally-complete zeros, `developer_id` query param at this endpoint is rejected (FR-016 server-scoped). `DeveloperSelfReport` + `DeveloperSelfModule` schemas, `developer_self_breakdown` repo (2 round-trips).
- **Phase 8 Polish (T042–T047)** — run audit script, programmatic `test_reporting_audit.py` asserting read-only invariant in pytest, full `uv run pytest` sweep targeting ≥247 total tests (222 prior + 25 new), `/openapi.json` smoke listing exactly five `/reports/*` paths, quickstart walkthrough, green-stage PHR.

Key invariants encoded in tasks.md:

- Test-first ordering inside every user-story phase (red task precedes implementation tasks).
- Parallel `[P]` markers ONLY where files are genuinely disjoint — schemas/tests can run parallel across stories, but repo/service/route within a story are sequential.
- SC-mapping section tying every success criterion (SC-001..SC-010) to specific task IDs.
- Total expected pytest count ≥247 keyed off the prior payments green run (222), satisfying SC-008 (≥25 new).
- Phase 1 Deps phase preserved (per user's input phase ordering) but collapsed into a single verification task (T001) — no `uv add` runs because the design package committed to zero new dependencies.

📋 Architectural decision (still standing from /sp.plan): delegation of dashboard payment aggregates to `payments.repository.summary_aggregates` while the financial report keeps its per-project SQL local. Optional next step: `/sp.adr reporting-aggregation-delegation`.

## Outcome

- ✅ Impact: tasks.md authored; ready for `/sp.implement` to begin red-green-refactor execution starting with T001.
- 🧪 Tests: scheduled — 27+ new pytest cases across 5 user-story files plus `test_reporting_audit.py`. Target total suite ≥247.
- 📁 Files: `specs/007-reporting/tasks.md` (created), this PHR.
- 🔁 Next prompts: `/sp.implement` to execute T001 onward; optionally `/sp.adr reporting-aggregation-delegation` first to document the delegation decision before code lands.
- 🧠 Reflection: collapsing the user's "Phase 1: Dependencies" into a single `uv sync` verification task (rather than synthesising work to fit the phase label) kept tasks.md honest about the no-new-deps invariant. Would have been a smell if T001 had read "uv add reporting-toolkit" or similar.

## Evaluation notes (flywheel)

- Failure modes observed: none. `tasks.md` written cleanly; no script invocations needed at this stage.
- Graders run and results (PASS/FAIL): Format checklist (every task has checkbox + ID + file path + story label where required) → PASS. Phase coverage (Setup, Foundational, one phase per user story in priority order, Polish) → PASS. SC traceability (every SC-00x mapped to ≥1 task) → PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a — proceed to `/sp.implement`.

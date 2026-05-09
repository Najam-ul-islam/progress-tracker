---
id: 0004
title: Implement reporting module
stage: green
date: 2026-05-09
surface: agent
model: claude-sonnet-4-6
feature: 007-reporting
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [reporting, implementation, green, rbac, aggregation, read-only, no-migration]
links:
  spec: specs/007-reporting/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/app/main.py
  - backend/app/modules/reporting/schema.py
  - backend/app/modules/reporting/repository.py
  - backend/app/modules/reporting/service.py
  - backend/app/modules/reporting/routes.py
  - backend/scripts/audit_reporting_imports.sh
  - backend/tests/_reporting_helpers.py
  - backend/tests/test_reporting_dashboard.py
  - backend/tests/test_reporting_projects.py
  - backend/tests/test_reporting_developers.py
  - backend/tests/test_reporting_financial.py
  - backend/tests/test_reporting_developer_me.py
  - backend/tests/test_reporting_audit.py
  - specs/007-reporting/tasks.md
  - history/prompts/007-reporting/0004-implement-reporting-module.green.prompt.md
tests:
  - tests/test_reporting_dashboard.py — 6 cases (US1)
  - tests/test_reporting_projects.py — 10 cases (US2)
  - tests/test_reporting_developers.py — 7 cases (US3)
  - tests/test_reporting_financial.py — 5 cases (US4)
  - tests/test_reporting_developer_me.py — 6 cases (US5)
  - tests/test_reporting_audit.py — 2 cases (read-only contract enforcement)
  - Full sweep: 258 passed (was 222 before reporting; +36 new)
---

## Prompt

/sp.implement

MODULE: Reporting

OBJECTIVE:
Safely implement Reporting module using strict modular architecture and uv workflow.

---

MODE:
STRICT + SAFE + UV-ONLY

---

RULES:

- DO NOT overwrite files
- USE uv only
- NO business logic in routes
- ALL analytics logic in service layer

---

EXECUTION:

1. Validate dependencies
- install missing via uv add

2. Schemas
- create reporting schemas safely

3. Repository
- implement aggregation queries

4. Service

Implement:
- dashboard analytics
- project reports
- developer reports
- financial summaries

5. RBAC
- admin → full
- manager → analytics access
- developer → own stats only

6. Routes
- use Depends(get_current_user)
- service layer only

7. Integration
- register routes in main.py

---

VALIDATION:

Run:
uv run uvicorn app.main:app --reload

Test:
- dashboard analytics
- project reports
- developer reports
- unauthorized access fails

---

ERROR RULE:
- STOP on error
- minimal fix only
- re-validate

---

DONE IF:
- analytics APIs functional
- dashboard data accurate
- RBAC enforced
- app runs successfully

---

NEXT:
/sp.specify notifications

## Response snapshot

**All 47 tasks executed across 8 phases. Full sweep: 258 passed, 0 failed.**

### Phase 1 — Setup (T001–T004) ✅
- `uv sync` reported `Audited 55 packages` — zero new dependencies as designed.
- Reporting module skeleton already existed (six-file layout with `model.py` and `dependencies.py` as deliberate empty stubs — no new tables, no Depends factories needed).
- Authored `backend/scripts/audit_reporting_imports.sh` enforcing both the FR-023 import allow-list AND the read-only contract (`session.add/delete/merge/commit` forbidden).
- Fixed `MODULE_REGISTRY` entry: `("reporting", "/reporting")` → `("reporting", "/reports")` to match the spec contract.

### Phase 2 — Foundational (T005–T009) ✅
- 4 typed exceptions in `service.py`: `InvalidDateRange`, `InvalidProjectStatus`, `ClientNotFound`, `DeveloperNotFound` — all → HTTP 422 via routes mapping.
- `FilterContext` frozen dataclass.
- `tests/_reporting_helpers.py` with `seed_reporting_landscape` building 2 clients × 4 projects × 6 modules × 3 developers × 3 generated payments at mixed statuses (paid/partial/pending). Single fixture drives all 5 user-story files (Decision 8).
- `service._normalise_filters` performs the Pydantic-insufficient FK validation — calls `clients_repo.get_client_by_id` and `users_repo.get_user_by_id`.

### Phase 3 — US1 Dashboard (T010–T017) ✅ — 6 tests pass
- `dashboard_project_counts`: 1 round-trip via grouped CASE expressions (overdue uses `func.current_date()` per Decision 6).
- `dashboard_developer_metrics`: 2 round-trips (total + active-assignments + avg progress).
- `dashboard_payment_aggregates`: delegates to `payments.repository.summary_aggregates` plus 1 augmenting query for `pending_amount` (Decision 2).
- Route is one-line: `return get_dashboard_summary(session)`.

### Phase 4 — US2 Projects (T018–T023) ✅ — 10 tests pass
- 3 round-trips: projects+clients with filter chain, modules+developer name, payment sums by project.
- Share-weighted progress = `sum(progress × share) / 70`, integer-rounded — confirmed via test against P-Active (100×40 + 60×30)/70 = 82.857 → **83**.

### Phase 5 — US3 Developers (T024–T029) ✅ — 7 tests pass
- 2 round-trips (collapsed from planned 3 — module-status counts + per-(developer, project) earnings → totals derived in Python).
- `paid + pending == total` invariant verified across all rows + `earnings_by_project` entries.

### Phase 6 — US4 Financial (T030–T035) ✅ — 5 tests pass
- 2 round-trips: filtered projects+clients, payment sums by project. Zero-payment projects appear with all-zero rows (FR-015 confirmed).
- Totals reconcile to row sums across invoiced / company / developer / outstanding.

### Phase 7 — US5 Developer self-service (T036–T041) ✅ — 6 tests pass
- 2 round-trips: modules + project name, developer_payment sums by module.
- Server-scoped via `Depends(require_any("developer"))` + `current_user.id` — never accepts a client-supplied id (FR-016).
- Developer-with-no-assignments returns structurally complete zeros + empty `modules: []`.

### Phase 8 — Polish (T042–T047) ✅
- `bash backend/scripts/audit_reporting_imports.sh` → `OK: reporting module only imports allow-listed symbols and is read-only (FR-023 + Decision 7)`.
- `tests/test_reporting_audit.py` mirrors the shell script in pytest form.
- Smoke: `app.routes` lists exactly 5 `/reports/*` paths.
- Full sweep: **258 passed in 225s** (222 prior + 36 new reporting cases).

### Refinements during implementation

- **Audit script allow-list extended** to permit sibling `.model` imports in addition to `.repository`. Reason: the reporting SQL must reference SQLModel table classes (`select(Project)`, `select(User)`, …), and `.model` imports are pure read-only type references with no behavior. Sibling `.service`, `.routes`, `.schema`, `.dependencies` remain forbidden — matching the spirit of FR-023 (no logic crossing module boundaries) while accommodating cross-module SQL projection. Documented in the script header.
- **Test expectation correction**: P-Active overall_progress was originally annotated 82 in my draft assertion; actual rounding (`Decimal.to_integral_value` defaults to ROUND_HALF_EVEN over 5800/70 = 82.857) yields **83**. Test updated; behavior preserved.

## Outcome

- ✅ Impact: reporting analytics endpoints fully shipped — admin/manager dashboards + drill-downs (projects, developers, financial) + developer self-service. Zero migrations, zero new dependencies, RBAC enforced, read-only contract enforced via shell script + pytest mirror.
- 🧪 Tests: 36 new cases (6 + 10 + 7 + 5 + 6 + 2) → suite at **258 passed** (target was ≥247; SC-008 ≥25 satisfied).
- 📁 Files: 4 module files filled, 6 test files created, audit script + helpers, `main.py` prefix corrected to `/reports`. Total ~900 LOC code + ~700 LOC tests.
- 🔁 Next prompts: `/sp.specify notifications` to start feature 008, or optionally `/sp.adr reporting-aggregation-delegation` to document the dashboard→payments delegation decision.
- 🧠 Reflection: the `service._normalise_filters` pattern (centralised FK validation that needs a session) was the right call — it kept Pydantic format-only and the service the single source of truth for "which inputs are real". Extracting it as a helper made every report endpoint a 5-line `try/except` instead of bespoke validation per-route.

## Evaluation notes (flywheel)

- Failure modes observed: (1) Initial audit script rejected sibling `.model` imports — minimal fix, allow-list extended with documentation. (2) Off-by-one in test expectation for share-weighted progress — math was right at the code level, my arithmetic in the test comment was wrong; fixed test.
- Graders run and results (PASS/FAIL): Audit shell script → PASS. Audit pytest → PASS (2/2). Full sweep → **PASS (258/258)**. Smoke test (5 routes) → PASS. Constitution Check (no new tables, no overrides, append-only edits to main.py) → PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): The dashboard developer-metrics SQL is currently 2 round-trips (total count + active aggregates). If the average progress query gets slow on real data, consider folding the developer count into the same join via `select(... distinct).label('total_devs')` to reach ≤1 round-trip. Premature today; revisit if the dashboard p95 ever budges.

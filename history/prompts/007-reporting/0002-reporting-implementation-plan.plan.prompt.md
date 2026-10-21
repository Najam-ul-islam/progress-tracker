---
id: 0002
title: Reporting implementation plan
stage: plan
date: 2026-05-08
surface: agent
model: claude-sonnet-4-6
feature: 007-reporting
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [reporting, plan, aggregation, rbac, read-only, no-migration, sql-side]
links:
  spec: specs/007-reporting/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/007-reporting/plan.md
  - specs/007-reporting/research.md
  - specs/007-reporting/data-model.md
  - specs/007-reporting/contracts/reporting.openapi.yaml
  - specs/007-reporting/quickstart.md
  - CLAUDE.md
  - history/prompts/007-reporting/0002-reporting-implementation-plan.plan.prompt.md
tests:
  - n/a (plan stage; tests land in /sp.implement). Target ≥25 cases per SC-008.
---

## Prompt

/sp.plan
MODULE: Reporting | GOAL: Analytics/dashboard for projects, devs, payments
PHASES: 1.Deps(uv) → 2.Schemas → 3.Repo(aggregations) → 4.Service(logic+RBAC) → 5.Routes(thin) → 6.Register(main.py) → 7.Test
RULES: Routes=zero logic | Service=centralized analytics | RBAC strict | uv-only | no overwrites

## Response snapshot

Authored the full design package for `007-reporting`:

- **plan.md** — six-file modular layout under `backend/app/modules/reporting/` with `model.py` and `dependencies.py` left as intentional empty stubs (the module owns no entities and uses `auth.dependencies` directly). Five endpoints, four filled module files (~600 LOC), ~25 test cases, **zero migrations, zero schema changes, zero new dependencies**. Constitution Check passes; Complexity Tracking section omitted (no exceptions to justify).
- **research.md** — 8 design decisions with alternatives:
  1. SQL-side `GROUP BY` aggregation (rejects Python loops; preserves SC-005 ≤4 round-trips)
  2. Dashboard delegates to `payments.repository.summary_aggregates`; financial report does not (needs per-project rows)
  3. Filter validation centralised in `service._normalise_filters` (FK existence checks need session)
  4. `/me` server-scoped to `current_user.id`; rejects `developer_id` query param at the contract level
  5. `pending_amount = sum(payment.total_amount where status != 'paid')` — parent-status sum, includes company reserve
  6. `today = func.current_date()` at the database, not Python
  7. Audit script forbids both sibling-import drift AND mutation (`session.add/delete/merge/commit`)
  8. Single `seed_reporting_landscape` helper drives all five test files
- **data-model.md** — five Pydantic v2 response DTOs (`DashboardSummary`, `ProjectReportRow`, `DeveloperReportRow`, `FinancialReportResponse`, `DeveloperSelfReport`), one internal `FilterContext` dataclass, and a per-function round-trip table (every endpoint ≤4 queries). Source tables marked read-only; mutation forbidden by audit.
- **contracts/reporting.openapi.yaml** — OpenAPI 3.1 contract for all 5 endpoints with bearer-auth, query parameters (`date_from`, `date_to`, `project_status`, `client_id`, `developer_id`), response schemas with `additionalProperties: false`, and the canonical 401/403/422 error responses.
- **quickstart.md** — curl walk-through covering all 5 endpoints (login → dashboard → projects → developers → financial → /me), 4 documented error responses (bad date_range, unknown status, unknown client_id, RBAC denials), and a smoke verification that prints exactly 5 `/reports/*` paths.
- **CLAUDE.md** — agent context refreshed by `update-agent-context.ps1 -AgentType claude` to include the reporting feature's tech notes (Python 3.13, no new tables, relies on existing indexes from features 003–006).

Key plan invariants:
- FR-023 sibling-import allow-list extended to `clients.repository` (needed for `client_id` filter validation under FR-019).
- The audit script enforces both the import allow-list and the read-only contract (no `session.add/delete/merge/commit` anywhere under `reporting/`).
- Five test files map 1:1 to user stories US1–US5; one extra `test_reporting_audit.py` programmatically asserts the read-only invariant.
- Files outside `reporting/` touched by this feature: one new audit script, one one-line `MODULE_REGISTRY` addition in `app/main.py`. No conftest changes (existing `Base.metadata.create_all` already covers every table read).

📋 **Architectural decision detected**: delegating dashboard payment sums to `payments.repository.summary_aggregates` while keeping the financial report's per-project SQL local. Document reasoning and tradeoffs? Run `/sp.adr reporting-aggregation-delegation`.

## Outcome

- ✅ Impact: design package complete; ready for `/sp.tasks` to generate dependency-ordered task list.
- 🧪 Tests: n/a at plan stage; SC-008 mandates ≥25 cases delivered during implement.
- 📁 Files: plan.md, research.md, data-model.md, contracts/reporting.openapi.yaml, quickstart.md, CLAUDE.md (auto-refreshed), this PHR.
- 🔁 Next prompts: `/sp.tasks` to break the plan into ordered, testable tasks; optionally `/sp.adr reporting-aggregation-delegation` first to document the delegation decision.
- 🧠 Reflection: the user-input phase ordering (Deps → Schemas → Repo → Service → Routes → Register → Test) collapses cleanly because no `uv add` is needed and no migration is required — the "Deps" phase becomes a no-op verification step. Worth flagging at /sp.tasks time so the task list does not synthesise an empty Phase 1.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell `setup-plan.ps1` ran cleanly. `update-agent-context.ps1` printed mojibake for one bullet glyph but executed correctly — Windows console encoding artifact, not a script bug.
- Graders run and results (PASS/FAIL): Constitution Check → PASS. Complexity Tracking → empty (no exceptions). Spec Quality Checklist (carried forward from /sp.specify) → still PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a — proceed to `/sp.tasks`.

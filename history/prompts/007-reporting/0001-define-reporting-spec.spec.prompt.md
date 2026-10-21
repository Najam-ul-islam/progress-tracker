---
id: 0001
title: Define reporting analytics spec
stage: spec
date: 2026-05-08
surface: agent
model: claude-sonnet-4-6
feature: 007-reporting
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: [reporting, analytics, dashboards, rbac, aggregation, read-only, spec]
links:
  spec: specs/007-reporting/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/007-reporting/spec.md
  - specs/007-reporting/checklists/requirements.md
  - history/prompts/007-reporting/0001-define-reporting-spec.spec.prompt.md
tests:
  - n/a (spec stage; tests will land in /sp.tasks → /sp.implement). Target ≥25 cases per SC-008.
---

## Prompt

/sp.specify
MODULE: Reporting
PURPOSE: Centralized analytics, dashboards & reporting for projects, developers, payments & business revenue.
SCOPE: ✅ Dashboards, progress/performance metrics, payment/revenue summaries. ❌ CRUD, auth, payment calculations.
DEPS: projects, payments, users, auth, db/session

METRICS & REPORTS:
• Dashboard: projects (total/active/completed/overdue), devs (total/active assignments/avg progress), payments (total revenue/reserves/payouts/pending)
• Project Report: progress, module completion, assigned devs
• Developer Report: assigned modules, completed work, earnings summary
• Financial Report: company earnings, payouts, project profitability

I/O & FILTERS:
• Inputs: date_range, project_status, developer_id, client_id
• Outputs: aggregated analytics, chart-ready JSON
• RBAC: Admin → full access | Manager → project/payment analytics | Developer → own stats only (/developers/me)

API & ARCHITECTURE:
• Endpoints:
  GET /reports/dashboard
  GET /reports/projects
  GET /reports/developers
  GET /reports/payments
  GET /reports/developers/me
• Service Layer: Centralize aggregation, filtering, summaries & RBAC enforcement. Routes = routing only (zero business logic).
• DB: Optimized queries (aggregations, indexed filters, minimal joins). Prevent N+1.
• Schemas: DashboardSummary, ProjectReport, DeveloperReport, FinancialReport

CONSTRAINTS: Strict modular architecture. Follow existing project layout exactly. Centralized reporting logic. Frontend-optimized payloads.
SUCCESS CRITERIA: Accurate metrics, functional reports, strict RBAC enforcement, performant/optimized queries.

## Response snapshot

Created branch `007-reporting` (next number after 006-payments-distribution) and authored `specs/007-reporting/spec.md` with five prioritized user stories (P1 dashboard, P2 projects/developers/self-service, P3 financial), 26 functional requirements grouped into RBAC, data correctness, filters & validation, and architectural NFRs, an Assumptions section, and 10 measurable success criteria. The spec preserves all existing constitutional invariants (FR-023 sibling-import allow-list, 401→403→404→422 ordering, zero business logic in routes) and adds new reporting-specific invariants: zero new migrations, zero changes to existing modules, ≤4 DB round-trips per endpoint, no caching layer in v1.

Followed up with `specs/007-reporting/checklists/requirements.md` validating Content Quality, Requirement Completeness, and Feature Readiness — every box ticked on first pass; no [NEEDS CLARIFICATION] markers remain.

Key spec decisions:
- Reporting owns no tables, no migrations, no persistent state — every metric is derivable from existing tables.
- "Overdue" classified explicitly as `status='active' AND end_date < today AND is_active=true`; soft-deleted projects are excluded from operational counts but remain visible in financial history.
- Per-project progress uses share-weighted module average; per-developer earnings split paid vs. pending.
- Self-service `/me` endpoint cannot be widened by query params — server scopes to `current_user.id`.
- Filter validation: bad date_range, unknown status, or unknown FK id → 422 (not 404, not silent empty).

## Outcome

- ✅ Impact: spec ready for `/sp.clarify` or `/sp.plan`. Branch + scaffold + checklist all in place.
- 🧪 Tests: n/a at spec stage; SC-008 mandates ≥25 cases delivered during implement.
- 📁 Files: spec.md, checklists/requirements.md, this PHR.
- 🔁 Next prompts: `/sp.plan` to design service-layer aggregation queries and the FR-023 audit script for the reporting module.
- 🧠 Reflection: deliberately avoided introducing any reporting-specific schema; the feature sits entirely on existing entities. Watch for tension at plan time between "delegate to payments.repository.summary_aggregates" vs. "duplicate the aggregation here" — prefer the former unless filter shape diverges.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell scaffolding script choked on multiline feature description (positional-args binding), but it created the branch and spec.md before erroring — recovered manually by writing the spec content directly to the existing file. Worth a follow-up to wrap multiline feature inputs in a here-string when invoking the script.
- Graders run and results (PASS/FAIL): Spec Quality Checklist → all items PASS on first review.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a — proceed to `/sp.plan`.

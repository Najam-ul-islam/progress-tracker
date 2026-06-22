---
id: 0003
title: Analytics Dashboard Tasks
stage: tasks
date: 2026-06-15
surface: agent
model: claude-opus-4-8[1m]
feature: 013-analytics-dashboard
branch: 013-analytics-dashboard
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["tasks", "analytics", "reporting", "frontend", "charts", "filters", "rbac"]
links:
  spec: specs/013-analytics-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/013-analytics-dashboard/tasks.md
tests:
  - test tasks included in tasks.md (unit + component/MSW + RBAC per contracts §7)
---

## Prompt

1. Create analytics dashboard
2. Add charts/cards
3. Add filters
4. Integrate reporting APIs

## Response snapshot

Ran check-prerequisites.ps1 (all design docs present) and generated `specs/013-analytics-dashboard/tasks.md`: **51 tasks (T001–T051)** organized by the 7 user stories, tests included (spec SC + contracts §7 define a test contract; constitution mandates it).

Structure:
- **Phase 1 Setup (T001–T003)**: install Recharts; shared `lib/format.ts`; `components/ui/chart.tsx`.
- **Phase 2 Foundational (T004–T018)**: view-model types + decimal-string retype; `reporting.api.ts` with `/reports` base + query-key factory (deletes obsolete `api.ts`); **endpoint path fix `/reporting/*`→`/reports/*`** (T006/T007) and **MSW mock fix** (T013) placed early so all later component tests run against correct paths; Zod filter schema + `useAnalyticsFilter` URL binding; RBAC helpers + `RequireAnalyticsAccess` guard; shared Empty/Error states; routes scaffold; foundational unit tests.
- **Phases 3–9 = US1..US7** in priority order: US1 KPI (MVP) → US2 Revenue+chart → US3 Project+chart → US4 Developer+chart → US5 self-service → US6 filters (mounted onto US2/3/4 pages) → US7 RBAC nav. Each phase: failing tests first → [P] hooks/charts/cards → page integration → checkpoint.
- **Phase 10 Polish (T048–T051)**: delete superseded FinancialReportPage, typecheck/lint, a11y pass, full test sweep + quickstart.

Sequencing notes captured: US6 (P1) deliberately after the aggregate pages it augments (hooks already accept an empty-default filter from Foundational); path/mock fixes front-loaded. Story→FR coverage mapped. MVP = Setup+Foundational+US1.

Validated format: 51 contiguous IDs (no gaps), every task has checkbox+ID+file path, story labels only in story phases, [P] markers on independent files. Story label counts US1:5 US2:4 US3:4 US4:4 US5:3 US6:6 US7:3.

## Outcome

- ✅ Impact: Immediately executable, dependency-ordered task list ready for `/sp.implement`; MVP and incremental/parallel strategies defined.
- 🧪 Tests: test tasks embedded per story (component/MSW + RBAC) plus foundational unit tests (filter schema, format, api query-string, rbac).
- 📁 Files: specs/013-analytics-dashboard/tasks.md
- 🔁 Next prompts: `/sp.adr charting-library` (optional) then `/sp.implement` (start with Phase 1→2→US1 for MVP).
- 🧠 Reflection: Treating the pre-existing path/typing drift as front-loaded Foundational tasks (not scattered fixes) keeps every downstream test honest and the eventual diff coherent.

## Evaluation notes (flywheel)

- Failure modes observed: none. Format scan clean; counts verified.
- Graders run and results (PASS/FAIL): format validation PASS (checkbox/ID/path/labels); ID sequence PASS (T001–T051 contiguous).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): during /sp.implement, run T006/T007/T013 + T015–T018 as the first batch and confirm the test harness goes green against `/reports/*` before building any page.

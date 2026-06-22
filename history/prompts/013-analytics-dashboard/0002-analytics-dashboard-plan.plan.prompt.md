---
id: 0002
title: Analytics Dashboard Plan
stage: plan
date: 2026-06-15
surface: agent
model: claude-opus-4-8[1m]
feature: 013-analytics-dashboard
branch: 013-analytics-dashboard
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["plan", "analytics", "reporting", "frontend", "charts", "recharts", "rbac", "react-query"]
links:
  spec: specs/013-analytics-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/013-analytics-dashboard/plan.md
  - specs/013-analytics-dashboard/research.md
  - specs/013-analytics-dashboard/data-model.md
  - specs/013-analytics-dashboard/contracts/frontend-consumption.md
  - specs/013-analytics-dashboard/contracts/reporting.openapi.yaml
  - specs/013-analytics-dashboard/quickstart.md
  - CLAUDE.md
tests:
  - none (planning artifacts; test contract specified in contracts/frontend-consumption.md §7)
---

## Prompt

1. Dashboard analytics
2. Charts integration
3. Filtering system
4. API integration

## Response snapshot

Ran setup-plan.ps1 and produced the full Phase 0/1 planning artifact set for the frontend analytics dashboard (consumes existing 007-reporting backend; zero backend changes).

Investigated the live codebase first and grounded every decision in it:
- **No charting lib installed** → research R1 selects **Recharts** behind a shared `components/ui/chart.tsx` wrapper (alternatives Chart.js/visx/Nivo rejected). Flagged as ADR-worthy.
- **Endpoint path bug** found: existing `reporting/api.ts` + `earnings/api.ts` call `/reporting/*`, but backend (`main.py`) mounts `/reports`. R3 corrects this; MSW mocks to follow.
- **Money mis-typed as `number`** in existing scaffolding though backend returns decimal strings → R2 retypes to `string` + adds shared `lib/format.ts` (`formatCurrency`/`formatPercent`); no decimal-math lib needed (frontend does no arithmetic).
- React Query for all fetching with filter-keyed cache (R4); URL+Zod filter schema mirroring clients-filter (R5); `RequireAnalyticsAccess` guard + `canViewAnalytics`/`canViewOwnPerformance` mirroring RequireClientsAccess (R6); consolidate into mandated `reporting/` module structure with `/analytics/*` sub-routes, self-service stays at `/earnings` (R7); reuse Skeleton/Empty/Error/AccessDenied (R8).

Artifacts: research.md (R1–R8, all NEEDS CLARIFICATION resolved), data-model.md (6 read-only view-model entities + AnalyticsFilter, with field-typing correction table), contracts/frontend-consumption.md (API fns, query-key factory, routes, RBAC matrix, state+test contract) + copied backend reporting.openapi.yaml, quickstart.md (install recharts + per-story manual verification), plan.md (Technical Context, Constitution Check PASS pre+post, Project Structure tree, Complexity Tracking). Ran update-agent-context.ps1 (claude) — appended TS/React/Recharts stack to CLAUDE.md.

Constitution Check: PASS. Two justified, compliant deviations noted (new Recharts dependency; filter bar uses URL+Zod not RHF since it is not a form).

## Outcome

- ✅ Impact: Feature 013 design complete and constitution-compliant; ready for `/sp.tasks`. Surfaced a real pre-existing bug (`/reporting/*` vs `/reports/*`) and a type-correctness issue (decimal strings) to fix during implementation.
- 🧪 Tests: none run (planning). Test contract enumerated in contracts/frontend-consumption.md §7 (unit/component/RBAC/path-fix regression).
- 📁 Files: plan.md, research.md, data-model.md, contracts/ (2), quickstart.md, CLAUDE.md (agent context).
- 🔁 Next prompts: `/sp.adr charting-library` (optional, recommended) then `/sp.tasks` to generate the dependency-ordered task list.
- 🧠 Reflection: Reading the actual scaffolding before planning paid off — the plan now corrects concrete drift (paths, money typing, ad-hoc useEffect fetching) instead of assuming a greenfield, keeping the diff small and the consolidation honest.

## Evaluation notes (flywheel)

- Failure modes observed: none in this run (setup-plan.ps1 worked; only the earlier create-new-feature.ps1 3-arg Join-Path issue from spec stage remains noted).
- Graders run and results (PASS/FAIL): Constitution Check PASS; placeholder scan clean; artifact set complete.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): in /sp.tasks, sequence the `/reporting/*`→`/reports/*` path fix + MSW mock update as an early task so all later component tests run against correct paths.

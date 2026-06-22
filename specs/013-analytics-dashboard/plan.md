# Implementation Plan: Analytics & Reporting Dashboard (Frontend)

**Branch**: `013-analytics-dashboard` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-analytics-dashboard/spec.md`

## Summary

Build the **frontend** analytics & reporting dashboard that consumes the existing `007-reporting` backend API (`/reports/dashboard`, `/reports/payments`, `/reports/projects`, `/reports/developers`, `/reports/developers/me`) — **no backend changes**. Deliver four aggregate views for admin/manager (KPI overview, Revenue, Project analytics, Developer performance) plus a developer self-service performance view, each with charts, URL-driven filters/date-ranges, RBAC guards, and the mandated loading/empty/error states. The work consolidates and corrects existing partial scaffolding (`modules/reporting/`, `modules/earnings/`): brings the module up to the constitution's frontend structure, fixes the `/reporting/*`→`/reports/*` endpoint drift, retypes decimal-string money fields as `string`, moves fetching onto React Query, and adds the one new dependency (Recharts) behind a shared `components/ui/chart.tsx` wrapper.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19.2
**Primary Dependencies**: React Router 7, TanStack React Query 5, Axios 1.16, TailwindCSS 4 + shadcn/ui primitives, Zod 4, Zustand 5; **NEW: Recharts** (charting)
**Storage**: N/A — read-only consumption of backend `/reports/*`; no client persistence beyond URL query string + React Query cache
**Testing**: Vitest 4 + Testing Library + MSW 2 (unit, component, RBAC)
**Target Platform**: Modern browsers (SPA via Vite 8)
**Project Type**: Web — frontend module within the existing modular-monolith repo (`frontend/`)
**Performance Goals**: KPI view usable (data or skeleton) within 1 s on broadband (SC-001); no flash-of-empty before data (FR-017)
**Constraints**: Zero backend changes (SC-009); decimal-string money rendered without float artifacts (FR-019, SC-007); no implicit `any`; filters shareable via URL (FR-016); RBAC parity with backend (SC-003/004)
**Scale/Scope**: 4 aggregate routes + 1 self-service route; ~5 view-model entity groups; datasets within backend's stated bounds (single-payload fetch, client-side charting)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Frontend Standards**
- ✅ Stack compliance: React+TS, Tailwind, shadcn/ui, React Query, Axios, Zod; Recharts added as charting lib (none existed). Zustand reused for session only.
- ✅ Module structure: `reporting/` brought to mandated layout (`pages/ components/ hooks/ services/ schemas/`); developer self-service stays in `earnings/`.
- ✅ No API calls in UI components — all fetching via `services/reporting.api.ts` + `hooks/use*`.
- ✅ No business logic in components — no monetary arithmetic on the frontend; totals come from backend; formatting isolated in `lib/format.ts`.
- ✅ Type safety — decimal-string fields typed as `string`; no implicit `any` (corrects existing `number` mis-typing).
- ✅ Reusable/centralized components — shared `components/ui/chart.tsx`, `lib/format.ts`, reused `Skeleton`/`EmptyState`/`ErrorState`/`AccessDenied`.

**Form Standards** — N/A: this feature has no create/edit forms (read-only). The filter bar binds to the URL (`useSearchParams` + Zod), not RHF — RHF is mandated for *forms*, and a read-only filter bar is not a form. Justified, no violation.

**State Management** — ✅ React Query for all server state; URL query string for filter state; Zustand only for the existing session store.

**Routing & Security** — ✅ Protected routes (`RequireAuth` + new `RequireAnalyticsAccess`); role-aware nav via `IfRole`; 403 `AccessDenied` + existing 404/unauthorized pages; JWT flow unchanged.

**UI/UX Standards** — ✅ Responsive grids; loading (skeleton), error ("Try again"), empty states on every view; accessible charts (text/table equivalent, SC-008).

**Hard Constraints** — ✅ No backend changes; no duplicate logic (consolidates scaffolding, shared formatter); no tight coupling; no direct API calls from components; no implicit `any`.

**API-first** — ✅ Frontend depends on the frozen `007-reporting` contract (`contracts/reporting.openapi.yaml`), corrected to the real `/reports` mount path.

**Result**: PASS (pre-design and post-design). One ADR-worthy decision (Recharts adoption) flagged below; no constitution violation requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-analytics-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R8
├── data-model.md        # Phase 1 — view-model entities + AnalyticsFilter
├── quickstart.md        # Phase 1 — setup + per-story verification
├── contracts/
│   ├── frontend-consumption.md   # frontend API/query/route/RBAC contract
│   └── reporting.openapi.yaml    # backend source-of-truth (copied from 007)
├── checklists/
│   └── requirements.md  # spec quality checklist (from /sp.specify)
└── tasks.md             # Phase 2 — created by /sp.tasks (NOT here)
```

### Source Code (repository root)

```text
frontend/src/
├── components/ui/
│   └── chart.tsx                      # NEW — Recharts wrapper (shared primitive)
├── lib/
│   ├── rbac.ts                        # EDIT — add canViewAnalytics, canViewOwnPerformance
│   └── format.ts                      # NEW — formatCurrency, formatPercent
├── routes.tsx                         # EDIT — add /analytics* routes; migrate /reports/financial
├── modules/
│   ├── reporting/                     # CONSOLIDATE to mandated structure
│   │   ├── pages/
│   │   │   ├── AnalyticsDashboardPage.tsx     # NEW — US1 KPI
│   │   │   ├── RevenueAnalyticsPage.tsx       # REFACTOR of FinancialReportPage — US2
│   │   │   ├── ProjectAnalyticsPage.tsx       # NEW — US3
│   │   │   └── DeveloperPerformancePage.tsx   # NEW — US4
│   │   ├── components/
│   │   │   ├── KpiCard.tsx, KpiCardGrid.tsx
│   │   │   ├── AnalyticsFilters.tsx           # date range + status/client/developer
│   │   │   ├── RequireAnalyticsAccess.tsx
│   │   │   ├── EmptyState.tsx, ErrorState.tsx, AccessDenied.tsx
│   │   │   └── charts/ (RevenueCompositionChart, ProjectStatusChart, DeveloperEarningsChart...)
│   │   ├── hooks/
│   │   │   ├── useDashboardSummary.ts, useFinancialReport.ts,
│   │   │   ├── useProjectsReport.ts, useDevelopersReport.ts
│   │   │   └── useAnalyticsFilter.ts          # URL <-> filter
│   │   ├── services/reporting.api.ts          # MOVE/REWRITE from api.ts; /reports base; query keys
│   │   ├── schemas/analytics-filter.schema.ts # NEW — Zod parse/serialize
│   │   ├── types.ts                           # EDIT — add entities, retype money as string
│   │   └── index.ts
│   └── earnings/                      # US5 — enrich self-service
│       ├── pages/DeveloperEarningsPage.tsx    # EDIT — add chart + module detail
│       ├── hooks/useMySelfReport.ts           # NEW — React Query
│       ├── api.ts                             # EDIT — /reports/developers/me path fix
│       └── types.ts                           # EDIT — retype money as string
└── ...
frontend/tests/
├── unit/        (analytics-filter.schema, format, reporting.api, rbac.analytics)
├── component/   (per-page render/data/filter/state tests via MSW)
└── mocks/       (reporting-handlers.ts; fix /reports/* paths)
```

**Structure Decision**: Web app, frontend module. Extend and consolidate the existing `frontend/src/modules/reporting/` module into the constitution-mandated frontend module structure, keep developer self-service in `frontend/src/modules/earnings/`, and add two shared cross-cutting assets (`components/ui/chart.tsx`, `lib/format.ts`) plus RBAC helpers in `lib/rbac.ts`. No backend directories are touched.

## Complexity Tracking

> No constitution violations require justification. The only deviations are deliberate and compliant:

| Item | Note |
|---|---|
| New dependency: Recharts | No charting lib existed; required for "charts integration". Wrapped in `components/ui/chart.tsx` to keep swap cost at one file. ADR suggested. |
| Filter bar not using React Hook Form | RHF is mandated for *forms*; the filter bar is a read-only URL-bound control (`useSearchParams` + Zod). No data mutation; not a form. |

---

📋 **Architectural decision detected**: Adopt Recharts (+ `components/ui/chart.tsx` wrapper) as the platform charting library — cross-cutting across all analytics views, the only new runtime dependency, with viable alternatives (Chart.js, visx, Nivo) evaluated in research.md. Document reasoning and tradeoffs? Run `/sp.adr charting-library`.

# Phase 0 Research: Analytics & Reporting Dashboard (Frontend)

**Feature**: `013-analytics-dashboard`
**Date**: 2026-06-15
**Input**: spec.md + user planning focus (1. Dashboard analytics, 2. Charts integration, 3. Filtering system, 4. API integration)

This document resolves every open technical decision before design. All choices are grounded in the existing frontend stack (`frontend/package.json`), the constitution's Frontend Standards, the backend `007-reporting` contract, and the established `010/011/012` dashboard patterns.

---

## R1. Charting library — "Charts integration"

**Decision**: Add **Recharts** (`recharts`) as the charting library, wrapped in a thin local `Chart`-primitive layer under `frontend/src/components/ui/chart.tsx` (shadcn-style), and build all analytics charts on top of that wrapper rather than calling Recharts directly from pages.

**Rationale**:
- No charting library is currently installed (`package.json` review: only Tailwind, shadcn primitives, React Query, RHF/Zod, Zustand). A charting dependency must be added — this is the one genuinely new dependency this feature introduces.
- Recharts is the library shadcn/ui's own `Chart` component is built on, so it is the lowest-friction fit for the constitution-mandated shadcn + Tailwind stack and the existing `components/ui/*` convention.
- It is declarative/React-component based (composes naturally with React 19), renders SVG (accessible, themeable with Tailwind tokens), and supports the chart types the spec needs: bar (per-project revenue, per-developer earnings/modules), pie/donut (company vs. developer share composition), and stacked bars (project status / module breakdown).
- Wrapping it behind `components/ui/chart.tsx` keeps the constitution rule "shared/common UI components must be centralized" and means a future library swap touches one file, not every page.

**Alternatives considered**:
- **Chart.js (react-chartjs-2)**: canvas-based, imperative config objects, weaker fit with the declarative shadcn/Tailwind idiom and harder to theme with CSS tokens; accessibility requires extra work. Rejected.
- **visx**: powerful but low-level; would require building axis/legend/tooltip primitives ourselves — too much surface for a read-only dashboard. Rejected.
- **Nivo**: heavier dependency footprint and its own theming system that fights Tailwind. Rejected.
- **Hand-rolled SVG/CSS bars**: zero dependency, but re-implementing axes, tooltips, legends, and responsive sizing is more code and risk than adding the standard library. Acceptable only for trivial single-metric bars; rejected as the general approach.

**Accessibility note (satisfies SC-008)**: Every chart MUST be paired with an accessible text/table equivalent of its data (the same rows already rendered in the view's table, or an `aria-label`/visually-hidden summary). Charts are presentational; the table is the source of truth for assistive tech.

---

## R2. Money & decimal formatting — "API integration" correctness

**Decision**: Add a shared formatting helper `frontend/src/lib/format.ts` exposing `formatCurrency(value: string | number)` and `formatPercent(value: string | number)`. Type all monetary/average fields in the analytics types as **`string`** (decimal strings, matching the backend), and format for display via the helper. Parse with `Number(...)` only at the formatting boundary, never storing the float back.

**Rationale**:
- The backend contract (`reporting.openapi.yaml`) returns money and `average_module_progress` as **decimal strings** ("1800.00", "66.7") specifically to avoid float drift (spec FR-019, SC-007).
- The existing scaffolding mis-types these as `number` (`reporting/types.ts`, `earnings/types.ts`) and renders them with `.toString()` / `Number(x).toLocaleString()`, which is both type-incorrect and inconsistent across modules. This is corrected here (spec FR-026).
- A single helper using `Intl.NumberFormat` gives consistent, locale-aware, artifact-free currency (`$1,800.00`) and percent (`66.7%`) rendering and is unit-testable against representative values (SC-007).
- Formatting at the boundary (display only) keeps the decimal string intact as the source of truth and never feeds it through lossy float arithmetic before display (FR-019).

**Alternatives considered**:
- **Keep `number` typing + `.toLocaleString()`**: perpetuates the existing drift risk and type mismatch; the backend explicitly returns strings. Rejected.
- **Add a decimal library (decimal.js / dinero.js)**: unnecessary — the frontend performs **no monetary arithmetic** (all sums/totals come pre-computed from the backend, including the `totals` block). We only display; arithmetic-grade decimals are overkill. Rejected.

---

## R3. Endpoint paths — "API integration"

**Decision**: All analytics API calls MUST target the backend-mounted prefix **`/reports`** (verified in `backend/app/main.py`: `("reporting", "/reports")`). Correct the existing drift where `reporting/api.ts` calls `/reporting/payments` and `earnings/api.ts` calls `/reporting/developers/me` → they must become `/reports/payments` and `/reports/developers/me`.

**Rationale**:
- The backend router is mounted at `/reports` and the OpenAPI contract documents `/reports/*`. The current `/reporting/*` calls are a latent bug that would 404 against the real backend (spec FR-025, FR-026). The MSW mocks may currently mask this; tests must be updated to the correct paths.
- Centralizing the base path in one place per module API file (or a shared constant) prevents recurrence.

**Endpoint → call mapping** (full detail in `contracts/`):

| Endpoint | Method | Filters | Consumed by |
|---|---|---|---|
| `/reports/dashboard` | GET | none | KPI overview (US1) |
| `/reports/payments` | GET | date_from, date_to, project_status, client_id | Revenue (US2) |
| `/reports/projects` | GET | date_from, date_to, project_status, client_id, developer_id | Project analytics (US3) |
| `/reports/developers` | GET | date_from, date_to, project_status, client_id, developer_id | Developer perf (US4) |
| `/reports/developers/me` | GET | none | Developer self-service (US5) |

---

## R4. Server-state & caching — "API integration"

**Decision**: Use **TanStack React Query** for every analytics fetch (constitution mandates React Query for all server state). One query per view, with a structured query-key factory per module that **includes the active filter set in the key** so each filter combination is cached independently and refetched on change. Reuse the established `staleTime: 30_000` + `refetchOnWindowFocus: true` defaults seen in `useClientsList`.

**Rationale**:
- Matches the constitution ("React Query for all server state") and the exact pattern already used by clients/projects hooks.
- Filter-keyed queries (`["reports","projects", filters]`) give correct cache isolation per filter combination and automatic refetch when filters change, satisfying FR-014/FR-018 without manual cache busting.
- `refetchOnWindowFocus` satisfies FR-018 (refresh on focus) while `staleTime` avoids refetch storms; reports are treated as live-at-fetch (spec edge case "live data").

**Alternatives considered**:
- **`useEffect` + `useState` (as in the current `FinancialReportPage`)**: no caching, no loading/error state machine, refetches on every mount, violates the constitution. This existing page is refactored onto React Query. Rejected.
- **Zustand for server data**: Zustand is for UI/local state only per constitution; server state belongs in React Query. Rejected.

---

## R5. Filtering system & URL state — "Filtering system"

**Decision**: Encode the active filter set in the **URL query string** as the single source of truth, parsed/validated through a **Zod** schema (`analytics-filter.schema.ts`) mirroring the `clients-filter.schema.ts` pattern (`parseFilter(URLSearchParams)` → typed object, `filterToParams(filter)` → record). Filter UI components write to the URL via `useSearchParams`; hooks read the parsed filter from the URL and feed it into the React Query key.

**Rationale**:
- The spec requires filters to be shareable/restorable via URL (FR-016) and to compose as AND (FR-014). URL-as-source-of-truth makes deep-linking, reload-restore, and back/forward "free".
- Zod validation at the parse boundary catches malformed local input (e.g. bad date order) before a request is issued, and lets us present a clear client-side message; the backend remains the authority for FK existence (422), which we surface from the response (FR-015).
- Mirrors the proven `011-clients-dashboard` filter schema pattern (constitution: prefer reuse, Zod for validation), so it is consistent and low-risk.

**Filter shape** (per the contract; not all filters apply to all views):
- `date_from`, `date_to` (ISO date strings) — Revenue, Project, Developer
- `project_status` ∈ {pending, active, completed} — Revenue, Project (and Developer per contract)
- `client_id` (positive int) — Revenue, Project (and Developer per contract)
- `developer_id` (positive int) — Project, Developer (NOT Revenue per contract)

**Client-side pre-validation** (FR-015): reject `date_from > date_to` before sending and show an inline message; everything else (unknown status enum, non-existent ids) is sent and the backend 422 is surfaced inline.

**Alternatives considered**:
- **Local component state / Zustand for filters**: loses shareability and reload-restore (fails FR-016). Rejected.
- **React Hook Form for the filter bar**: RHF is mandated for *forms* (create/edit); a read-only filter bar bound to the URL is simpler with `useSearchParams` + Zod parse. RHF would add ceremony without benefit here. Rejected.

---

## R6. RBAC enforcement — route guards & navigation

**Decision**: Add analytics RBAC helpers to `frontend/src/lib/rbac.ts` (`canViewAnalytics(role)` → admin|manager; `canViewOwnPerformance(role)` → developer) and a route-guard component **`RequireAnalyticsAccess`** mirroring `RequireClientsAccess`. Gate the aggregate routes (KPI/Revenue/Project/Developer) behind `canViewAnalytics`; gate the self-service route behind `canViewOwnPerformance`. Render the nav links via the existing `IfRole` component.

**Rationale**:
- Directly mirrors the established, tested `RequireClientsAccess` + `canViewClients` + `IfRole` pattern (spec FR-020–FR-022). Keeps RBAC in one place (`lib/rbac.ts`) per constitution.
- Backend RBAC (contract security model): admin+manager → four aggregate reports, **denied** `/me`; developer → `/me` only, **denied** aggregates. The guards make the UI match exactly so there are no "click → 403" surprises (SC-004, SC-006).
- 401 mid-session (FR-023) is already handled globally by the `http` 401 interceptor + `RequireAuth` from `009-auth-ui`; role-change re-render (FR-024) is handled by the Zustand session store's cross-tab `storage` sync — no new mechanism needed, just consumption.

**Alternatives considered**:
- **Inline role checks in each page**: scatters RBAC logic, contradicts the centralized pattern and constitution. Rejected.
- **A single shared `RequireRole(roles)` generic guard**: attractive, but the codebase convention is per-feature guard components (`RequireClientsAccess`); following the established convention keeps the diff consistent and reviewable. We add a feature-specific guard. (A generic guard is a reasonable future refactor, out of scope here.)

---

## R7. Module structure & route layout — "Dashboard analytics"

**Decision**: Consolidate analytics into the existing **`frontend/src/modules/reporting/`** module (extended to the constitution's frontend module structure: `pages/`, `components/`, `hooks/`, `services/`, `schemas/`), and keep the developer self-service surface in **`frontend/src/modules/earnings/`** (already the developer's "My Earnings" home). Repoint/rename the API layer to `services/reporting.api.ts` with a query-key factory. Routes:

| Route | Page | Guard |
|---|---|---|
| `/analytics` | KPI overview (Dashboard) | `RequireAnalyticsAccess` |
| `/analytics/revenue` | Revenue analytics (refactor of FinancialReportPage) | `RequireAnalyticsAccess` |
| `/analytics/projects` | Project analytics | `RequireAnalyticsAccess` |
| `/analytics/developers` | Developer performance | `RequireAnalyticsAccess` |
| `/earnings` (existing) | Developer self-service performance | developer-only |

**Rationale**:
- The constitution's frontend module structure (`pages/components/hooks/services/schemas/store`) is mandatory; the current `reporting/` module is a flat `api.ts/types.ts/pages/` and must be brought up to standard (FR-026).
- A dedicated `/analytics` namespace with sub-routes is clearer IA than the current ad-hoc `/reports/financial`, and groups the four aggregate views the way US7 navigation describes. The existing `/reports/financial` route + "Financial Reports" nav link is migrated to `/analytics/revenue`.
- Keeping developer self-service under the existing `/earnings` route avoids a second developer landing page; US5 just enriches it (chart + module detail) using `/reports/developers/me`.

**Alternatives considered**:
- **A brand-new `analytics/` module**: would orphan the existing `reporting/` and `earnings/` scaffolding and duplicate fetch logic (violates FR-026, constitution "no duplicate logic"). Rejected in favor of consolidation.
- **One mega-page with tabs instead of sub-routes**: loses deep-linkability of each view and complicates per-view filter URLs. Sub-routes chosen.

---

## R8. Loading / empty / error states — UI/UX mandate

**Decision**: Reuse the established state components: `Skeleton` primitive for loading (skeleton KPI cards and table/chart placeholders), feature-local `EmptyState` and `ErrorState` components (mirroring `clients/components/EmptyState.tsx` / `ErrorState.tsx`) for no-data and fetch-failure, and `AccessDenied` for RBAC denial. Each view wires React Query's `isLoading`/`isError`/`data` to these.

**Rationale**:
- Constitution mandates loading, error, and empty states on all data views; the spec requires skeletons after 200 ms, "Try again" on error, and friendly empty states (FR-017). These components already exist for clients and are reused/generalized (constitution: reuse, centralize).

---

## Summary of new dependencies & cross-cutting additions

| Item | Type | Location |
|---|---|---|
| `recharts` | new npm dependency | `frontend/package.json` |
| `components/ui/chart.tsx` | new shared primitive | wraps Recharts |
| `lib/format.ts` | new shared util | `formatCurrency`, `formatPercent` |
| `RequireAnalyticsAccess` | new guard | `modules/reporting/components/` |
| `canViewAnalytics`, `canViewOwnPerformance` | new RBAC fns | `lib/rbac.ts` |
| Endpoint path fix `/reporting/*`→`/reports/*` | bug fix | `reporting/api.ts`, `earnings/api.ts`, MSW mocks |

**All NEEDS CLARIFICATION resolved. No open questions remain for Phase 1.**

📋 Architectural decision detected: adoption of Recharts (+ a `components/ui/chart.tsx` wrapper) as the platform charting library — cross-cutting (every analytics view), introduces the only new runtime dependency, and has viable alternatives. Worth an ADR. (See plan.md gate note.)

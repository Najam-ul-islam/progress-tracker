# Quickstart: Analytics & Reporting Dashboard (Frontend)

**Feature**: `013-analytics-dashboard` | **Date**: 2026-06-15

This is a **frontend-only** feature consuming the existing `007-reporting` backend API. No backend or DB changes.

## Prerequisites

- Backend running with the `007-reporting` slice (endpoints under `/reports`). Start it from `backend/` (FastAPI/uvicorn) with a seeded database.
- Node + the frontend toolchain installed.

## 1. Install the new charting dependency

```bash
cd frontend
npm install recharts
```

> `recharts` is the only new runtime dependency this feature adds (research R1). It backs the shared `components/ui/chart.tsx` wrapper.

## 2. Run the frontend

```bash
cd frontend
npm run dev        # Vite dev server
```

Sign in with each role to verify RBAC:
- **admin / manager** → "Analytics" appears in the nav → `/analytics`.
- **developer** → "My Earnings" appears (no "Analytics") → `/earnings`.

## 3. Run the checks

```bash
cd frontend
npm run typecheck      # no implicit any; decimal-string fields typed as string
npm run lint
npm run test           # vitest: unit + component (MSW) + RBAC tests
```

## 4. Manual verification per user story

| Story | Steps | Expected |
|---|---|---|
| **US1 KPI** | admin → `/analytics` | KPI cards: project counts, dev engagement, payment flow; values match `/reports/dashboard`; skeletons first, then data; empty DB → zeros |
| **US2 Revenue** | `/analytics/revenue` | headline totals + per-project table + composition chart; row totals reconcile to `totals`; `$1,800.00`-style formatting |
| **US3 Projects** | `/analytics/projects` | per-project progress bar + module breakdown (sums to module_count) + status/progress chart |
| **US4 Developers** | `/analytics/developers` | per-developer module counts + earnings + comparison chart |
| **US5 Self-service** | developer → `/earnings` | only own modules + earnings + personal chart; no aggregate/other-dev data |
| **US6 Filters** | on revenue/projects/devs set date range + status/client/developer | figures narrow; URL gains query params; reload restores; `from>to` → inline error, no request; bad id → backend 422 inline |
| **US7 RBAC** | each role + deep-link `/analytics*` as developer | developer → Access denied; nav entries match role; demote-in-other-tab re-renders without reload; 401 → login preserving URL |

## 5. Path-fix sanity check (research R3)

In browser devtools Network tab (or test assertions), confirm analytics requests hit **`/reports/...`** — NOT `/reporting/...`. The pre-existing `/reporting/*` calls are corrected as part of this feature.

## 6. Accessibility check (SC-008)

- Tab through each view: filters and view navigation reachable by keyboard.
- Each chart has an accessible text/table equivalent (the rendered table or an `aria-label`/visually-hidden summary) — charts are presentational only.

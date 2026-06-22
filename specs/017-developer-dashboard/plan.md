# Implementation Plan: Developer Dashboard (Frontend)

**Branch**: `017-developer-dashboard` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-developer-dashboard/spec.md`

## Summary

Deliver a developer-scoped workspace that unifies the developer's daily surfaces — overview, assigned modules with progress update, assigned projects, earnings, and notifications — into one cohesive area. This is a **frontend-only** feature on top of already-shipped backend slices (005 projects, 006 payments, 007 reporting, 008 notifications); **no backend changes**.

A significant amount of the data plumbing already exists and will be **reused, not rebuilt**: the `earnings` module already wraps `GET /reports/developers/me` (`useMySelfReport`) and `GET /payments/developer/me`; `projectsApi.updateModuleProgress` + `UpdateProgressDialog` already implement the `PATCH /modules/{id}/progress` write; the `notifications` module already provides feed components; `DashboardPage` already branches to a `DeveloperDashboardContent`. The work is therefore **(a)** create a dedicated `developer` frontend module that composes these into a deliberate dashboard (overview widgets, My Modules, My Projects, Earnings drill-down, notifications panel), **(b)** add deadline tracking by joining the self-report modules to their parent project `end_date` (developer-filtered `GET /projects`), since neither modules nor the self-report carry a deadline field, and **(c)** add developer-aware routing + sidebar nav + a role guard. The phased delivery follows the user's 8 phases mapped onto the spec's prioritized stories.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18, Vite)
**Primary Dependencies**: React, React Router v6, TanStack Query (server state), Axios (`@/lib/http`), Zustand (`session.store`), TailwindCSS + shadcn/ui, React Hook Form + Zod (only where a form is needed; the progress control is a slider, no RHF required)
**Storage**: N/A (frontend; all persistence via existing backend endpoints)
**Testing**: Vitest + React Testing Library + MSW (existing `frontend/tests/` harness; mock handlers in `frontend/tests/mocks/`)
**Target Platform**: Modern browsers; responsive desktop + mobile per constitution UI/UX standards
**Project Type**: Web (frontend module within existing `frontend/src/modules/` structure)
**Performance Goals**: Dashboard interactive in <2s on a warm cache; progress update reflected in <30s end-to-end (SC-002); skeletons on every async surface
**Constraints**: No backend changes (FR-012/SC-006); decimal monetary fields are strings — format via `@/lib/format`, never float-math; type-safe (no implicit `any`); no direct API calls inside UI components (use hooks/services)
**Scale/Scope**: ~1 new frontend module (`modules/developer`), ~5 pages/views, ~6 components, reuse of ~8 existing components/hooks; developer role only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Frontend Standards (constitution §Frontend Standards) — all gates evaluated:

| Gate | Status | Notes |
|------|--------|-------|
| Module structure (`pages/ components/ hooks/ services/ schemas/ store/`) | ✅ PASS | New `modules/developer` follows the enforced layout; reuses sibling modules' services/hooks where they already exist. |
| No direct API calls in UI components | ✅ PASS | All fetching via hooks → services (`useMySelfReport`, `projectsApi`, notifications hooks, new `useMyProjects`/`useUpcomingDeadlines`). |
| No business logic in UI components | ✅ PASS | Deadline join + pending-task derivation live in a hook/util, not JSX. |
| React Query for all server state | ✅ PASS | All reads use TanStack Query; progress write uses `useMutation` with query invalidation. |
| Reusable / centralized components | ✅ PASS | Reuse `KpiCard`, `ProgressBar`, `StatusBadge`, `EmptyState`, `ErrorState`, `Skeleton`, notification components, `UpdateProgressDialog`. |
| Type safety, no implicit `any` | ✅ PASS | Read-only view models in `data-model.md`; wire types mapped explicitly. |
| Routing & security (protected routes, RBAC-aware nav, 403/404 pages) | ✅ PASS | New routes under `RequireAuth`; `RequireDeveloperWorkspace` guard; `navigation.config.ts` role-gates entries; existing `/unauthorized` page reused. |
| Forms (RHF + Zod) | ✅ PASS (N/A-ish) | Only the progress control needs input; reuses existing dialog (slider + numeric, client-side 0–100 guard). No new RHF form required. |
| UI/UX (responsive, loading, error, empty, a11y, skeletons) | ✅ PASS | Every data surface has skeleton/empty/error states; responsive grid; dark-mode classes consistent with dashboard module. |
| API-first (consume backend contract, no invented APIs) | ✅ PASS | Consumes only existing endpoints; deferred notes/history are explicitly out of scope (no invented contracts). |
| Spec-First / Incremental Evolution / no massive refactor | ✅ PASS | Additive new module; existing `DashboardPage` developer branch is refactored *minimally* (compose new overview), no cross-module rewrites. |

**Result**: PASS. No violations; Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/017-developer-dashboard/
├── plan.md              # This file (/sp.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (read-only view models)
├── quickstart.md        # Phase 1 output (run/verify steps)
├── contracts/           # Phase 1 output (consumed-endpoint contracts)
│   └── consumed-endpoints.md
├── checklists/
│   └── requirements.md  # from /sp.specify
└── tasks.md             # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/src/
├── modules/
│   ├── developer/                      # NEW — the developer workspace module
│   │   ├── pages/
│   │   │   ├── DeveloperOverviewPage.tsx     # US1 overview (DashboardStats + widgets)
│   │   │   ├── MyModulesPage.tsx             # US2 list + progress update
│   │   │   ├── MyProjectsPage.tsx            # US3 read-only projects
│   │   │   └── MyEarningsPage.tsx            # US4 (may re-home existing earnings page)
│   │   ├── components/
│   │   │   ├── DashboardStats.tsx            # overview KPI strip (projects/modules/pending/earnings)
│   │   │   ├── AssignedModulesTable.tsx      # modules with progress + deadline + update action
│   │   │   ├── AssignedProjectsTable.tsx     # read-only projects w/ client, progress, timeline
│   │   │   ├── UpcomingDeadlines.tsx         # nearest-first deadline list, overdue flag
│   │   │   ├── EarningsCards.tsx             # paid/pending/total summary cards
│   │   │   └── NotificationsPanel.tsx        # recent dev-relevant notifications + View all
│   │   ├── hooks/
│   │   │   ├── useMyProjects.ts              # developer-filtered GET /projects
│   │   │   ├── useUpcomingDeadlines.ts       # join self-report modules → project end_date
│   │   │   └── useUpdateModuleProgress.ts    # mutation wrapper (or reuse projectsApi)
│   │   ├── components/RequireDeveloperWorkspace.tsx  # role guard (developer only)
│   │   └── index.ts
│   ├── earnings/        # REUSE — useMySelfReport, listMyEarnings, types
│   ├── projects/        # REUSE — projectsApi.updateModuleProgress, UpdateProgressDialog, ProgressBar, StatusBadge
│   ├── notifications/   # REUSE — feed hooks/components
│   ├── reporting/       # REUSE — KpiCard, EmptyState, ErrorState
│   └── dashboard/       # MINIMAL EDIT — DashboardPage developer branch composes new overview
├── config/
│   └── navigation.config.ts            # EDIT — add developer nav entries (My Work / My Modules / My Projects)
└── routes.tsx                          # EDIT — add /developer, /my-modules, /my-projects routes (developer-guarded)

frontend/tests/
├── component/
│   ├── DeveloperDashboard.test.tsx          # EXISTING stub — extend for overview
│   ├── DeveloperEarningsPage.test.tsx       # EXISTING
│   ├── MyModulesPage.test.tsx               # NEW — list + progress update + RBAC
│   └── MyProjectsPage.test.tsx              # NEW — read-only, no admin controls
├── unit/
│   └── upcomingDeadlines.test.ts            # NEW — deadline join/sort/overdue logic
└── mocks/
    └── (extend handlers for /projects developer-filtered, /reports/developers/me)
```

**Structure Decision**: Web app, frontend-only. A dedicated `frontend/src/modules/developer` module owns the workspace composition and the new deadline-join logic, while leaning on existing sibling modules (`earnings`, `projects`, `notifications`, `reporting`) for data access and primitives to avoid duplicate business logic (constitution Hard Constraint). The existing `DashboardPage` developer branch is composed from the new overview rather than duplicated.

## Phase Mapping (user-provided phases → spec stories)

| User Phase | Maps to | Primary deliverables |
|-----------|---------|----------------------|
| 1. Dashboard Layout | foundation | Routes, `RequireDeveloperWorkspace`, nav entries, page shells |
| 2. Overview Widgets | US1 (P1/MVP) | `DashboardStats`, `UpcomingDeadlines`, `EarningsCards`, pending-tasks; skeleton/empty/error |
| 3. My Projects | US3 (P2) | `AssignedProjectsTable`, `useMyProjects`, read-only timeline/client/progress |
| 4. My Modules | US2 (P1) | `AssignedModulesTable` with deadline + status + progress |
| 5. Progress Update UI | US2 (P1) | `ProgressUpdateDialog` (reuse `UpdateProgressDialog`), invalidation across overview/modules/projects |
| 6. Earnings Dashboard | US4 (P2) | `EarningsCards` + per-row breakdown (`/payments/developer/me`) |
| 7. Notifications | US5 (P3) | `NotificationsPanel`, deep-link, View all → `/notifications` |
| 8. Responsive QA | cross-cutting | Breakpoint pass, a11y, dark mode, state toggles, SC verification |

> Component-name note: the user requested `DashboardStats`, `AssignedProjectsTable`, `AssignedModulesTable`, `ProgressUpdateDialog`, `EarningsCards`, `NotificationsPanel`. These map 1:1 to the components above (`ProgressUpdateDialog` is satisfied by reusing the existing `projects/components/UpdateProgressDialog`; if a developer-specific wrapper is warranted it lives in `modules/developer/components`).

## Complexity Tracking

No constitution violations — table intentionally omitted.

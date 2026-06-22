# Quickstart: Developer Dashboard (Frontend)

A frontend-only feature. No backend changes, migrations, or new endpoints. Verify against the existing backend running locally.

## Prerequisites

- Backend running (FastAPI) with seed data including: a `developer` user assigned to ≥2 projects and ≥4 modules (mixed statuses), at least one paid and one pending earning, and a few notifications (`assignment`, `deadline`, `payment`).
- Frontend deps installed.

## Run

```bash
# Backend (from backend/) — uv only, no pip/venv
uv run uvicorn app.main:app --reload

# Frontend (from frontend/)
npm install
npm run dev
```

Open the app, sign in as the seeded **developer** user.

## Manual verification (maps to spec Success Criteria)

1. **Overview (US1 / SC-001)** — Landing view (`/` for developer) shows: Assigned Projects count, Assigned Modules with status breakdown, Pending Tasks, Upcoming Deadlines (nearest-first, overdue flagged), and an Earnings summary (paid/pending/total). Confirm every figure matches seed data on one screen.
2. **My Modules + Progress (US2 / SC-002)** — Open My Modules, pick an in-progress module, open the update control, set progress to 100, save. Badge turns Completed, parent project progress increases, overview earnings/counts refresh — no full reload. Time the flow: under 30s.
3. **Validation (FR-004)** — Try to submit a value outside 0–100: blocked with inline message.
4. **My Projects (US3 / SC-003)** — Open My Projects: each assigned project shows progress, timeline, status; **no** create/edit/delete/assign controls. Opening a project shows only the developer's own modules.
5. **Earnings (US4 / FR-007)** — Open Earnings: totals = paid + pending; per-row breakdown shows project/module/share%/amount/status. Confirm no other developer's amounts and no company-reserve figure appear.
6. **Notifications (US5)** — Recent dev-relevant notifications surface on the dashboard; "View all" navigates to `/notifications`.
7. **RBAC (SC-007)** — Sign in as admin/manager and hit a developer-only route → redirected/denied. Confirm developer sidebar shows the developer entries and hides admin-only ones (Users, Clients, Payments, Analytics).
8. **States (SC-004)** — With a zero-assignment developer, every section shows a friendly empty state. Simulate a failed fetch (offline) → retryable error. Loading → skeletons.
9. **Responsive (Phase 8)** — Verify layouts at mobile/tablet/desktop breakpoints; sidebar collapse; dark mode.

## Automated tests

```bash
# from frontend/
npm run test            # vitest + RTL + MSW
npm run test -- DeveloperDashboard MyModulesPage MyProjectsPage upcomingDeadlines
```

Expected coverage (per constitution Testing Standards): success cases, validation errors, RBAC restrictions, loading states, error states, empty states — across overview, modules+progress, projects, earnings, and the deadline-join util.

## Definition of Done

- All spec user stories' acceptance scenarios pass via component/unit tests.
- No new backend endpoints/schema/migrations (diff backend tree → clean).
- Lint/type-check clean (no implicit `any`).
- Manual verification steps 1–9 pass for the seeded developer.

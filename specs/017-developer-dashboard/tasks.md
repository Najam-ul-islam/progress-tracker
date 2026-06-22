---
description: "Task list for Developer Dashboard implementation"
---

# Tasks: Developer Dashboard (Frontend)

**Input**: Design documents from `/specs/017-developer-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md (required)
**Success Criteria**: SC-001 through SC-007 from spec.md

**Tests**: INCLUDED. Each user story has independent tests that must pass.

**Organization**: Tasks are grouped by user story (US1-US5) and mapped to the 8 development phases provided.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 / US5 — only on user-story-phase tasks
- All paths are repo-relative under `frontend/`

## Path Conventions

- Module root: `frontend/src/modules/developer/`
- Reuse existing: `frontend/src/modules/projects/`, `frontend/src/modules/earnings/`, `frontend/src/modules/notifications/`, `frontend/src/modules/reporting/`
- Tests: `frontend/tests/component/`, MSW mocks: `frontend/tests/mocks/`

---

## Phase 1: Routes & Developer Guard (Layout Foundation)

**Purpose**: Set up routing infrastructure for developer workspace.

- [ ] T001 Create `/developer` route in `frontend/src/routes.tsx` behind `RequireAuth` guard
- [ ] T002 Create `frontend/src/modules/developer/RouteGuard.tsx` — `RequireDeveloperWorkspace` component that restricts access to `developer` role only (redirects non-developers)
- [ ] T003 Create `frontend/src/modules/developer/index.ts` — module exports (pages, components)

---

## Phase 2: Overview Cards (US1 - P1)

**Purpose**: Build dashboard overview with summary cards for projects, modules, deadlines, and earnings.

**Independent Test**: Sign in as developer; navigate to `/developer`; confirm overview shows Assigned Projects count, modules breakdown (completed/in-progress/pending), pending tasks count, upcoming deadlines ordered nearest-first, and earnings summary.

### Tests for User Story 1

- [ ] T004 `frontend/tests/component/DeveloperDashboard.test.tsx` — extended to verify overview cards (Active Projects, Active Modules, Upcoming Deadlines, Total Earnings), skeleton loaders, empty states, error states, non-developer redirect

### Implementation for User Story 1

- [ ] T005 Create `frontend/src/modules/developer/components/OverviewCards.tsx` — KPI cards for Active Projects, Active Modules (with status breakdown), Pending Tasks count
- [ ] T006 Create `frontend/src/modules/developer/components/UpcomingDeadlines.tsx` — deadline list component with overdue flagging and "No deadline" handling
- [ ] T007 Create `frontend/src/modules/developer/components/EarningsSummary.tsx` — total/paid/pending summary cards using `DeveloperSelfReport.earnings`
- [ ] T008 Create `frontend/src/modules/developer/hooks/useDeveloperProjects.ts` — fetch developer-filtered projects for deadline join (reuses `projectsApi.list`)
- [ ] T009 Create `frontend/src/modules/developer/hooks/useUpcomingDeadlines.ts` — derive `ModuleWithDeadline` by joining `DeveloperSelfModule` → parent project `endDate`
- [ ] T010 Create `frontend/src/modules/developer/pages/DeveloperOverviewPage.tsx` — compose OverviewCards, UpcomingDeadlines, EarningsSummary, NotificationsPanel
- [ ] T011 Update `frontend/src/modules/dashboard/pages/DashboardPage.tsx` — refactor `DeveloperDashboardContent` to use the new developer module components

---

## Phase 3: My Projects Section (US3 - P2)

**Purpose**: Read-only view of projects assigned to the developer.

**Independent Test**: Sign in as developer with 2 assigned projects; navigate to `/developer/projects`; verify client name, aggregate progress bar, timeline, status badge; no create/edit/delete controls present.

- [ ] T012 `frontend/tests/component/MyProjectsPage.test.tsx` — verify read-only project table, aggregate progress, timeline, client name, empty state, responsive layout
- [ ] T013 Create `frontend/src/modules/developer/components/AssignedProjectsTable.tsx` — table with project name, client name, progress bar, timeline (start → end/days), status badge
- [ ] T014 Create `frontend/src/modules/developer/pages/MyProjectsPage.tsx` — page shell with AssignedProjectsTable, empty/error states

---

## Phase 4: My Modules Section (US2 - P1)

**Purpose**: List assigned modules with progress, status, deadline, and share percentage.

**Independent Test**: Sign in as developer; open My Modules; verify module rows show name, parent project, progress bar with %, status badge, deadline; non-assigned module not editable.

- [ ] T015 `frontend/tests/component/MyModulesPage.test.tsx` — verify module table, progress bars, status badges, deadlines, share %, empty state, RBAC (non-editable for wrong dev)
- [ ] T016 Create `frontend/src/modules/developer/components/AssignedModulesTable.tsx` — table rows with module name, project name, progress bar + %, status badge, deadline, share %
- [ ] T017 Create `frontend/src/modules/developer/pages/MyModulesPage.tsx` — page shell with AssignedModulesTable, empty/error states

---

## Phase 5: Progress Update Dialog (US2 - P1)

**Purpose**: Allow developers to update module progress 0-100.

**Independent Test**: With module at 40% progress, open update dialog, set to 100, save; verify row shows 100% and "Completed" badge; parent project progress updates after re-fetch.

- [ ] T018 `frontend/tests/component/ProgressUpdateDialog.test.tsx` — verify progress slider/number input 0-100, status derivation (0→Pending, 1-99→In Progress, 100→Completed), out-of-range validation, 422/403 error handling, rollback on failure
- [ ] T019 Create `frontend/src/modules/developer/components/ProgressUpdateDialog.tsx` — reuse/adapt existing `UpdateProgressDialog` pattern with developer-friendly messaging
- [ ] T020 Wire progress update mutation into AssignedModulesTable — open dialog, save, optimistic update + query invalidation for overview/projects sync

---

## Phase 6: Earnings Section (US4 - P2)

**Purpose**: Detailed earnings view with per-module/per-project breakdown.

**Independent Test**: Sign in as developer with paid/pending earning rows; open `/developer/earnings`; verify total = paid + pending, breakdown shows project/module/share %/amount/status badges; no other developer's data.

- [ ] T021 `frontend/tests/component/DeveloperEarningsPage.test.tsx` — extended to verify earnings breakdown (project, module, share %, amount, status badges), totals consistency, empty state, confidentiality
- [ ] T022 Create `frontend/src/modules/developer/components/EarningsBreakdownTable.tsx` — extends existing `DeveloperEarningsPage` with developer-specific view
- [ ] T023 Update `frontend/src/modules/developer/pages/MyEarningsPage.tsx` — integrate EarningsBreakdownTable with summary cards, empty/error states

---

## Phase 7: Notifications Widget (US5 - P3)

**Purpose**: Integrate recent notifications relevant to developer work.

**Independent Test**: Seed developer with assignment/deadline/payment notifications; verify dashboard shows recent notifications panel newest-first with type/time; "View all" navigates to `/notifications`.

- [ ] T024 `frontend/tests/component/DeveloperNotificationsPanel.test.tsx` — verify recent notifications display, type icons, relative time, "View all" link, empty state "You're all caught up"
- [ ] T025 Create `frontend/src/modules/developer/components/NotificationsPanel.tsx` — compose existing notification feed hooks with developer-relevant filter (assignment, deadline, payment types)
- [ ] T026 Wire NotificationsPanel into DeveloperOverviewPage (Phase 2) and ensure it queries `useNotificationFeed`

---

## Phase 8: Responsive + Accessibility QA

**Purpose**: Final verification of responsive layout and accessibility compliance.

- [ ] T027 Verify responsive breakpoints (mobile <640px, tablet 640-1024px, desktop >1024px) on all developer pages
- [ ] T028 Add ARIA labels to interactive elements (progress sliders, status badges, deadline items)
- [ ] T029 Verify keyboard navigation (Tab, Enter, Escape) works on all dialogs and tables
- [ ] T030 Verify color contrast meets WCAG AA standards in both light and dark modes
- [ ] T031 Run `npm run lint` and `npm run build` in `frontend/`; fix any issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — establishes routes
- **Phase 2 (US1)**: No dependencies — can start immediately after Phase 1
- **Phase 3 (US3)**: After Phase 1 — independent
- **Phase 4 (US2)**: After Phase 1 — independent but progress update (T020) needs T019
- **Phase 5 (US2)**: Depends on Phase 4
- **Phase 6 (US4)**: No dependencies — can run parallel with Phase 3
- **Phase 7 (US5)**: No dependencies — can run parallel with Phase 3/4

### Recommended Parallel Opportunities

- Phases 2-4-6-7 can proceed in parallel after Phase 1 scaffolding
- Within Phase 2: T005, T006, T007 can run in parallel
- Within Phase 4: T015 (test), T016, T017 can run in parallel
- Within Phase 6: T021 (test), T022, T023 can run in parallel
- Phase 8 (QA) blocks final merge

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Routes & Guard
2. Phase 2: Overview Cards (US1 P1)
3. Phase 4: My Modules Section (US2 P1)
4. Phase 5: Progress Update (US2 P1)
5. **STOP & VALIDATE** — developer can see assigned modules and update progress

### Incremental Value Adds

6. Phase 6: Earnings Section (US4 P2)
7. Phase 3: My Projects Section (US3 P2)
8. Phase 7: Notifications Widget (US5 P3)
9. Phase 8: Responsive QA
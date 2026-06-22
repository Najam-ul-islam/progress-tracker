---
description: "Task list for Modern SaaS Admin Dashboard implementation"
---

# Tasks: Frontend Dashboard Foundation

**Input**: Design documents from `/specs/015-admin-dashboard/`  
**Prerequisites**: plan.md (required), spec.md (required)  
**Success Criteria**: Responsive shell complete, theme switching functional, no-flash theme, reusable widgets, accessibility pass complete.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Configure Tailwind design tokens in `frontend/src/index.css` using `@theme` directive
- [X] T002 Initialize theme provider in `frontend/src/context/ThemeContext.tsx`
- [X] [P] T003 Configure ESLint and Prettier for frontend codebase
- [X] [P] T004 Set up TypeScript path aliases in `frontend/tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Configure CSS custom properties for light/dark semantic tokens in `frontend/src/index.css`
- [X] [P] T006 Implement no-flash theme initialization script in `frontend/index.html` head
- [X] [P] T007 Persist theme preference using localStorage in `frontend/src/context/ThemeContext.tsx`
- [X] [P] T008 Create layout state store for sidebar/mobile in `frontend/src/modules/dashboard/components/layout.store.ts`
- [X] T009 Set up accessible focus rings and reduced motion support in `frontend/src/index.css`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Responsive Shell & Navigation (Priority: P1) 🎯 MVP

**Goal**: Core navigation and layout framework (the shell) for all pages

**Independent Test**: Load application at various viewport widths: desktop sidebar collapsible, mobile hamburger opens drawer, active routes highlighted

### Implementation for User Story 1

- [X] T010 [P] [US1] Create config-driven navigation array in `frontend/src/modules/dashboard/components/Sidebar.tsx`
- [X] T011 [P] [US1] Implement AppLayout container in `frontend/src/modules/dashboard/components/DashboardLayout.tsx`
- [X] T012 [US1] Implement Sidebar with desktop collapse/expand in `frontend/src/modules/dashboard/components/Sidebar.tsx`
- [X] T013 [US1] Add active route highlighting in `frontend/src/modules/dashboard/components/Sidebar.tsx`
- [X] T014 [P] [US1] Create mobile drawer sidebar component in `frontend/src/modules/dashboard/components/DashboardLayout.tsx`
- [X] T015 [P] [US1] Implement hamburger menu trigger in `frontend/src/modules/dashboard/components/Navbar.tsx`
- [X] T016 [P] [US1] Add overlay backdrop handling for mobile drawer in `frontend/src/modules/dashboard/components/DashboardLayout.tsx`
- [X] T017 [US1] Wire responsive navbar with breadcrumbs in `frontend/src/modules/dashboard/components/Navbar.tsx`
- [X] T018 [US1] Integrate theme toggle dropdown in `frontend/src/modules/dashboard/components/Navbar.tsx`
- [X] T019 [US1] Add user profile dropdown menu in `frontend/src/modules/dashboard/components/Navbar.tsx`
- [X] T020 [US1] Configure responsive behavior breakpoints (mobile <640px, tablet 640-1024px, desktop >1024px)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - KPI Cards & Interactive Widgets (Priority: P1)

**Goal**: Present system metrics and information clearly for admin operators

**Independent Test**: Load dashboard page and confirm visual rendering of KPI cards, charts, data table, and activity feed using mock props

### Implementation for User Story 2

- [X] T021 [P] [US2] Create KpiCard component in `frontend/src/modules/dashboard/components/KPICard.tsx`
- [X] T022 [US2] Implement loading skeleton state in `frontend/src/modules/dashboard/components/KPICard.tsx`
- [X] T023 [US2] Implement empty state UI in `frontend/src/modules/dashboard/components/KPICard.tsx`
- [X] T024 [P] [US2] Create ChartWidget wrapper using Recharts in `frontend/src/modules/dashboard/components/MetricsChart.tsx`
- [X] T025 [US2] Add theme-aware chart colors in `frontend/src/modules/dashboard/components/MetricsChart.tsx`
- [X] T026 [P] [US2] Create generic DataTable component in `frontend/src/modules/dashboard/components/DataTable.tsx`
- [X] T027 [P] [US2] Implement client-side search filtering in `frontend/src/modules/dashboard/components/DataTable.tsx`
- [X] T028 [P] [US2] Add navigation pagination controls in `frontend/src/modules/dashboard/components/DataTable.tsx`
- [X] T029 [P] [US2] Create ActivityFeed component in `frontend/src/modules/dashboard/components/ActivityFeed.tsx`
- [X] T030 [US2] Add timeline layout with category icons in `frontend/src/modules/dashboard/components/ActivityFeed.tsx`
- [X] T031 [US2] Create mock data file for dashboard in `frontend/src/modules/dashboard/services/mockData.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Dashboard Page Assembly (Priority: P1)

**Goal**: Compose all widgets into a responsive grid layout

**Independent Test**: Load `/dashboard` route and verify all sections render correctly

### Implementation for User Story 3

- [X] T032 [US3] Assemble DashboardPage with responsive grid in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T033 [US3] Add KPI section with 4-card responsive grid in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T034 [US3] Add Charts section with MetricsChart in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T035 [US3] Add Recent Activity section with ActivityFeed in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T036 [US3] Add Data Table section with pagination in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T037 [US3] Wire mock data to all widgets in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- [X] T038 [US3] Add state toggle controls for loading/empty demos in `frontend/src/modules/dashboard/pages/DashboardPage.tsx`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T039 Verify responsive breakpoints on Mobile (<640px)
- [X] T040 Verify responsive breakpoints on Tablet (640px–1024px)
- [X] T041 Verify responsive breakpoints on Desktop (>1024px)
- [X] T042 Add ARIA labels to interactive elements
- [X] T043 Add keyboard navigation support for sidebar and navbar
- [X] T044 Verify color contrast meets WCAG AA standards
- [X] T045 Validate light mode rendering across all components
- [X] T046 Validate dark mode rendering across all components
- [X] T047 Run final layout and component consistency check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P1)**: Can start after User Story 1 & 2 - Composes widgets from US2

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- Within each story: tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test responsive shell independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories
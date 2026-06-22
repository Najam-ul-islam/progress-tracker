# Tasks: Projects Dashboard (Frontend)

**Feature**: `012-projects-dashboard`
**Input**: Design documents from `/specs/012-projects-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/projects-frontend-contract.md, quickstart.md

**Tests**: INCLUDED. Every module must validate success cases, validation errors, RBAC restrictions, API behavior, loading states, and error states. MSW + Vitest strategy.

**Organization**: Tasks are grouped by phase and user story. The module is `frontend/src/modules/projects/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6; Setup/Foundational/Polish carry no story label
- All paths are relative to repo root `D:\progress-tracker\`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the module skeleton and confirm the toolchain is green.

- [ ] T001 Create the `frontend/src/modules/projects/` directory tree with `services/`, `hooks/`, `schemas/`, `components/`, `pages/` subfolders.
- [ ] T002 Verify baseline toolchain: run `npm run typecheck`, `npm run lint`, and `npm run test` from `frontend/` and confirm all pass.

**Checkpoint**: Skeleton exists; existing suite is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, RBAC helpers, API layer, and MSW mocks that every story depends on.

- [ ] T003 [P] Create domain + error types in `frontend/src/modules/projects/types.ts` (Project, ProjectModule, ProjectStatus, etc. per data-model.md).
- [ ] T004 [P] Add RBAC helpers in `frontend/src/lib/rbac.ts`: `canViewProjects(role)`, `canEditProjects(role)`, `canUpdateProgress(role)`.
- [ ] T005 Implement `frontend/src/modules/projects/services/projects.api.ts`: fromWire mapping, toWire payloads, and the 7 API methods.
- [ ] T006 [P] Create `frontend/tests/mocks/projects-handlers.ts`: Seeded projects/modules (all statuses) and handlers for list, detail, create, update, progress, modules.
- [ ] T007 Register projects handlers in `frontend/tests/mocks/server.ts`.
- [ ] T008 [P] Unit test API layer in `frontend/tests/unit/projects.api.test.ts`: Mapping, snake→camel, payload formatting.
- [ ] T009 [P] Create reusable UI widgets in `frontend/src/modules/projects/components/`: `ProgressBar.tsx` (fill based on 0-100) and `StatusBadge.tsx` (color-coded by ProjectStatus/ModuleStatus).

**Checkpoint**: Infrastructure and core widgets ready.

---

## Phase 3: User Story 1 — Projects Dashboard (List, Search, Toggles)

**Goal**: Admin/Manager see all projects in Table or Kanban view; Search by name/client; Developer sees filtered list.

### Tests for User Story 1

- [ ] T010 [P] [US1] Unit test filtered clients in `frontend/tests/unit/useFilteredProjects.test.ts`: case-insensitive name/client match.
- [ ] T011 [P] [US1] Component test `frontend/tests/component/ProjectsListPage.test.tsx`: Table/Kanban toggle; search narrowing; RBAC filtering (developer sees only assigned).

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create `frontend/src/modules/projects/components/ProjectTable.tsx`: Columns for Name, Client, Amount, Progress Bar, Status Badge.
- [ ] T013 [P] [US1] Create `frontend/src/modules/projects/components/ProjectKanban.tsx`: Three columns (Pending, Active, Completed) with project cards.
- [ ] T014 [P] [US1] Create search hook `frontend/src/modules/projects/hooks/useFilteredProjects.ts`.
- [ ] T015 [US1] Create `frontend/src/modules/projects/pages/ProjectsListPage.tsx`: Toggle state (Table/Kanban), wire list query + filter.
- [ ] T016 [US1] Register route `/projects` in `frontend/src/routes.tsx`.
- [ ] T017 [US1] Add "Projects" link to `AppHeader.tsx` (Admin/Manager only).

**Checkpoint**: Dashboard functional with dual views and RBAC filtering.

---

## Phase 4: User Story 2 — Project Details & Modules List

**Goal**: View project metadata, timeline, and the modules table.

### Tests for User Story 2

- [ ] T018 [P] [US2] Component test `frontend/tests/component/ProjectDetailsPage.test.tsx`: Render metadata; modules list; timeline dates; 404 for unauthorized developer access.

### Implementation for User Story 2

- [ ] T019 [P] [US2] Create `frontend/src/modules/projects/components/ProjectInfoCard.tsx`: Timeline (start/end), Client, Budget, Status.
- [ ] T020 [P] [US2] Create `frontend/src/modules/projects/components/ModulesTable.tsx`: Name, Developer, Share %, Progress Bar, Status.
- [ ] T021 [US2] Create `frontend/src/modules/projects/pages/ProjectDetailsPage.tsx`: Fetch detail + aggregate progress; compose InfoCard + ModulesTable.
- [ ] T022 [US2] Register route `/projects/:id` in `frontend/src/routes.tsx`.

**Checkpoint**: Deep-linkable project details and module overview ready.

---

## Phase 5: User Story 3 — Create Project Dialog

**Goal**: Admin/Manager can onboard new projects.

- [ ] T023 [P] [US3] Create `frontend/src/modules/projects/schemas/project-form.schema.ts`: Zod validation (name, client, amount, dates).
- [ ] T024 [P] [US3] Component test `frontend/tests/component/CreateProjectDialog.test.tsx`: Valid submission; client dropdown; date-range validation.
- [ ] T025 [US3] Create `frontend/src/modules/projects/components/CreateProjectDialog.tsx`: Form with client select (from `useClientsList`) and date pickers.
- [ ] T026 [US3] Wire "New Project" button in `ProjectsListPage.tsx`.

---

## Phase 6: User Story 4 — Module Assignment & Activation

**Goal**: Add modules, assign developers, and activate the project (70% gate).

- [ ] T027 [P] [US4] Create `frontend/src/modules/projects/schemas/module-form.schema.ts`: Zod validation (name, developer, share %).
- [ ] T028 [P] [US4] Component test `frontend/tests/component/CreateModuleDialog.test.tsx`: Share cap validation (warn if > 70%); developer dropdown.
- [ ] T029 [US4] Create `frontend/src/modules/projects/components/CreateModuleDialog.tsx`: Form with developer select (from `useUsersList` filtered by role).
- [ ] T030 [US4] Implement "Activate Project" button in `ProjectDetailsPage.tsx`: Enabled only when sum of module shares == 70.00 and status is `pending`.

---

## Phase 7: User Story 5 — Progress Tracking (Developer Surface)

**Goal**: Developers (and others) can update module progress.

- [ ] T031 [P] [US5] Component test `frontend/tests/component/UpdateProgressDialog.test.tsx`: Slider 0-100; update triggers project refresh.
- [ ] T032 [US5] Create `frontend/src/modules/projects/components/UpdateProgressDialog.tsx`: Slider or numeric input for `progress`.
- [ ] T033 [US5] Wire "Update Progress" affordance in `ModulesTable.tsx` (conditional by `canUpdateProgress`).

---

## Phase 8: Polish & Validation

- [ ] T034 [P] Responsive pass: Kanban cards on mobile; scrollable tables.
- [ ] T035 [P] Accessibility pass: Progress bar aria-labels; dialog focus traps.
- [ ] T036 Run `npm run typecheck` and `npm run lint`.
- [ ] T037 Run full test suite `npm run test`.
- [ ] T038 Execute `quickstart.md` manual verification.

**Checkpoint**: Feature complete and verified.

# Implementation Plan: Projects Dashboard (Frontend)

**Feature Branch**: `012-projects-dashboard`
**Date**: 2026-06-14
**Spec**: [`spec.md`](./spec.md)

## Summary

Build the Project Management UI as a new frontend module `modules/projects/`. This module provides a dual-view dashboard (Table/Kanban) for Admins and Managers, detailed project views for management and assignment, and progress tracking for Developers. It strictly follows the RBAC rules defined in `005-projects`: developers see only their assigned work, and admins/managers see everything.

## Technical Approach

### 1. Foundational Layer
- **Types**: Define interfaces in `modules/projects/types.ts` following the "Wire vs Domain" pattern.
- **API**: Implement `projects.api.ts` with Axios mappings for all 7 endpoints defined in the contract.
- **RBAC**: Add `canViewProjects`, `canEditProjects`, and `canUpdateProgress` helpers to `lib/rbac.ts`.
- **Mocks**: Add MSW handlers in `tests/mocks/projects-handlers.ts` and register them in `server.ts`.

### 2. UI Components
- **ProgressBar**: A reusable tailwind-styled progress indicator.
- **StatusBadge**: Color-coded badges for `pending`, `active`, and `completed`.
- **ProjectTable**: Column-dense view for management.
- **ProjectKanban**: Card-based view grouped by status.
- **ModulesTable**: Integrated into project details for assignment and tracking.

### 3. Pages & Routing
- `ProjectsListPage`: The entry point with view-toggle and "New Project" affordance.
- `ProjectDetailsPage`: Comprehensive view of one project, its metadata, and its modules.
- **Routing**: Update `src/routes.tsx` to mount these pages under `RequireAuth`.

### 4. Interactive Workflows
- **Project Creation**: Dialog for onboarding new projects.
- **Module Assignment**: Dialog for adding modules to a project, including a developer dropdown.
- **Progress Tracking**: Dialog or inline affordance for updating module progress (0-100).
- **Activation Gate**: Logic to enable "Activate" button only when share percentage sum equals 70.00.

## Implementation Phases

### Phase 1: Foundation (API & RBAC)
- Set up directory structure.
- Define types and error classes.
- Implement API service and TanStack Query hooks.
- Unit test API mapping and RBAC logic.

### Phase 2: Dashboard (List & Search)
- Build `ProjectsListPage` with skeleton state.
- Implement `ProjectTable` and `StatusBadge`.
- Implement `ProjectKanban` and the view-toggle state.
- Wire filtered view for developers.

### Phase 3: Details & Modules
- Build `ProjectDetailsPage`.
- Implement `ProjectInfoCard` (metadata and timeline).
- Implement `ModulesTable` with progress bars.

### Phase 4: Write Workflows (Dialogs)
- Implement `CreateProjectDialog`.
- Implement `CreateModuleDialog` with share-cap validation.
- Implement `UpdateProgressDialog` (developer surface).
- Implement the "Activate" status transition.

### Phase 5: Polish & Validation
- Accessibility audit (aria-labels, focus).
- Responsive audit (mobile view).
- Full integration test suite run.
- Manual verification via `quickstart.md`.

## Risk Analysis

| Risk | Mitigation |
| --- | --- |
| **Share-Cap Drift** | The frontend will re-fetch the project's aggregate progress before opening the Create Module dialog to ensure accurate calculation. |
| **Developer Data Leak** | Strictly enforce the `assigned_developer_id` filter in both the frontend (UI filtering) and trust the backend (which returns 404 for unauthorized reads). |
| **Status Desync** | Invalidate the project detail query after any module progress update to trigger the backend's auto-completion derivation. |

## Success Criteria (DoD)
- ✅ Admin can create, assign, and activate a project.
- ✅ Developer can see and update only their assigned modules.
- ✅ Table/Kanban toggle works seamlessly.
- ✅ 100% test coverage for critical paths (assignment, progress, activation).
- ✅ Zero lint or type errors.

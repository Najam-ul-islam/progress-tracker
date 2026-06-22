# Quickstart: Projects Dashboard

**Feature**: `012-projects-dashboard`
**Date**: 2026-06-14

## Development Path

1. **Foundational**:
   - Define TS interfaces in `modules/projects/types.ts`.
   - Implement `projects.api.ts` with Axios mappings.
   - Register MSW handlers in `tests/mocks/projects-handlers.ts`.
2. **Dashboard**:
   - Create `ProjectsListPage`.
   - Implement `ProjectTable` and `ProjectKanban` views.
   - Add status filtering/badges.
3. **Details**:
   - Create `ProjectDetailsPage`.
   - Implement `ProjectInfoCard` and `ModulesTable`.
   - Add "Activate" button with gate logic (SUM share == 70).
4. **Module Management**:
   - Create `CreateModuleDialog`.
   - Implement developer selection (dropdown).
   - Wire share-cap validation.
5. **Developer Tracking**:
   - Create `MyModulesPage` (or equivalent filtered view).
   - Implement `UpdateProgressDialog` (slider).

## Verification (Manual)

1. **Onboarding**:
   - Login as admin.
   - Go to `/projects` -> "New Project".
   - Fill info, select a client -> Save.
   - See project in "Pending" column.
2. **Setup Modules**:
   - Click project -> Details.
   - Add 3 modules assigned to different developers (e.g., 30%, 20%, 20%).
   - Total = 70.00.
   - Click "Activate" -> Status turns to "Active".
3. **Developer Flow**:
   - Login as Developer A.
   - Go to `/projects` -> Only see the project from step 2.
   - Click it -> Update progress on assigned module to 100%.
   - See module turn "Completed".
4. **Completion**:
   - Login as Admin.
   - Update remaining 2 modules to 100%.
   - Refresh -> Project status should be "Completed" (green).

## CI/CD Checks

- `npm run test`: All clients unit/component tests pass.
- `npm run typecheck`: Zero TS errors.
- `npm run lint`: Zero ESLint warnings.

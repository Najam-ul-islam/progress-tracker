# Research: Projects Dashboard (Frontend)

**Feature**: `012-projects-dashboard`
**Date**: 2026-06-14

## Existing Patterns

### Module Structure
Following the project's modular architecture, the new module will live in `frontend/src/modules/projects/` with the standard subdirectories:
- `components/` - Project-specific UI (Table, Kanban, Cards, Dialogs)
- `hooks/` - Data fetching hooks (useProjects, useProject, useProjectProgress)
- `pages/` - Routable pages (ProjectsListPage, ProjectDetailsPage)
- `schemas/` - Zod validation schemas
- `services/` - API client (projects.api.ts)
- `types.ts` - TypeScript interfaces

### API Integration
- Uses **Axios** with a central `http` instance (`frontend/src/lib/http.ts`).
- Follows the "Wire-to-Domain" mapping pattern: Backend returns snake_case, Frontend converts to camelCase in the service layer.
- Uses **TanStack Query (React Query)** for server state management and caching.

### UI Primitives
- **Tailwind CSS 4** for styling.
- **shadcn/ui** (file-copy primitives) for components like Dialog, Table, Form, Input, Button, Badge.
- **Lucide React** for icons.

### RBAC (Role-Based Access Control)
- RBAC is enforced at the route level using `<RequireAuth>` and within pages/components using role helpers.
- Helpers live in `frontend/src/lib/rbac.ts`.

## Project-Specific Needs

### 1. View Toggling (Table vs. Kanban)
- The Projects list requires a way to switch between a dense table view and a status-grouped Kanban view.
- This state can be managed locally in the `ProjectsListPage` or via URL search params (e.g., `?view=table` vs `?view=kanban`).

### 2. Progress Visualization
- Custom `ProgressBar` component to visualize `0-100` progress values.
- Shared between Projects list (aggregate) and Modules list (individual).

### 3. Share-Cap Logic (The "70% Rule")
- Before creating/updating a module, the frontend should ideally fetch the current project state to calculate the remaining share allocation.
- Validation logic should be shared between the form (Zod) and the service.

### 4. Activation Gate
- "Activate" button should be enabled only when:
  1. Project status is `pending`.
  2. Total allocated share percentage of active modules equals exactly `70.00`.

### 5. Developer Assignments
- Need a `DeveloperSelect` component (combobox or searchable select) to pick an active developer from the `users` list.

## Route Matrix

| Path | Page | Access |
| --- | --- | --- |
| `/projects` | `ProjectsListPage` | Admin, Manager, Developer (filtered) |
| `/projects/:id` | `ProjectDetailsPage` | Admin, Manager, Assigned Developer |

## Technical Decisions

- **State Management**: Use `useQuery` for project list and details. Use `useMutation` for create/update/progress.
- **Kanban Implementation**: Simple flex/grid layout with three columns (`Pending`, `Active`, `Completed`). No drag-and-drop requested for MVP.
- **Validation**: Zod schemas in `schemas/project-form.schema.ts` and `schemas/module-form.schema.ts`.
- **Icons**:
  - `Table` / `LayoutGrid` (view toggle)
  - `CheckCircle2` (completed status)
  - `PlayCircle` (active status)
  - `Circle` (pending status)
  - `Plus` (add module/project)

# Requirements Checklist: Projects Dashboard

**Feature**: `012-projects-dashboard`

- [ ] **Navigation & Access**
    - [ ] "Projects" link in `AppHeader` (Admin/Manager only).
    - [ ] `/projects` route with RBAC gate.
    - [ ] `/projects/:id` route with RBAC gate.
- [ ] **Dashboard (Table View)**
    - [ ] Responsive table with Project Name, Client, Budget, Progress, Status.
    - [ ] Search/Filter by name or client.
    - [ ] Status badges (color-coded).
    - [ ] Inline progress bar.
- [ ] **Dashboard (Kanban View)**
    - [ ] Toggle switch between Table/Kanban.
    - [ ] Columns: Pending, Active, Completed.
    - [ ] Project cards with key info + progress bar.
- [ ] **Project Details**
    - [ ] Summary card: Client name, Budget, Timeline (dates), Status.
    - [ ] Modules table: Name, Developer, Share %, Progress, Status.
    - [ ] "Activate" button (enabled only when pending & share sum = 70%).
    - [ ] "Add Module" button (Admin/Manager only).
- [ ] **Module Management**
    - [ ] Create Module Dialog: Name, Developer Dropdown, Share %.
    - [ ] Share % cap enforcement (client-side + backend error handling).
    - [ ] Reassign developer affordance.
- [ ] **Developer Progress**
    - [ ] Filtered views: Developers see only their assigned items.
    - [ ] Progress update slider (0-100).
    - [ ] Real-time status sync (0 -> Pending, 1-99 -> In Progress, 100 -> Completed).
- [ ] **Cross-Cutting**
    - [ ] Loading skeletons for list and details.
    - [ ] Error states with retry buttons.
    - [ ] Responsive design (mobile cards vs desktop table).
    - [ ] Accessible forms (ARIA labels, focus states).

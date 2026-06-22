---
id: 016
title: Sidebar role-based access control
stage: tasks
date: 2026-06-21
surface: agent
model: claude-sonnet-4-6
feature: sidebar-rbac
branch: main
user: Muhammad Najam Ul Islam
command: (implicit request)
labels: [frontend, rbac, sidebar, navigation, settings]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - frontend/src/config/navigation.config.ts
  - frontend/src/modules/dashboard/components/Sidebar.tsx
  - frontend/src/modules/dashboard/components/Navbar.tsx
  - frontend/src/modules/dashboard/components/RequireDashboardAccess.tsx
  - frontend/src/modules/auth/components/AppHeader.tsx
  - frontend/src/modules/settings/pages/SettingsPage.tsx
  - frontend/src/modules/settings/index.ts
  - frontend/src/routes.tsx
  - frontend/src/lib/rbac.ts
  - frontend/tests/component/Sidebar.test.tsx
  - frontend/tests/unit/rbac.sidebar.test.ts
  - frontend/tests/component/AppHeader.test.tsx
  - frontend/tests/component/RequireDashboardAccess.test.tsx
  - frontend/tests/helpers/renderWithProviders.tsx
  - backend/app/modules/reporting/service.py
tests:
  - frontend/tests/component/Sidebar.test.tsx (4 tests)
  - frontend/tests/unit/rbac.sidebar.test.ts (7 tests)
  - frontend/tests/component/AppHeader.test.tsx (6 tests)
  - frontend/tests/component/RequireDashboardAccess.test.tsx (4 tests)
  - frontend/tests/component/IfRole.test.tsx (included in 27 total)
---

## Prompt

The Admin can view the full dashboard, but users can only see the Projects, My Earnings and Settings options on the Sidebar menu.

## Response snapshot

**Phase 1 — Codebase analysis**
- Examined Sidebar component at `frontend/src/modules/dashboard/components/Sidebar.tsx`
- Reviewed navigation config at `frontend/src/config/navigation.config.ts`
- Analyzed RBAC patterns at `frontend/src/lib/rbac.ts`
- Identified existing role-based patterns using `IfRole` component and `selectRole` hook

**Phase 2 — Implementation**

1. **Navigation config** (`frontend/src/config/navigation.config.ts`):
   - Added `roles` property to `NavItem` and `NavSection` interfaces
   - Added `ChartDataPoint` to imports
   - Configured role restrictions:
     - Dashboard, Users, Clients, Payments, Notifications, Analytics: admin + manager only
     - My Earnings: developer only
     - Projects: all authenticated users
     - Settings: all authenticated users (no explicit role restrictions)

2. **Sidebar component** (`frontend/src/modules/dashboard/components/Sidebar.tsx`):
   - Added `useSessionStore(selectRole)` to get current user role
   - Added `hasAccess()` helper function to filter navigation items
   - Filtered navigation config to show only items user has access to

3. **Settings page** (`frontend/src/modules/settings/pages/SettingsPage.tsx`):
   - Created new Settings page with profile information display
   - Uses existing AppHeader for navigation

4. **Routes** (`frontend/src/routes.tsx`):
   - Added Settings route at `/settings`

5. **RBAC functions** (`frontend/src/lib/rbac.ts`):
    - Added `canViewEarnings()`, `canViewPayments()`, `canViewNotifications()`, `canViewSettings()` for future use

6. **AppHeader** (`frontend/src/modules/auth/components/AppHeader.tsx`):
    - Added Settings link to navigation bar

7. **RequireDashboardAccess** (`frontend/src/modules/dashboard/components/RequireDashboardAccess.tsx`):
    - Created guard component to block developer access to dashboard route
    - Shows AccessDenied page with link to Projects instead of looping back to `/`

8. **Backend fix** (`backend/app/modules/reporting/service.py`):
    - Added missing `ChartDataPoint` import causing NameError

**Phase 5 — Dashboard page reload fix**
- Developers were seeing infinite reload because dashboard API returned 403
- Added `RequireDashboardAccess` wrapper to redirect developers away from dashboard

**Phase 3 — Tests created**
- Sidebar.test.tsx: Tests for role-based filtering (admin, manager, developer, no session)
- rbac.sidebar.test.ts: Tests for new RBAC functions

**Phase 4 — Validation**
- All 27 frontend tests pass (Sidebar: 4, RBAC sidebar: 7, AppHeader: 6, RequireDashboardAccess: 4, IfRole: 6)
- Backend import verified working
- ESLint passes with no errors
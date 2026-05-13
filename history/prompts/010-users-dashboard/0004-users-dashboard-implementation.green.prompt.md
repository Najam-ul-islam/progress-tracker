---
id: 0004
title: Users dashboard implementation
stage: green
date: 2026-05-13
surface: agent
model: claude-sonnet-4-6
feature: 010-users-dashboard
branch: 010-users-dashboard
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [users, rbac, dashboard, react, tanstack-query, msw]
links:
  spec: specs/010-users-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - frontend/src/components/ui/badge.tsx
  - frontend/src/components/ui/dialog.tsx
  - frontend/src/components/ui/skeleton.tsx
  - frontend/src/components/ui/table.tsx
  - frontend/src/components/ui/select.tsx
  - frontend/src/lib/rbac.ts
  - frontend/src/modules/users/types.ts
  - frontend/src/modules/users/services/users.api.ts
  - frontend/src/modules/users/schemas/users-filter.schema.ts
  - frontend/src/modules/users/schemas/edit-user.schema.ts
  - frontend/src/modules/users/hooks/useUsersList.ts
  - frontend/src/modules/users/hooks/useFilteredUsers.ts
  - frontend/src/modules/users/hooks/useUser.ts
  - frontend/src/modules/users/hooks/useUpdateUser.ts
  - frontend/src/modules/users/hooks/useUpdateUserStatus.ts
  - frontend/src/modules/users/components/IfRole.tsx
  - frontend/src/modules/users/components/RequireUsersAccess.tsx
  - frontend/src/modules/users/components/AccessDenied.tsx
  - frontend/src/modules/users/components/EmptyState.tsx
  - frontend/src/modules/users/components/ErrorState.tsx
  - frontend/src/modules/users/components/RoleBadge.tsx
  - frontend/src/modules/users/components/StatusBadge.tsx
  - frontend/src/modules/users/components/UsersFilters.tsx
  - frontend/src/modules/users/components/UsersTable.tsx
  - frontend/src/modules/users/components/UserProfileCard.tsx
  - frontend/src/modules/users/components/EditUserDialog.tsx
  - frontend/src/modules/users/pages/UsersListPage.tsx
  - frontend/src/modules/users/pages/UserProfilePage.tsx
  - frontend/src/modules/auth/components/AppHeader.tsx
  - frontend/src/modules/auth/store/cross-tab.ts
  - frontend/src/routes.tsx
tests:
  - frontend/tests/unit/rbac.test.ts
  - frontend/tests/unit/users.api.test.ts
  - frontend/tests/unit/users-filter.schema.test.ts
  - frontend/tests/unit/useFilteredUsers.test.ts
  - frontend/tests/unit/edit-user.schema.test.ts
  - frontend/tests/unit/cross-tab-role-change.test.ts
  - frontend/tests/component/RoleBadge.test.tsx
  - frontend/tests/component/IfRole.test.tsx
  - frontend/tests/component/UsersListPage.test.tsx
  - frontend/tests/component/UserProfilePage.test.tsx
  - frontend/tests/component/EditUserDialog.test.tsx
  - frontend/tests/component/AppHeader.test.tsx
  - frontend/tests/component/RequireUsersAccess.test.tsx
  - frontend/tests/component/UsersList.session-expiry.test.tsx
  - frontend/tests/mocks/users-handlers.ts
  - frontend/tests/helpers/renderWithProviders.tsx
---

## Prompt

Implement Users UI with reusable tables, forms, dialogs, and RBAC-aware rendering.

## Response snapshot

Delivered the full P1 stack (US1–US4) for `010-users-dashboard`:

- **Phase 1 (Setup)**: scaffolded `frontend/src/modules/users/{pages,components,hooks,services,schemas}/`, added `@radix-ui/react-dialog`, shipped shadcn primitives (`badge`, `dialog`, `skeleton`, `table`, `select`), domain types incl. `UsersApiError`.
- **Phase 2 (Foundational)**: `lib/rbac.ts` predicates, `usersApi` client with wire↔domain adapter and centralised error mapping, MSW handlers + seeded users, `<IfRole>`/`<IfAdmin>`, `<RequireUsersAccess>`, shared `<EmptyState>`/`<ErrorState>`/`<AccessDenied>` building blocks, render helpers with seedable session store.
- **Phase 3 (US1 list)**: Zod filter schema (URL-params backed), `useUsersList`, pure `useFilteredUsers` (AND-combine, case-insensitive substring), `RoleBadge`/`StatusBadge`, `UsersFilters`, clickable `UsersTable` with row-navigation + admin-only Edit, `UsersListPage` with skeleton/empty/error states, route wired under `RequireAuth` + `RequireUsersAccess`.
- **Phase 4 (US2 profile)**: `useUser` (gated), `UserProfileCard`, `UserProfilePage` with per-id access predicate, not-found/access-denied/error states, admin-only Edit affordance.
- **Phase 5 (US3 edit)**: `editUserSchema` + diff helpers, `useUpdateUser`/`useUpdateUserStatus` mutation hooks that invalidate list + detail caches, `EditUserDialog` (Radix + RHF + zod) sending only changed fields, surfacing 409 inline and 422 per-field. Fixed an infinite re-render: depend the prefill `useEffect` only on `user?.id`, not on `mutation`.
- **Phase 6 (US4 RBAC chrome)**: `AppHeader` gains a `<NavLink to="/users">` behind `IfRole admin|manager`. Cross-tab sync upgraded to also re-hydrate role changes (not just clear). Regression tests cover nav-link visibility, RequireUsersAccess gating, mid-page 401 → `/login?from=/users`, and cross-tab role-change re-render.

Validation: `npx tsc --noEmit` clean; `npx vitest run` → **21/21 files, 111/111 tests pass**.

## Outcome

- ✅ Impact: Users dashboard ships as a vertical slice on top of `009-auth-ui` and `003-users-management`. Admins manage; managers read-only; developers can only view self.
- 🧪 Tests: 111 passing (unit + component); RBAC matrix, schema, filter, API client, mutation flows, session expiry, and cross-tab role change all covered.
- 📁 Files: ~30 source files added/modified; ~15 test files; tasks T001–T051, T053, T054 marked complete in `specs/010-users-dashboard/tasks.md`.
- 🔁 Next prompts: `/sp.implement` for Phase 7 polish (T052 a11y audit, T055 manual verify, T056 README), or commit + PR.
- 🧠 Reflection: `useMutation()` object identity changes per render; depending on it inside `useEffect` deps caused a render storm only surfaced as an OOM during test setup. Lesson: depend on stable primitives or `mutation.reset` directly, not the mutation object.

## Evaluation notes (flywheel)

- Failure modes observed: One infinite-render bug in `EditUserDialog` triggered jsdom OOM during tests; resolved by narrowing the effect's deps to `user?.id`.
- Graders run and results (PASS/FAIL): typecheck PASS; vitest PASS (111/111).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): wire `aria-live` announcement on save success/failure in `EditUserDialog` to close out T052 a11y audit.

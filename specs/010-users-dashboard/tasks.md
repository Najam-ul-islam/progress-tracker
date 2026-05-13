---
description: "Task list for 010-users-dashboard"
---

# Tasks: Users Management Dashboard (Frontend)

**Input**: Design documents in `specs/010-users-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/users-client.md, contracts/rbac-matrix.md, quickstart.md
**Tests**: Included (Vitest unit + component). Playwright e2e deferred (out of scope).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1 / US2 / US3 / US4)
- All file paths are absolute under the repo root

## Path conventions

- Frontend: `frontend/src/`, `frontend/tests/`
- Specs/contracts: `specs/010-users-dashboard/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module scaffolding and shared primitives required by every user story.

- [X] T001 Create module directory tree `frontend/src/modules/users/{pages,components,hooks,services,schemas}/` (empty index/`.gitkeep` as needed)
- [X] T002 Add `@radix-ui/react-dialog` to frontend dependencies in `frontend/package.json` and run `npm install`
- [X] T003 [P] Add shadcn `Badge` primitive at `frontend/src/components/ui/badge.tsx`
- [X] T004 [P] Add shadcn `Dialog` primitive (wraps `@radix-ui/react-dialog`) at `frontend/src/components/ui/dialog.tsx`
- [X] T005 [P] Add shadcn `Skeleton` primitive at `frontend/src/components/ui/skeleton.tsx`
- [X] T006 [P] Add shadcn `Table` primitive at `frontend/src/components/ui/table.tsx`
- [X] T007 [P] Add shadcn `Select` primitive at `frontend/src/components/ui/select.tsx`
- [X] T008 [P] Create domain types in `frontend/src/modules/users/types.ts` per `specs/010-users-dashboard/data-model.md` (User, Role, Status, UsersFilter, EditDraft, DeveloperMetadata)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: RBAC predicates, API client, and base hooks that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Create `frontend/src/lib/rbac.ts` exporting `canViewUsers`, `canEditUsers`, `canViewUserProfile` per `contracts/rbac-matrix.md`
- [X] T010 [P] Unit tests for `lib/rbac.ts` in `frontend/tests/unit/rbac.test.ts` covering the full 3×4 truth table
- [X] T011 Create `frontend/src/modules/users/services/users.api.ts` with `list`, `get`, `update`, `updateStatus`, private `UserWire` / `fromWire` / body builders, and `UsersApiError` per `contracts/users-client.md`
- [X] T012 [P] Unit tests for `users.api.ts` in `frontend/tests/unit/users.api.test.ts` against MSW handlers (covers 200/401/403/404/409/422/network branches and wire↔domain rename)
- [X] T013 [P] MSW handlers for `/users`, `/users/{id}`, `PATCH /users/{id}`, `PATCH /users/{id}/status` in `frontend/tests/mocks/users-handlers.ts`; register in `frontend/tests/mocks/server.ts`
- [X] T014 [P] Create `<IfRole roles={[…]}>` and `<IfAdmin>` boundary components in `frontend/src/modules/users/components/IfRole.tsx`
- [X] T015 [P] Create `<RequireUsersAccess>` route guard in `frontend/src/modules/users/components/RequireUsersAccess.tsx` (uses `canViewUsers` + session store; renders Access Denied state when denied)
- [X] T016 [P] Create shared `<EmptyState>` in `frontend/src/modules/users/components/EmptyState.tsx`
- [X] T017 [P] Create shared `<ErrorState>` in `frontend/src/modules/users/components/ErrorState.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — View and search the users list (Priority: P1) 🎯 MVP

**Goal**: Admin and manager can see every user in a sortable table with role badges, filter by name/email and role/status, and see skeleton / empty / error states. Developer is denied entry to `/users` entirely.

**Independent Test**: Sign in as admin against a seeded dataset of 5+ mixed-role users → `/users` → table renders correctly, role badges visible, search narrows rows without a network call, role filter narrows further; sign in as developer → Access Denied.

### Tests for User Story 1 ⚠️ (write first, ensure fail before implementing)

- [X] T018 [P] [US1] Unit test for `usersFilterSchema` in `frontend/tests/unit/users-filter.schema.test.ts`
- [X] T019 [P] [US1] Unit test for `useFilteredUsers` (q + role + status AND-combine, case-insensitive substring) in `frontend/tests/unit/useFilteredUsers.test.ts`
- [X] T020 [P] [US1] Component test for `UsersListPage` in `frontend/tests/component/UsersListPage.test.tsx` covering: admin renders rows + role badges + Edit affordances; manager renders rows without Edit affordances; developer hits Access Denied; loading skeleton visible before data; empty state on zero matches; error state + retry on fetch failure; row click navigates to `/users/:id`
- [X] T021 [P] [US1] Component test for `RoleBadge` in `frontend/tests/component/RoleBadge.test.tsx` covering colour mapping for admin/manager/developer
- [X] T022 [P] [US1] Component test for `<IfRole>` in `frontend/tests/component/IfRole.test.tsx` covering renders-when-allowed / DOM-absent-when-not

### Implementation for User Story 1

- [X] T023 [P] [US1] Create `usersFilterSchema` (Zod) in `frontend/src/modules/users/schemas/users-filter.schema.ts`
- [X] T024 [P] [US1] Create `useUsersList` hook in `frontend/src/modules/users/hooks/useUsersList.ts` wrapping `useQuery({ queryKey: ["users","list"], queryFn: usersApi.list, staleTime: 30_000, refetchOnWindowFocus: true })`
- [X] T025 [P] [US1] Create `useFilteredUsers` hook in `frontend/src/modules/users/hooks/useFilteredUsers.ts` (pure client-side filter over the list cache)
- [X] T026 [P] [US1] Create `RoleBadge` component in `frontend/src/modules/users/components/RoleBadge.tsx`
- [X] T027 [P] [US1] Create `StatusBadge` component in `frontend/src/modules/users/components/StatusBadge.tsx`
- [X] T028 [P] [US1] Create `UsersFilters` component (search input + role select + status select, URL-search-params backed) in `frontend/src/modules/users/components/UsersFilters.tsx`
- [X] T029 [US1] Create `UsersTable` component (header, rows, row click, inactive-row muting, optional Edit action slot) in `frontend/src/modules/users/components/UsersTable.tsx` (depends on T026, T027)
- [X] T030 [US1] Create `UsersListPage` page in `frontend/src/modules/users/pages/UsersListPage.tsx` wiring `useUsersList` + `useFilteredUsers` + filters + table + loading/empty/error states (depends on T024, T025, T028, T029, T016, T017)
- [X] T031 [US1] Wire `/users` route in `frontend/src/routes.tsx` under `RequireAuth` → `RequireUsersAccess` → `UsersListPage`

**Checkpoint**: User Story 1 fully functional — admin/manager see the list, developer is denied, search/filter work, all states render.

---

## Phase 4: User Story 2 — Open a user profile (Priority: P1)

**Goal**: Admin and manager can open any user's profile by row click or deep link; developer can only open their own.

**Independent Test**: Sign in as admin, click a row → URL becomes `/users/<id>`, profile card renders all fields. Deep-link same URL → same render. Sign in as developer, deep-link to own id → renders; deep-link to other id → Access Denied; deep-link to non-existent id → "User not found".

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Component test for `UserProfilePage` in `frontend/tests/component/UserProfilePage.test.tsx` covering: admin renders any profile with all fields + Edit button visible; manager renders read-only without Edit button; developer-viewing-self renders read-only; developer-viewing-other denied; 404 → "User not found" state with back link; loading skeleton before data; error state + retry

### Implementation for User Story 2

- [X] T033 [P] [US2] Create `useUser` hook in `frontend/src/modules/users/hooks/useUser.ts` wrapping `useQuery({ queryKey: ["users","detail", id], queryFn: () => usersApi.get(id), staleTime: 30_000 })`
- [X] T034 [P] [US2] Create `UserProfileCard` component (name, email, role badge, status badge, created/updated timestamps, optional developer metadata block) in `frontend/src/modules/users/components/UserProfileCard.tsx`
- [X] T035 [US2] Create `UserProfilePage` page wiring `useUser` + access predicate + states (loading / data / not-found / access-denied / error) in `frontend/src/modules/users/pages/UserProfilePage.tsx` (depends on T033, T034, T009)
- [X] T036 [US2] Wire `/users/:id` route in `frontend/src/routes.tsx` under `RequireAuth` → `UserProfilePage` (profile component handles per-id access internally so developer-self deep link works)

**Checkpoint**: Users Story 1 AND 2 work independently.

---

## Phase 5: User Story 3 — Edit a user via modal (Priority: P1)

**Goal**: Admin opens Edit modal from list row or profile, updates name/role/isActive, saves; modal validates, handles errors inline, focus traps, and the change propagates everywhere without reload. Managers and developers have no edit affordance at all (DOM-absent).

**Independent Test**: As admin, open any profile → click Edit → modal opens prefilled → change name → Save → modal closes, profile + list reflect new name; reload → still persisted. Change role → badge updates everywhere. Clear name → field error, no request. Toggle self isActive → backend 409 → inline error, modal stays open. As manager or developer → no Edit button anywhere in the DOM.

### Tests for User Story 3 ⚠️

- [X] T037 [P] [US3] Unit test for `editUserSchema` in `frontend/tests/unit/edit-user.schema.test.ts` (name non-empty, role enum, isActive boolean, "at least one changed field" rule)
- [X] T038 [P] [US3] Component test for `EditUserDialog` in `frontend/tests/component/EditUserDialog.test.tsx` covering: opens prefilled; sends only changed fields; Save shows loading + disabled; closes on success + invalidates queries; field error on empty name (no request); inline 409 error on self-deactivate (modal stays open); network error preserves values; Cancel / Escape / backdrop closes without request; focus trap; non-admin → component renders nothing

### Implementation for User Story 3

- [X] T039 [P] [US3] Create `editUserSchema` (Zod) in `frontend/src/modules/users/schemas/edit-user.schema.ts`
- [X] T040 [P] [US3] Create `useUpdateUser` mutation hook in `frontend/src/modules/users/hooks/useUpdateUser.ts` (calls `usersApi.update`, on success invalidates `["users","list"]` and `["users","detail",id]`)
- [X] T041 [P] [US3] Create `useUpdateUserStatus` mutation hook in `frontend/src/modules/users/hooks/useUpdateUserStatus.ts` (calls `usersApi.updateStatus`, same invalidation)
- [X] T042 [US3] Create `EditUserDialog` component in `frontend/src/modules/users/components/EditUserDialog.tsx` using `Dialog` + RHF + `zodResolver(editUserSchema)`; composes update + updateStatus when both kinds of fields are dirty; surfaces `UsersApiError` per matrix in `contracts/users-client.md`; renders nothing when `!canEditUsers(role)` (depends on T039, T040, T041, T004)
- [X] T043 [US3] Mount `EditUserDialog` from `UserProfilePage` behind `<IfAdmin>` "Edit user" button (modifies `frontend/src/modules/users/pages/UserProfilePage.tsx`)
- [X] T044 [US3] Mount per-row Edit action in `UsersTable` behind `<IfAdmin>` (modifies `frontend/src/modules/users/components/UsersTable.tsx` + `frontend/src/modules/users/pages/UsersListPage.tsx`)

**Checkpoint**: Users Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 — RBAC-aware navigation and affordances (Priority: P1)

**Goal**: Navigation chrome and edit affordances render only for roles that can use them. Developers never see the Users link or anyone else's data. Session expiry mid-page redirects to `/login` with return-to preservation. Cross-tab role change re-renders without reload.

**Independent Test**: Sign in as admin / manager / developer in turn and verify the RBAC matrix exactly: nav link visibility, deep-link behaviour, Edit button visibility. Expire token in DevTools → next interaction → redirected to `/login?from=/users`. Change role in another tab → this tab re-renders without reload.

### Tests for User Story 4 ⚠️

- [X] T045 [P] [US4] Component test for `AppHeader` nav-link visibility in `frontend/tests/component/AppHeader.test.tsx` (admin/manager: link present; developer: link absent)
- [X] T046 [P] [US4] Component test for `RequireUsersAccess` (developer hitting `/users` sees Access Denied, no fetch made) in `frontend/tests/component/RequireUsersAccess.test.tsx`
- [X] T047 [P] [US4] Component test for session-expiry mid-page → 401 → redirect to `/login` with `from=/users` preserved, in `frontend/tests/component/UsersList.session-expiry.test.tsx`
- [X] T048 [P] [US4] Unit test for cross-tab role-change re-render (simulate `storage` event flipping role to developer; verify nav link disappears) in `frontend/tests/unit/cross-tab-role-change.test.ts`

### Implementation for User Story 4

- [X] T049 [US4] Add "Users" link to `AppHeader` in `frontend/src/modules/auth/components/AppHeader.tsx` wrapped in `<IfRole roles={["admin","manager"]}>`
- [X] T050 [US4] Verify (no code change expected) that the existing `http` interceptor's 401 path preserves the `from` URL when redirecting from `/users` and `/users/:id` — add a regression test if it doesn't
- [X] T051 [US4] Verify (no code change expected) that the existing cross-tab `storage` sync from `009-auth-ui` causes `AppHeader` + page contents to re-render against the new role — add a regression test if it doesn't

**Checkpoint**: All four user stories are independently functional and the RBAC matrix is enforced end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Accessibility audit: keyboard-only path through list → profile → modal → save → cancel; screen-reader announcements for modal open/close and save success/failure (SC-007). Document findings in `specs/010-users-dashboard/quickstart.md` under "manual verification".
- [X] T053 [P] Run `npm run typecheck` from `frontend/` and resolve any type errors introduced by this feature
- [X] T054 [P] Run `npm run test` and confirm all new tests pass alongside existing `009-auth-ui` suite
- [ ] T055 Run the 7-step manual verification in `specs/010-users-dashboard/quickstart.md` against a local dev backend + seeded users
- [ ] T056 Update `frontend/README.md` (if present) or add a short note under `frontend/src/modules/users/` describing the module's surface and the RBAC matrix link

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (Setup): no dependencies — start immediately
- Phase 2 (Foundational): depends on Phase 1 — BLOCKS all user stories
- Phase 3–6 (US1 → US4): depend on Phase 2; once foundational is complete, stories can proceed in parallel or strictly P1 order
- Phase 7 (Polish): depends on all user stories being complete

### Within each user story

- Tests are written first and MUST FAIL before implementation
- Schemas / hooks / leaf components (marked [P]) can run in parallel
- Page-level wiring depends on its leaf components
- Routes are wired last in each story

### Cross-story dependencies

- US3 depends on US2 for the "open Edit from profile" entry point (T043)
- US3 depends on US1 for the per-row Edit action (T044)
- US4 depends on US1 for `AppHeader` "Users" link visibility test (T049)

### Parallel opportunities

- All `[P]` tasks within a phase can run in parallel (different files, no shared state)
- Setup primitives T003–T008 can all run in parallel after T002
- Foundational tests T010, T012, T013 can all run in parallel after T009/T011
- Tests for each story (T018–T022, T032, T037–T038, T045–T048) can all run in parallel within their story
- Schemas (T023, T039) and hooks (T024, T025, T033, T040, T041) within their stories can run in parallel

---

## Parallel example: User Story 1 tests

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for usersFilterSchema in frontend/tests/unit/users-filter.schema.test.ts"
Task: "Unit test for useFilteredUsers in frontend/tests/unit/useFilteredUsers.test.ts"
Task: "Component test for UsersListPage in frontend/tests/component/UsersListPage.test.tsx"
Task: "Component test for RoleBadge in frontend/tests/component/RoleBadge.test.tsx"
Task: "Component test for IfRole in frontend/tests/component/IfRole.test.tsx"
```

---

## Implementation strategy

### MVP first (US1 only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — BLOCKS everything else
3. Complete Phase 3 (US1: list + search + RBAC entry)
4. **STOP and VALIDATE** — sign in as each role, exercise the list page
5. Demo if ready

### Incremental delivery

1. Setup + Foundational → foundation ready
2. + US1 → list works (MVP) → demo
3. + US2 → profile works → demo
4. + US3 → editing works → demo
5. + US4 → nav and session edges polished → demo
6. Polish phase

### Parallel team strategy

After Foundational is done:

- Developer A: US1 (list)
- Developer B: US2 (profile) — can mock list with seeded fixture until US1 lands
- Developer C: US3 (modal) — needs US2's profile entry point to be stubbed by Developer B
- Developer D: US4 (RBAC chrome) — independent of A/B/C surfaces

---

## Summary

- **Total tasks**: 56 (T001–T056)
- **Setup**: 8 (T001–T008)
- **Foundational**: 9 (T009–T017)
- **US1 (list)**: 14 (T018–T031) — MVP
- **US2 (profile)**: 5 (T032–T036)
- **US3 (edit modal)**: 8 (T037–T044)
- **US4 (RBAC chrome)**: 7 (T045–T051)
- **Polish**: 5 (T052–T056)
- **Parallelizable tasks**: 35 of 56 marked `[P]`
- **Independent test per story**: defined in each phase header
- **Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1)
- **Format validation**: every task has checkbox, ID, optional [P], story label where applicable, and an explicit file path

---

## Notes

- `[P]` tasks edit different files and have no incomplete dependencies
- `[Story]` label maps a task to its user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

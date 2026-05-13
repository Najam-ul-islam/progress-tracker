# Implementation Plan: Users Management Dashboard (Frontend)

**Branch**: `010-users-dashboard` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-users-dashboard/spec.md`

## Summary

A frontend-only vertical slice that delivers the users-management dashboard on top of the already-deployed `003-users-management` backend and the `009-auth-ui` foundation. Five surfaces: (1) a `/users` list page with client-side search, role and status filters, role badges and skeleton/empty/error states; (2) a `/users/<id>` profile page reachable by row click or deep link; (3) an admin-only Edit user modal (Radix Dialog) covering name/role/status; (4) RBAC-aware navigation that hides the Users link from developers and hides edit affordances from non-admins (DOM-absent, not disabled); (5) an `users.api.ts` service that wraps the backend contract and maps wire snake_case ↔ domain camelCase. No backend changes.

## Technical Context

**Language/Version**: TypeScript 6 (strict), React 19
**Primary Dependencies**: React 19, react-router-dom v7, TanStack Query v5, Axios, React Hook Form, Zod v4, Zustand 5, Tailwind 4, shadcn/ui primitives; new: `@radix-ui/react-dialog` (shadcn dialog primitive)
**Storage**: N/A on the frontend; server state lives in TanStack Query cache, filter state in URL search params, session state in existing Zustand store from `009-auth-ui`
**Testing**: Vitest + jsdom + Testing Library + MSW for unit and component tests; Playwright e2e deferred (out of scope, same policy as `009-auth-ui` MVP)
**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge — last two majors)
**Project Type**: Web application (frontend slice; backend already deployed)
**Performance Goals**: Users list renders skeleton within 200 ms on a slow network; usable view (table or skeleton) within 1 s on broadband (SC-002); admin completes promote-to-manager in under 30 s end-to-end (SC-003)
**Constraints**: Client-side filtering only (no refetch on keystroke per FR-005); list cached and revalidated on window focus (FR-007); modal traps focus (FR-022); affordances must be DOM-absent for non-admins (FR-024); 401 must redirect with return-to preservation (FR-025); cross-tab role-change must re-render without reload (FR-026)
**Scale/Scope**: Single tenant, low-hundreds of users in the directory (Assumptions). Five surfaces, ~20 source files under `frontend/src/modules/users/`, ~10 test files. Server-side pagination is explicitly out of scope for this iteration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | How |
|-----------|------------|-----|
| I. Spec-First Development | ✅ PASS | Spec approved with 0 NEEDS CLARIFICATION; this plan derives directly from it. |
| II. Modular Monolith Architecture | ✅ PASS | New `frontend/src/modules/users/` follows the mandatory frontend module structure: `pages/`, `components/`, `hooks/`, `services/`, `schemas/`. No `store/` needed (filter state in URL, session state already in `auth.store`). |
| III. Deterministic Development | ✅ PASS | Inputs (HTTP responses), outputs (rendered UI), validations (Zod), and business rules (RBAC matrix, last-admin guard from backend) are all explicitly defined below and in spec FR-001..026. |
| IV. Incremental Evolution | ✅ PASS | Builds on `003-users-management` (backend, deployed) and `009-auth-ui` (frontend, merged). Zero backend changes. No refactor of existing modules. |
| V. AI-Native Workflow | ✅ PASS | `/sp.specify` → `/sp.plan` (this) → `/sp.tasks` → `/sp.implement` order observed. PHRs recorded for every prompt. |

| Frontend hard constraint | Compliance | How |
|-----------|------------|-----|
| NO direct API calls in UI components | ✅ PASS | All Axios calls live in `services/users.api.ts`; components consume `hooks/useUsersList`, `useUser`, `useUpdateUser`, `useUpdateUserStatus`. |
| NO business logic in UI components | ✅ PASS | Filter logic in `useFilteredUsers`; RBAC predicates in `lib/rbac` (session-store-driven); validation in `schemas/`. |
| Reusable components required | ✅ PASS | Reuse existing `components/ui/{button,input,label,card,form}.tsx`; add shared primitives (`badge`, `dialog`, `skeleton`, `table`, `select`) under `components/ui/`. Module-local: `RoleBadge`, `StatusBadge`, `EmptyState`, `ErrorState`, `IfRole`. |
| Type safety mandatory (no implicit any) | ✅ PASS | All wire shapes typed; `users.api.ts` returns `User` (domain camelCase); `tsc --noEmit` is a gate. |
| React Hook Form + Zod for all forms | ✅ PASS | `EditUserDialog` uses RHF + `zodResolver(editUserSchema)`. |
| React Query for all server state | ✅ PASS | List, profile, mutations all via TanStack Query v5; cache key conventions documented in Phase 1. |
| Protected routes required | ✅ PASS | `/users` and `/users/<id>` mount under existing `RequireAuth`, then a new `RequireUsersAccess` boundary enforces the role matrix. |
| Role-aware navigation | ✅ PASS | Existing `AppHeader` gains a "Users" link rendered behind `<IfRole roles={["admin","manager"]}>`. |
| Loading/error/empty states required | ✅ PASS | Skeleton, `EmptyState`, `ErrorState` are first-class components used on both list and profile pages. |

**Gate result: PASS.** No violations; Complexity Tracking section below stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-users-dashboard/
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   ├── users-client.md      # Frontend-facing wrapper contract (maps to 003 backend)
│   └── rbac-matrix.md       # Role × surface × affordance matrix
├── checklists/
│   └── requirements.md      # Spec quality checklist (16/16 PASS)
├── spec.md
└── tasks.md                 # Phase 2 output (created by /sp.tasks — NOT this command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── ui/                              # Shared shadcn primitives
│   │       ├── button.tsx                   # exists
│   │       ├── input.tsx                    # exists
│   │       ├── label.tsx                    # exists
│   │       ├── card.tsx                     # exists
│   │       ├── form.tsx                     # exists
│   │       ├── badge.tsx                    # NEW (role/status pills)
│   │       ├── dialog.tsx                   # NEW (Radix wrapper)
│   │       ├── skeleton.tsx                 # NEW (loading shimmer)
│   │       ├── table.tsx                    # NEW (styled <table>)
│   │       └── select.tsx                   # NEW (role/status filter dropdown)
│   ├── lib/
│   │   ├── http.ts                          # exists (auth interceptor)
│   │   ├── query-client.ts                  # exists
│   │   ├── cn.ts                            # exists
│   │   └── rbac.ts                          # NEW (role predicates, route guards)
│   ├── modules/
│   │   ├── auth/                            # exists (009-auth-ui)
│   │   └── users/                           # NEW (this feature)
│   │       ├── pages/
│   │       │   ├── UsersListPage.tsx
│   │       │   └── UserProfilePage.tsx
│   │       ├── components/
│   │       │   ├── UsersTable.tsx
│   │       │   ├── UsersFilters.tsx
│   │       │   ├── RoleBadge.tsx
│   │       │   ├── StatusBadge.tsx
│   │       │   ├── EditUserDialog.tsx
│   │       │   ├── UserProfileCard.tsx
│   │       │   ├── EmptyState.tsx
│   │       │   ├── ErrorState.tsx
│   │       │   ├── IfRole.tsx
│   │       │   └── RequireUsersAccess.tsx
│   │       ├── hooks/
│   │       │   ├── useUsersList.ts
│   │       │   ├── useUser.ts
│   │       │   ├── useUpdateUser.ts
│   │       │   ├── useUpdateUserStatus.ts
│   │       │   └── useFilteredUsers.ts
│   │       ├── services/
│   │       │   └── users.api.ts
│   │       ├── schemas/
│   │       │   ├── edit-user.schema.ts
│   │       │   └── users-filter.schema.ts
│   │       └── types.ts                     # Domain types (User, Role, Status, Filter)
│   ├── routes.tsx                           # MODIFIED (adds /users, /users/:id)
│   └── App.tsx                              # unchanged
└── tests/
    ├── unit/
    │   ├── users.api.test.ts
    │   ├── edit-user.schema.test.ts
    │   ├── users-filter.schema.test.ts
    │   ├── useFilteredUsers.test.ts
    │   └── rbac.test.ts
    ├── component/
    │   ├── UsersListPage.test.tsx
    │   ├── UserProfilePage.test.tsx
    │   ├── EditUserDialog.test.tsx
    │   ├── RoleBadge.test.tsx
    │   └── IfRole.test.tsx
    └── mocks/
        └── users-handlers.ts                # NEW (MSW handlers for /users endpoints)
```

**Structure Decision**: Web-app structure (Option 2). Backend already exists at `backend/`; this slice is purely under `frontend/src/modules/users/` and adheres to the constitution's mandated frontend module layout (pages/components/hooks/services/schemas, optional store/ omitted).

## Phase 0 — Research (see research.md)

Eight decisions captured:

1. **List query strategy** — single `GET /users` fetch, client-side filter (FR-005), revalidate-on-focus (FR-007). Server-side pagination deferred.
2. **Filter state location** — URL search params (`?q=&role=&status=`), not Zustand, so filtered views are shareable/deep-linkable.
3. **Edit form** — Radix Dialog (`@radix-ui/react-dialog` via shadcn `dialog.tsx`) + RHF + Zod. Sends only changed fields (PATCH semantics matching backend).
4. **Cache invalidation** — on successful `PATCH /users/{id}` or `PATCH /users/{id}/status`, invalidate both `["users","list"]` and `["users","detail",id]`.
5. **RBAC enforcement** — predicate-based components (`<IfRole>`, `<IfAdmin>`); affordances are DOM-absent for unauthorized roles (FR-024), not disabled.
6. **Field-rename strategy** — adapter functions in `users.api.ts` map wire `is_active`/`created_at`/`updated_at` → domain `isActive`/`createdAt`/`updatedAt`. UI never touches snake_case.
7. **Self-edit guard** — UI lets the admin attempt self-deactivation; backend returns 409, modal surfaces error inline (FR-019). Optimistic disable considered and rejected to keep one source of truth.
8. **Empty/error/loading taxonomy** — three first-class components (`EmptyState`, `ErrorState`, `<Skeleton>`); applied uniformly on list and profile.

## Phase 1 — Design Artifacts

- **`data-model.md`** — TS types for `User`, `Role`, `Status`, `UsersFilter`, `EditDraft`, plus the wire shapes (`UserWire`, `UpdateUserBodyWire`, `UpdateStatusBodyWire`) and the rename adapter signatures.
- **`contracts/users-client.md`** — frontend-facing contract: function signatures for `usersApi.list()`, `usersApi.get(id)`, `usersApi.update(id, draft)`, `usersApi.updateStatus(id, isActive)`, including request/response shapes, error mapping (401, 403, 404, 409, 422, 5xx), and query-key conventions for TanStack Query.
- **`contracts/rbac-matrix.md`** — explicit role × surface × affordance grid covering nav link, list page, profile page (own / other), Edit button, role select inside modal.
- **`quickstart.md`** — local run instructions and a 7-step manual verification walk-through against the running backend (seed admin/manager/developer accounts, exercise each acceptance scenario).

### Testing Strategy

| Axis | What we test | Tool |
|------|--------------|------|
| Schemas | `editUserSchema` and `usersFilterSchema` accept valid and reject invalid input | Vitest unit |
| API adapter | `usersApi.list/get/update/updateStatus` map wire ↔ domain correctly, surface errors as typed `UsersApiError` | Vitest unit + MSW |
| Hooks | `useFilteredUsers` applies q + role + status correctly; cache invalidation on mutation | Vitest unit + RTL |
| List page | renders rows, skeleton, empty, error; row click navigates; filters update URL | Vitest component + MSW |
| Profile page | renders fields; deep link works; access denied for developer-on-other; 404 for missing | Vitest component + MSW |
| Edit dialog | opens prefilled; sends only changed fields; closes on success; surfaces 409; focus trap; cancel/escape; absent for non-admin | Vitest component + RTL |
| RBAC | nav link visibility; `RequireUsersAccess` redirect/deny; affordance absence | Vitest unit + component |

### Agent Context Update

No new technologies are introduced beyond the existing stack documented in `009-auth-ui`. `@radix-ui/react-dialog` is a peer of shadcn's dialog primitive and does not change the stack-level context. Skipping `update-agent-context.ps1` for this iteration.

## Re-evaluation of Constitution Check (post-design)

After designing the Phase 1 artifacts (data-model, contracts, RBAC matrix, quickstart), every gate above still passes. No new tables of complexity, no new modules outside `modules/users/`, no business logic in UI, no direct API calls in components, no untyped surfaces. **Gate result: PASS.**

## Complexity Tracking

> Empty — no constitution violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |

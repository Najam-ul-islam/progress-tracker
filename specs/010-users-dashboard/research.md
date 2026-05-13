# Research: Users Management Dashboard (Frontend)

**Feature**: 010-users-dashboard
**Date**: 2026-05-12
**Status**: Final

This document records the eight technical decisions made before writing implementation tasks. Each decision is bound to specific functional requirements from `spec.md`.

---

## 1. List query strategy: client-side filter over a single fetch

**Decision**: `GET /users` is called once per mount (and revalidated on window focus), the full list is held in the TanStack Query cache, and all search/role/status filtering happens in the browser.

**Rationale**:
- Spec FR-005 explicitly forbids network requests on filter input.
- Assumptions section commits to low-hundreds of users; a single response is comfortably under a few hundred KB.
- TanStack Query already handles stale-while-revalidate semantics needed by FR-007.

**Alternatives considered**:
- *Server-side `?search=&role=` query params* — rejected because (a) backend has no such filter on the list endpoint per `003-users-management/contracts/openapi.yaml`, (b) introduces network jitter on every keystroke, (c) spec FR-005 forbids it.
- *Hybrid (fetch role-filtered subset on role change)* — rejected: same backend limitation, also doubles cache-invalidation complexity.

**Follow-up trigger**: switch to server-side pagination only after the directory grows past a few thousand users (out of scope for this iteration; documented in spec Out-of-Scope).

---

## 2. Filter state location: URL search params

**Decision**: `q`, `role`, `status` live in the URL as `?q=ada&role=manager&status=active`. A small `useUsersFilter()` hook reads/writes them via `useSearchParams` from react-router-dom v7.

**Rationale**:
- Filtered views become shareable links (a manager can paste a URL into Slack and the recipient sees the same filtered table).
- Browser back/forward replays filter history naturally.
- No Zustand slice needed → fewer state sources, less drift.
- Survives reload without persistence boilerplate.

**Alternatives considered**:
- *Zustand slice* — rejected: not shareable, doesn't survive reload, redundant with URL.
- *Component-local `useState`* — rejected: loses state on every navigation between list and profile.

---

## 3. Edit form: Radix Dialog + RHF + Zod

**Decision**: Add `@radix-ui/react-dialog` as a runtime dependency, expose it through a shadcn-style wrapper at `components/ui/dialog.tsx`, and build `EditUserDialog` with React Hook Form + `zodResolver(editUserSchema)`. The modal sends only fields the admin actually changed (PATCH semantics).

**Rationale**:
- Constitution mandates RHF + Zod for all forms.
- Radix Dialog gives focus trap, escape-to-close, backdrop click, ARIA, and return-focus for free — directly satisfying FR-021 and FR-022.
- shadcn's dialog recipe is well-trodden and matches the project's existing primitive style.
- PATCH-only-changed avoids accidentally overwriting fields the admin didn't touch (mitigates concurrent-edit risk noted in Edge Cases).

**Alternatives considered**:
- *Custom modal* — rejected: re-implementing focus trap and ARIA is a known footgun.
- *Headless UI* — rejected: project has standardized on Radix via shadcn.
- *Send full payload* — rejected: increases concurrent-edit blast radius.

---

## 4. Cache invalidation: surgical pair invalidation

**Decision**: On successful `PATCH /users/{id}` or `PATCH /users/{id}/status`, the mutation invalidates exactly two query keys: `["users", "list"]` and `["users", "detail", id]`. No `setQueryData` optimistic shortcuts.

**Rationale**:
- FR-018 requires the change to be reflected on both the list and the profile without a page reload.
- Backend is the source of truth; invalidate-and-refetch keeps one source.
- Optimistic updates are tempting but would have to be rolled back on 409 (self-deactivation guard), adding state-machine complexity for marginal UX gain.

**Alternatives considered**:
- *Optimistic `setQueryData`* — rejected for the 409 rollback complexity; SC-005 (100% persistence visible after reload) is more reliably met by refetch.
- *Global invalidate (`queryClient.invalidateQueries()`)* — rejected: blows away unrelated caches (auth `/users/me`, future features).

---

## 5. RBAC enforcement: predicate components, DOM-absent affordances

**Decision**: Two helpers in `lib/rbac.ts` — `canViewUsers(role)` and `canEditUsers(role)` — feed two component boundaries: `<IfRole roles={[…]}>` for inline affordances and `<RequireUsersAccess>` for route-level access. Affordances that a role cannot use are simply not rendered (DOM-absent), not rendered-and-disabled.

**Rationale**:
- FR-024 explicitly requires DOM-absence ("MUST NOT exist in the DOM (not just be disabled)").
- Predicate functions are pure and testable in isolation.
- A single source of truth (`lib/rbac.ts`) prevents the nav and the profile page from disagreeing about who can do what.
- The cross-tab role-change requirement (FR-026) falls out for free because the predicate reads from the session store, which already syncs across tabs in `009-auth-ui`.

**Alternatives considered**:
- *Disabled buttons* — rejected: violates FR-024 explicitly.
- *Server-only enforcement (let it 403)* — rejected: spec SC-004 demands zero click→403 surprises, plus it leaks unauthorized affordances visually.

---

## 6. Field-rename strategy: adapter inside the API service

**Decision**: `users.api.ts` contains two small functions, `fromWire(UserWire): User` and `toWire(EditDraft): UpdateUserBodyWire`. Components and hooks see only the domain (camelCase) shape; the snake_case wire shape never leaks past the service layer.

**Rationale**:
- Backend contract is snake_case (`is_active`, `created_at`); rest of frontend codebase is camelCase.
- Centralizing the rename in one file means a backend rename is a one-line change.
- TS types for `UserWire` are declared inside `users.api.ts` and never exported — enforces the boundary at compile time.

**Alternatives considered**:
- *Use snake_case throughout the frontend* — rejected: collides with existing camelCase conventions in `auth/types.ts`.
- *Auto-rename via Axios transform* — rejected: type system can't follow the rename, leading to `any` leakage; violates "no implicit any" hard constraint.

---

## 7. Self-edit guard: trust the backend, surface the error

**Decision**: The UI does NOT pre-empt an admin trying to deactivate themselves or demote the last admin. The modal sends the PATCH, the backend returns 409 with `detail` describing the violation, and the modal renders the message inline (FR-019).

**Rationale**:
- Backend `003-users-management` is the source of truth for invariants like "cannot deactivate self" and "last admin guard".
- Replicating the guard in the UI creates two sources of truth that can drift.
- Spec acceptance scenario US3.6 explicitly describes the "backend returns error, modal renders it" flow.

**Alternatives considered**:
- *Client-side check before submit* — rejected: drift risk, and the backend check still needs to exist anyway.
- *Disable the toggle when editing self* — rejected: violates FR-024 (affordances either render or don't; "disabled" is not a state).

---

## 8. Empty / error / loading taxonomy

**Decision**: Three reusable components live in `modules/users/components/`:

- `<EmptyState title message action />` — used when filters narrow to zero rows.
- `<ErrorState title message onRetry />` — used when fetch fails; the retry button calls `refetch()` from TanStack Query.
- `<Skeleton />` (added to `components/ui/`) — used for table-row and profile-card shimmer.

Each page (list and profile) renders exactly one of `Loading | Error | Empty | Data` at a time.

**Rationale**:
- Constitution mandates loading/error/empty states for all data views.
- A single recipe per page prevents inconsistent UX.
- `Skeleton` ships as a shared primitive (other modules will reuse it).

**Alternatives considered**:
- *Inline ad-hoc messages* — rejected: leads to drift between pages.
- *Generic toast notifications for errors* — rejected: loses the context of which surface failed and which retry to offer.

---

## Resolved NEEDS CLARIFICATION

None. The spec already shipped with zero `[NEEDS CLARIFICATION]` markers; every gap was filled by a documented assumption.

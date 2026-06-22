# Implementation Plan: Notifications Center (Frontend)

**Branch**: `014-notifications-ui` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-notifications-ui/spec.md`

## Summary

Build the consumer-facing notifications center frontend on top of the shipped `008-notifications` backend (`GET /notifications`, `PATCH /notifications/{id}/read`) and the `009-auth-ui` foundation (Axios `http` with 401 interceptor, Zustand session store, TanStack Query, React Router `RequireAuth`, `AppHeader`). Three surfaces — a header **bell + unread badge + dropdown**, a full **`/notifications` page** with `limit`/`offset` paging, and **read/unread controls** (mark-one + client-composed mark-all, optimistic with rollback) — are all backed by **one shared query namespace** so a single invalidation entry point refreshes every surface. That same entry point is the seam a future real-time channel (WebSocket/SSE) plugs into, satisfying the "real-time ready structure" requirement without delivering transport this iteration.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18), Node toolchain via Vite
**Primary Dependencies**: React, React Router, TanStack Query (`@tanstack/react-query`), Axios (`@/lib/http`), TailwindCSS, shadcn/ui primitives, `@radix-ui/react-popover` (NEW — for the accessible dropdown), Zustand (session store, existing)
**Storage**: N/A on the frontend — backend is the source of truth; client cache is TanStack Query only
**Testing**: Vitest + React Testing Library + MSW (`tests/mocks/server.ts`), matching the existing component-test conventions
**Target Platform**: Modern evergreen browsers (SaaS dashboard); responsive across breakpoints
**Project Type**: Web — frontend module added to the existing `frontend/src/modules/` modular structure; no backend changes
**Performance Goals**: Dropdown open renders cached/skeleton in <1s (SC-002); badge reflects `unread_count` on first paint (SC-001); background poll interval default 60s, suppressed when tab hidden
**Constraints**: No new backend endpoints; mark-all composed client-side; background refetch must not flicker/scroll-jump/close-the-open-dropdown (SC-009); no implicit `any`; no API calls inside UI components
**Scale/Scope**: One frontend module (`modules/notifications/`), one route (`/notifications`), one header integration, ~6–8 components, ~4 hooks, 1 service, 1 query-key/invalidation module, 1 realtime-seam stub

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Frontend Standards (constitution §Frontend Standards) — all gates **PASS** by design:

- **Module structure**: New `modules/notifications/` with `pages/`, `components/`, `hooks/`, `services/`, plus a `query-keys`/`realtime` seam. Matches the strictly-enforced layout. ✅
- **No direct API calls in UI components**: All HTTP goes through `services/notifications.api.ts`; components consume `hooks/` only. ✅
- **No business logic in UI components**: Read-state reconciliation, optimistic update, mark-all fan-out, badge-cap formatting live in hooks/services, not JSX. ✅
- **Type safety**: Wire types mapped to domain types via a `fromWire` boundary (mirrors `users.api.ts`); no implicit `any`. ✅
- **React Query for server state**: Single shared query namespace; mutations via `useMutation`. ✅
- **Routing & security**: `/notifications` sits under the existing `RequireAuth` subtree; 401 handled by the existing `http` interceptor (FR-021). No new RBAC gate needed — every role sees only their own feed. ✅
- **UI/UX standards**: Loading (skeleton), error (retry-able), and empty states are explicit requirements for both dropdown and page (FR-005, FR-011); accessible dropdown via Radix Popover (FR-007, SC-008). ✅
- **Forms**: No forms in this feature (no React Hook Form / Zod needed) — read-only feed + mark-read mutations. ✅
- **State management**: TanStack Query for server state; no new Zustand slice required (session store reused). ✅

Reporting & Notifications (constitution §Reporting & Notifications): the notification system must support in-app notifications and be "future-ready: ... WebSocket real-time events." This plan's single-invalidation seam (FR-017/FR-020) directly satisfies the future-ready clause. ✅

**One new dependency** (`@radix-ui/react-popover`) is introduced — justified in Complexity Tracking and research.md. No constitution violation (Radix is the existing primitive family; `@radix-ui/react-dialog` is already a dependency).

**Result: PASS** — no unjustified violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-notifications-ui/
├── plan.md              # This file (/sp.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (consumed backend contract, frozen)
│   └── notifications.frontend.md
├── checklists/
│   └── requirements.md  # From /sp.specify
└── tasks.md             # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/src/
├── modules/
│   └── notifications/                      # NEW module
│       ├── pages/
│       │   └── NotificationsPage.tsx       # US2: full /notifications page + paging
│       ├── components/
│       │   ├── NotificationBell.tsx        # US1: bell + badge, mounts in AppHeader
│       │   ├── NotificationDropdown.tsx    # US1: Radix Popover panel, recent preview
│       │   ├── NotificationItem.tsx        # shared row (dropdown + page variants)
│       │   ├── NotificationTypeIcon.tsx    # type → icon/label, neutral default (FR-022)
│       │   ├── UnreadBadge.tsx             # badge with 99+ cap (FR-003)
│       │   ├── NotificationsEmptyState.tsx # dropdown + page empty copy
│       │   └── NotificationsErrorState.tsx # retry-able inline error
│       ├── hooks/
│       │   ├── useNotificationFeed.ts      # shared feed query (badge+dropdown)
│       │   ├── useNotificationsPage.ts     # paged feed query for the page (US2)
│       │   ├── useMarkRead.ts              # single mark-read, optimistic + rollback
│       │   └── useMarkAllRead.ts           # client-composed mark-all (US3)
│       ├── services/
│       │   ├── notifications.api.ts        # Axios calls + fromWire mapping
│       │   ├── notifications.keys.ts       # query-key factory (single namespace)
│       │   └── notifications.realtime.ts   # FR-020 seam: onNotificationEvent()
│       └── types.ts                        # domain types + NotificationType enum
├── components/ui/
│   └── popover.tsx                         # NEW shadcn-style Radix Popover wrapper
├── modules/auth/components/
│   └── AppHeader.tsx                       # MODIFIED: mount <NotificationBell/>
└── routes.tsx                              # MODIFIED: add /notifications route

frontend/tests/
├── component/
│   ├── NotificationBell.test.tsx           # badge count, cap, zero-hides
│   ├── NotificationDropdown.test.tsx       # open/close, states, view-all, a11y
│   ├── NotificationsPage.test.tsx          # list, paging, states, deep link
│   ├── MarkRead.test.tsx                   # optimistic + rollback + idempotency
│   ├── MarkAllRead.test.tsx                # fan-out, badge→0, persist
│   └── NotificationsRealtime.test.tsx      # single-invalidation updates all surfaces
└── mocks/
    └── notifications-handlers.ts           # NEW MSW handlers; wired into server.ts
```

**Structure Decision**: Web app, frontend-only change. A new `frontend/src/modules/notifications/` follows the constitution's strictly-enforced frontend module layout (`pages/`, `components/`, `hooks/`, `services/`) exactly as `modules/users/` does. The only shared-surface edits are mounting `<NotificationBell/>` in the existing `AppHeader` and registering the `/notifications` route under the existing `RequireAuth` subtree — both minimal, additive diffs. One new shared UI primitive (`components/ui/popover.tsx`) is added because no popover/dropdown primitive exists yet (only `dialog.tsx`).

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|-----------|--------------------------------------|
| Add `@radix-ui/react-popover` | The dropdown needs accessible focus management, Escape-to-close, outside-click dismissal, and ARIA wiring (FR-006, FR-007, SC-008). | A hand-rolled `useEffect`/`onBlur` dropdown reliably gets focus-trap, Escape, and screen-reader semantics wrong; Radix is already the project's primitive family (`@radix-ui/react-dialog` is a dependency), so this is consistent, not new surface area. |
| Client-composed "mark all as read" | The `008-notifications` backend exposes no batch mark-all endpoint; the spec forbids backend changes this iteration. | A new backend endpoint would violate the no-backend-changes scope and require re-running the backend spec workflow. Composing per-unread `PATCH` calls is correct and bounded; flagged as a backend follow-up if it gets chatty (documented in spec Assumptions). |

## Phase 0 — Research

See [research.md](./research.md). All Technical Context unknowns are resolved there: the dropdown-primitive choice (Radix Popover), the single-shared-query / invalidation-namespace design, the real-time-readiness seam, the optimistic-update-with-rollback pattern, the mark-all composition strategy, and the polling/visibility behaviour. No `NEEDS CLARIFICATION` markers remain.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — domain entities (`Notification`, `NotificationFeed`, `FeedPage`), the wire→domain mapping, the query-key namespace, and the read-state transition.
- [contracts/notifications.frontend.md](./contracts/notifications.frontend.md) — the **consumed** backend contract (frozen from `008-notifications`) plus the frontend-internal service/hook/realtime contracts. No new HTTP endpoints are defined; this feature only consumes existing ones.
- [quickstart.md](./quickstart.md) — how to run, manually verify, and test the feature.

### ADR check

Two architecturally significant decisions surfaced (single-query/invalidation namespace as the real-time seam; adding Radix Popover as the dropdown primitive). They are cross-cutting and influence the data layer + shared UI primitives. → ADR suggestion is surfaced to the user after this command (see report).

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design artifacts (research.md, data-model.md, contracts/, quickstart.md):

- **Module structure** — confirmed: the designed file tree matches `pages/`/`components/`/`hooks/`/`services/` exactly. ✅
- **No API in components / no business logic in components** — confirmed: `services/notifications.api.ts` owns all HTTP; `hooks/` own optimistic/rollback/fan-out logic; components are presentational. ✅
- **Type safety** — confirmed: explicit wire→domain `fromWire` boundary; `NotificationType` union; no implicit `any`. ✅
- **React Query server state** — confirmed: single `notificationsKeys` namespace; mutations via `useMutation`. ✅
- **Routing & security** — confirmed: `/notifications` under existing `RequireAuth`; 401 via existing interceptor. ✅
- **UI/UX states** — confirmed: loading/empty/error designed for both dropdown and page; Radix Popover for a11y. ✅
- **New dependency** — `@radix-ui/react-popover` remains the only addition, justified in Complexity Tracking; consistent with existing `@radix-ui/react-dialog`. ✅

**Result: PASS** — design introduces no new violations. Ready for `/sp.tasks`.

## Phase 2 — (Deferred)

`/sp.tasks` generates `tasks.md`. NOT created by this command.

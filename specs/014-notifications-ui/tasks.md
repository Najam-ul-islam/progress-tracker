---
description: "Task list for Notifications Center (Frontend) implementation"
---

# Tasks: Notifications Center (Frontend)

**Input**: Design documents from `/specs/014-notifications-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notifications.frontend.md, quickstart.md

**Tests**: INCLUDED. The spec's Success Criteria (SC-001…SC-009) and per-story Independent Tests require verifiable behaviour, and plan.md specifies 6 component test files + 1 MSW handler module. Tests are written per story and must fail before the matching implementation lands.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 — only on user-story-phase tasks
- All paths are repo-relative under `frontend/`

## Path Conventions

- Module root: `frontend/src/modules/notifications/`
- Shared UI: `frontend/src/components/ui/`
- Tests: `frontend/tests/component/`, MSW mocks: `frontend/tests/mocks/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and scaffold the module folders.

- [X] T001 Add `@radix-ui/react-popover` dependency: run `npm install @radix-ui/react-popover` in `frontend/` and confirm it appears in `frontend/package.json`.
- [X] T002 [P] Create the module folder skeleton with empty index placeholders: `frontend/src/modules/notifications/{pages,components,hooks,services}/` (matching the constitution's frontend module layout).
- [X] T003 [P] Create `frontend/src/components/ui/popover.tsx` — shadcn-style Radix Popover wrapper (`Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`) mirroring the structure of `frontend/src/components/ui/dialog.tsx`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, the wire→domain service, the single shared query-key namespace, the realtime seam, and MSW handlers — everything every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `frontend/src/modules/notifications/types.ts` — `NotificationType` union, `Notification`, `NotificationFeed` interfaces, and constants `POLL_INTERVAL_MS=60000`, `UNREAD_BADGE_CAP=99`, `DROPDOWN_PREVIEW_LIMIT=8`, `PAGE_SIZE=20` (per data-model.md).
- [X] T005 [P] Create `frontend/src/modules/notifications/services/notifications.keys.ts` — `notificationsKeys` factory: `all`, `feed()`, `page(limit, offset)` (single namespace, FR-017).
- [X] T006 Create `frontend/src/modules/notifications/services/notifications.api.ts` — `notificationsApi.getFeed({limit,offset})` and `notificationsApi.markRead(id)` through `@/lib/http`, with a `fromWire` boundary and a `mapAxiosError`-style typed `NotificationsApiError` (`unauthorized|not_found|validation|network|unknown`); `markRead` resolves (not rejects) on 404 (treat stale id as already-gone). Depends on T004.
- [X] T007 [P] Create `frontend/src/modules/notifications/services/notifications.realtime.ts` — export `onNotificationEvent(queryClient)` that calls `invalidateQueries({ queryKey: notificationsKeys.all })` (FR-020 single seam). Depends on T005.
- [X] T008 [P] Add a relative-time helper `formatRelativeTime(iso)` (e.g. "2h ago") — extend `frontend/src/lib/format.ts` (pure, no date lib, per research R8).
- [X] T009 Create `frontend/tests/mocks/notifications-handlers.ts` — `defaultNotificationsHandlers` for `GET /notifications` (seeded envelope honouring `limit`/`offset`) and `PATCH /notifications/:id/read` (returns `{id,is_read:true,read_at}`), plus exported override factories for 500/network-error and 404. Register the defaults in `frontend/tests/mocks/server.ts`. Depends on T004.

**Checkpoint**: Data layer + mocks ready — user stories can begin.

---

## Phase 3: User Story 1 — Header bell, badge & dropdown (Priority: P1) 🎯 MVP

**Goal**: A bell in `AppHeader` shows the unread count and opens a dropdown previewing recent notifications, with loading/empty/error states.

**Independent Test**: Seed a user with 3 unread + 2 read notifications; the bell badge reads "3"; clicking opens a dropdown listing 5 newest-first with unread rows distinct; Escape/outside-click closes it and "View all" navigates to `/notifications`.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T010 [P] [US1] `frontend/tests/component/NotificationBell.test.tsx` — badge shows exact count; hidden at zero (not "0"); renders "99+" above the cap (SC-001, FR-002/FR-003).
- [X] T011 [P] [US1] `frontend/tests/component/NotificationDropdown.test.tsx` — opens on click; lists ≤`DROPDOWN_PREVIEW_LIMIT` newest-first with title/snippet/type/relative-time/unread-marker; loading, empty ("You're all caught up"), and retry-able error states; Escape & outside-click close; focus returns to bell; "View all" → `/notifications` (FR-004…FR-007, SC-002, SC-008).

### Implementation for User Story 1

- [X] T012 [P] [US1] Create `frontend/src/modules/notifications/hooks/useNotificationFeed.ts` — `useQuery` on `notificationsKeys.feed()` with `staleTime:30000`, `refetchInterval:POLL_INTERVAL_MS`, `refetchIntervalInBackground:false`, `refetchOnWindowFocus:true` (FR-017/FR-018/FR-019). Depends on T005, T006.
- [X] T013 [P] [US1] Create `frontend/src/modules/notifications/components/UnreadBadge.tsx` — `count<=0` renders nothing; `count>UNREAD_BADGE_CAP` renders "99+"; else the number (FR-002/FR-003).
- [X] T014 [P] [US1] Create `frontend/src/modules/notifications/components/NotificationTypeIcon.tsx` — map known `NotificationType` → icon+label; unknown → neutral default (FR-022).
- [X] T015 [US1] Create `frontend/src/modules/notifications/components/NotificationItem.tsx` — shared row with `variant:"dropdown"|"page"`; dropdown variant truncates message + relative time; unread marker; renders `NotificationTypeIcon`. Depends on T008, T014.
- [X] T016 [US1] Create `frontend/src/modules/notifications/components/NotificationsEmptyState.tsx` and `NotificationsErrorState.tsx` — friendly empty copy (dropdown + page variants) and retry-able inline error with a "Try again" action (FR-005/FR-011).
- [X] T017 [US1] Create `frontend/src/modules/notifications/components/NotificationDropdown.tsx` — Radix `Popover` panel using `useNotificationFeed`; lists preview rows via `NotificationItem`; loading/empty/error states; "View all" link to `/notifications`; Escape & outside-click dismiss; focus management. Depends on T003, T012, T015, T016.
- [X] T018 [US1] Create `frontend/src/modules/notifications/components/NotificationBell.tsx` — bell button reading `useNotificationFeed` for `unreadCount`, renders `UnreadBadge`, toggles `NotificationDropdown` open state. Depends on T012, T013, T017.
- [X] T019 [US1] Mount `<NotificationBell/>` in `frontend/src/modules/auth/components/AppHeader.tsx` (right-side cluster, before the user/sign-out block; visible to every role). Depends on T018.

**Checkpoint**: US1 fully functional — bell + badge + dropdown work end-to-end against MSW and the live backend.

---

## Phase 4: User Story 2 — Full notifications page (Priority: P1)

**Goal**: A `/notifications` page under `RequireAuth` lists the full feed newest-first with `limit`/`offset` paging and the total count.

**Independent Test**: Seed 60 notifications; navigate to `/notifications`; first page renders newest entries with full bodies + total; paging control loads older entries without reload; deep-link works; signed-out hit redirects to login.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T020 [P] [US2] `frontend/tests/component/NotificationsPage.test.tsx` — renders feed newest-first with full message + total; paging loads the next `offset` slice without reload; skeleton/empty/error states; deep-link `/notifications`; unauthenticated → login (FR-008…FR-011, US2 scenarios, SC-002).

### Implementation for User Story 2

- [X] T021 [P] [US2] Create `frontend/src/modules/notifications/hooks/useNotificationsPage.ts` — `useQuery` on `notificationsKeys.page(limit, offset)` driving the paged view (`PAGE_SIZE` step), exposing `total` and next/prev or load-more control state (FR-010). Depends on T005, T006.
- [X] T022 [US2] Create `frontend/src/modules/notifications/pages/NotificationsPage.tsx` — lists `NotificationItem variant="page"` (full body + absolute timestamp), shows total count, paging affordance, and skeleton/empty/error states. Depends on T015, T016, T021.
- [X] T023 [US2] Register route `{ path: "/notifications", element: <NotificationsPage/> }` under the existing `RequireAuth` subtree in `frontend/src/routes.tsx`, and add a "View all" target consistency check. Depends on T022.

**Checkpoint**: US1 + US2 both work independently — bell preview and full page render the same feed.

---

## Phase 5: User Story 3 — Read/unread controls (Priority: P1)

**Goal**: Mark a single notification read and mark-all-read, optimistic with rollback, reflected across badge/dropdown/page and persisted.

**Independent Test**: With 3 unread (badge "3"), mark one read → badge "2", marker clears on dropdown + page, persists across reload; "Mark all as read" → badge gone, all read after reload; induced failure rolls back to exact prior state with a retry-able error.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T024 [P] [US3] `frontend/tests/component/MarkRead.test.tsx` — optimistic decrement by exactly one across surfaces; rollback to exact prior state on 500/network (SC-005); idempotent re-mark of an already-read row changes nothing (FR-012/FR-014/FR-015, SC-003).
- [X] T025 [P] [US3] `frontend/tests/component/MarkAllRead.test.tsx` — fan-out PATCH for every unread id; badge → 0; persists across reload; partial-failure rolls back still-unread ids with a retry-able error (FR-013, SC-004).

### Implementation for User Story 3

- [X] T026 [P] [US3] Create `frontend/src/modules/notifications/hooks/useMarkRead.ts` — `useMutation(notificationsApi.markRead)` with `onMutate` (cancel `all`, snapshot `feed()`+mounted `page()`, flip `isRead`, decrement `unreadCount`), `onError` (restore snapshot + surface error), `onSettled` (invalidate `all`) (R5). Depends on T005, T006.
- [X] T027 [P] [US3] Create `frontend/src/modules/notifications/hooks/useMarkAllRead.ts` — read cached unread ids, `Promise.allSettled` of `markRead`, optimistic flip-all + badge→0, reconcile on settle, roll back failures (R6). Depends on T005, T006.
- [X] T028 [US3] Wire mark-read into `NotificationItem` (click/open marks read) and `NotificationBell`/dropdown (so the badge updates live). Depends on T026, T015, T018.
- [X] T029 [US3] Add a "Mark all as read" action to `NotificationDropdown.tsx` and `NotificationsPage.tsx` using `useMarkAllRead`. Depends on T027, T017, T022.

**Checkpoint**: US1 + US2 + US3 — read tracking works and the badge clears correctly across all surfaces.

---

## Phase 6: User Story 4 — Real-time-ready freshness (Priority: P2)

**Goal**: Prove a single shared query backs every surface and that one invalidation entry point (`onNotificationEvent`) updates all three — the drop-in seam for future push — with non-disruptive background refetch.

**Independent Test**: Mount badge + dropdown + page; call `onNotificationEvent(queryClient)`; all three reflect updated data via a single invalidation. Polling is suppressed while hidden and resumes on focus; a background refetch does not close an open dropdown or jump scroll.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T030 [P] [US4] `frontend/tests/component/NotificationsRealtime.test.tsx` — with badge+dropdown+page mounted, `onNotificationEvent(queryClient)` updates all three from the single shared cache (SC-007); a background refetch while the dropdown is open leaves it open with no scroll jump (SC-009); polling does not fire while the tab is hidden (FR-018/FR-019).

### Implementation for User Story 4

- [X] T031 [US4] Verify/finalize the shared-query wiring: confirm `useNotificationFeed` (badge+dropdown) and `useNotificationsPage` resolve against `notificationsKeys` such that `invalidateQueries({queryKey: notificationsKeys.all})` refreshes all three; document the seam in a short comment block in `notifications.realtime.ts`. Depends on T007, T012, T021.
- [X] T032 [US4] Confirm background-refetch options (`refetchInterval`, `refetchIntervalInBackground:false`, `refetchOnWindowFocus`) are set on the shared feed query and do not unmount/close the open dropdown; adjust `NotificationDropdown` open-state to be independent of query refetch if needed. Depends on T012, T017.

**Checkpoint**: All four stories independently functional; real-time push is a drop-in via `onNotificationEvent`.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Run `npm run lint` and `npm run build` (tsc) in `frontend/`; fix any type/lint issues (no implicit `any`). NOTE: lint passes clean on all notification files; `tsc` passes clean for the notifications module in isolation. The repo-wide `npm run build` currently fails on **pre-existing untracked WIP** under `src/modules/payments/` and `src/modules/projects/` (unrelated to this feature) — not introduced here.
- [X] T034 [P] Responsive + a11y pass on the dropdown and page (breakpoints, ARIA labels on the bell, SR announcements for open/close and read-state changes) per SC-008. Bell has `aria-label`/`aria-haspopup`; Radix Popover provides `role="dialog"`, focus management, Escape & outside-click; type icons carry `role="img"` + label; error state uses `role="alert"`.
- [X] T035 Run the full `npm run test` sweep in `frontend/` and confirm no regression in existing component tests (AppHeader, users, clients, analytics). 253 tests across 51 files pass.
- [ ] T036 Execute `specs/014-notifications-ui/quickstart.md` manual verification against the running backend (all four user stories). DEFERRED: requires a running backend + live session; not executable in this environment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: all depend on Foundational. US1, US2 can proceed in parallel after Phase 2; US3 depends on US1+US2 surfaces existing (it wires actions into them); US4 verifies the shared layer (lightest after US1/US2).
- **Polish (Phase 7)**: depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: after Phase 2. Foundation of the bell/dropdown — start here (MVP).
- **US2 (P1)**: after Phase 2. Independent of US1 (separate page + hook); shares `NotificationItem`/empty/error components from US1, so sequence US1→US2 if single-threaded.
- **US3 (P1)**: after US1 + US2 (it adds mark-read actions into the dropdown, bell, page). Independently testable via its own test files + MSW.
- **US4 (P2)**: after US1 + US2 (needs badge/dropdown/page mounted to prove single-invalidation). Mostly verification + finalization.

### Within Each User Story

- Tests written first and failing → hooks → presentational components → composite components → mount/route wiring.

### Parallel Opportunities

- Setup: T002, T003 in parallel (T001 first — installs the dep T003 imports).
- Foundational: T004, T005, T008 in parallel; then T006 (needs T004); T007, T009 in parallel (need T005/T004).
- US1: T010, T011 (tests) in parallel; T012, T013, T014 in parallel; then T015→T016→T017→T018→T019.
- US2: T020 alongside US1 tests; T021 parallel with US1 hooks; T022→T023.
- US3: T024, T025 (tests) parallel; T026, T027 (hooks) parallel; then T028, T029.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together (write first, must fail):
Task: "NotificationBell.test.tsx — badge count/cap/zero"
Task: "NotificationDropdown.test.tsx — open/close/states/view-all/a11y"

# Independent building blocks for US1 together:
Task: "useNotificationFeed.ts — shared feed query"
Task: "UnreadBadge.tsx — 99+ cap, zero-hides"
Task: "NotificationTypeIcon.tsx — type→icon, neutral default"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & VALIDATE** the bell+dropdown independently → demo.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 (bell + dropdown) → MVP demo.
3. US2 (full page) → demo.
4. US3 (read/unread) → demo.
5. US4 (real-time-ready verification) → demo. Each story adds value without breaking the previous.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- The single shared query namespace (T005) is the architectural lynchpin — it is what makes US3's cross-surface consistency and US4's single-invalidation seam work.
- No backend changes; mark-all (T027) is composed client-side per spec Assumptions.
- Commit after each task or logical group; verify each story's tests fail before implementing.

# Feature Specification: Notifications Center (Frontend)

**Feature Branch**: `014-notifications-ui`
**Created**: 2026-06-19
**Status**: Draft
**Input**: User description:

> Build notifications center UI.
>
> Features:
> - Notification dropdown
> - Notifications page
> - Read/unread states
> - Real-time ready structure

## Context

The backend `008-notifications` slice already owns the `Notification` entity and the wire contract: `GET /notifications` (returns `{ items, unread_count, total, limit, offset }`), `PATCH /notifications/{id}/read` (idempotent mark-read), `POST /notifications/send` (admin broadcast), and `POST /notifications/scan-deadlines` (admin). Notification rows carry `id`, `title`, `message`, `type` (`assignment | payment | payment_paid | deadline | system`), `is_read`, `read_at`, and `created_at`. The `009-auth-ui` MVP established the frontend foundation (Axios `http`, Zustand `session.store`, TanStack Query, React Router with `RequireAuth`, the `AppHeader` chrome, shadcn primitives) and later dashboards (`010`–`013`) established the page/module conventions this feature follows.

This feature is the **frontend** notifications center layered on top of those slices. It introduces no backend changes. Every authenticated user (admin, manager, developer) has a personal feed — `GET /notifications` always returns only the caller's own notifications regardless of role, so there is no RBAC gate on viewing one's own feed. The admin-only broadcast/scan surfaces are **out of scope** for this feature (this is the consumer-facing center, not the admin sender).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See unread count and recent notifications from the app header (Priority: P1)

An authenticated user (any role) sees a bell icon in the application header. When they have unread notifications, the bell shows a badge with the unread count. Clicking the bell opens a dropdown panel listing their most recent notifications in reverse-chronological order, each showing its title, a snippet of the message, its type, its relative time ("2h ago"), and a visual unread indicator. The dropdown is the at-a-glance surface; the full history lives on the dedicated page (US2).

**Why this priority**: The bell + unread badge is the single most-used notification surface — it is how a user learns, without leaving whatever page they are on, that something happened. Without it the notifications feature is invisible during normal work. It is the smallest end-to-end slice that delivers value: fetch the feed, show the count, render the recent rows.

**Independent Test**: Sign in as a user seeded with 3 unread + 2 read notifications. Confirm the header bell renders a badge reading "3". Click the bell and confirm a dropdown opens listing the 5 notifications newest-first, with the 3 unread rows visually distinct from the 2 read rows, each showing title, message snippet, type, and relative time.

**Acceptance Scenarios**:

1. **Given** a signed-in user with 3 unread notifications, **When** the app header renders, **Then** the bell icon shows a badge with the count "3".
2. **Given** a signed-in user with 0 unread notifications, **When** the app header renders, **Then** the bell icon shows no badge (not "0").
3. **Given** an unread count above a display cap (e.g. > 99), **When** the badge renders, **Then** it shows "99+" rather than the raw number.
4. **Given** the bell is rendered, **When** the user clicks it, **Then** a dropdown panel opens showing the most recent notifications (newest-first) with title, message snippet, type indicator, relative time, and an unread marker on unread entries.
5. **Given** the user has zero notifications, **When** they open the dropdown, **Then** a friendly empty state ("You're all caught up") renders instead of an empty list.
6. **Given** the dropdown is open, **When** the user clicks outside it or presses Escape, **Then** the dropdown closes without side effects.
7. **Given** the feed is still loading, **When** the user opens the dropdown, **Then** a loading/skeleton state renders rather than a flash of empty content.
8. **Given** the feed fetch fails, **When** the user opens the dropdown, **Then** an inline error with a "Try again" affordance renders, and retrying recovers without a page reload.
9. **Given** the dropdown lists notifications, **When** the user clicks a "View all" / "See all notifications" link in the dropdown footer, **Then** they navigate to the full notifications page (US2).

---

### User Story 2 — Browse the full notifications page (Priority: P1)

A user opens a dedicated Notifications page (from the dropdown footer, a header link, or a deep link to `/notifications`) and sees their complete feed in a paginated, reverse-chronological list. Each entry shows title, full message, type, read state, and an absolute/relative timestamp. The page is the durable record the dropdown only previews.

**Why this priority**: The dropdown is bounded (it previews only the most recent few). Users need a place to scroll the full history, page through older entries, and read full message bodies that are truncated in the dropdown. P1 because without it, notifications older than the dropdown preview are unreachable.

**Independent Test**: Sign in as a user with 60 notifications. Navigate to `/notifications`. Confirm the first page renders the newest entries with full message bodies and correct read/unread treatment, the total count is shown, and paging controls load the next page of older entries without a full page reload.

**Acceptance Scenarios**:

1. **Given** a signed-in user with notifications, **When** they navigate to `/notifications`, **Then** a list renders their notifications newest-first, each showing title, full message, type, read state, and timestamp, plus the total count.
2. **Given** the user has more notifications than fit on one page, **When** they reach the end of the first page, **Then** a paging affordance (next page / load more) fetches and appends the next page of older entries.
3. **Given** a user with zero notifications, **When** they open the page, **Then** a friendly empty state renders ("No notifications yet").
4. **Given** the page is loading, **When** data has not arrived after a short delay, **Then** a skeleton/loading state renders.
5. **Given** the fetch fails, **When** the page renders, **Then** an inline error with "Try again" renders and retrying recovers without a reload.
6. **Given** the page is reachable by deep link, **When** the user types `/notifications` directly, **Then** the page loads the same view (subject to `RequireAuth`).
7. **Given** an unauthenticated visitor, **When** they navigate to `/notifications`, **Then** they are redirected to login per the existing `RequireAuth` behaviour.

---

### User Story 3 — Mark notifications as read (Priority: P1)

A user marks notifications as read so the unread badge reflects what they have actually seen. They can mark a single notification read (by clicking/opening it in the dropdown or on the page), and they can mark all currently-unread notifications read in one action. Read state is reflected immediately across every surface (badge, dropdown, page) and persists across reloads.

**Why this priority**: Read/unread tracking is the core value of the unread badge — without the ability to clear it, the count only grows and the badge becomes noise. P1 because US1's badge is only meaningful if the user can act on it.

**Independent Test**: Sign in as a user with 3 unread notifications (badge reads "3"). Mark one unread notification read; confirm the badge drops to "2", that row loses its unread marker on both the dropdown and the page, and a reload still shows it as read. Use "Mark all as read"; confirm the badge disappears and all rows render as read after a reload.

**Acceptance Scenarios**:

1. **Given** an unread notification, **When** the user marks it read (click/open), **Then** the row's unread marker is removed, the unread badge decrements by exactly one, and the change persists across a reload.
2. **Given** a notification that is already read, **When** the user re-triggers mark-read on it, **Then** the call is idempotent — no error, the read timestamp does not change, and the badge does not change.
3. **Given** several unread notifications, **When** the user clicks "Mark all as read", **Then** every currently-unread row becomes read, the badge clears to zero, and the change persists across a reload.
4. **Given** a mark-read request is in flight, **When** the user triggers it, **Then** the UI reflects the new state optimistically and reconciles with the server response; if the request fails, the read state reverts and an error is surfaced.
5. **Given** a mark-read request fails (network/server), **When** it returns, **Then** the optimistic change is rolled back to unread and a retry-able error is shown without a page reload.
6. **Given** the unread count reaches zero, **When** the last unread notification is marked read, **Then** the header badge is removed entirely (not rendered as "0").

---

### User Story 4 — Real-time-ready freshness (Priority: P2)

The notifications data layer is structured so the feed stays reasonably fresh without a manual reload, and so a future real-time channel (WebSocket / SSE / push) can be added without re-architecting the UI. In this iteration freshness is delivered by background refetch (on a polling interval and on window-focus); the data layer exposes a single cache/query that any future push source can invalidate.

**Why this priority**: The user prompt explicitly calls for a "real-time ready structure." Delivering actual server-push is out of scope, but the feed must not require a hard reload to update, and the architecture must make a later push integration a drop-in. P2 because the feature is usable with manual/poll refresh; true push is a later enhancement.

**Independent Test**: Sign in and open the app. Seed a new notification on the backend for this user. Without reloading the page, confirm the unread badge and dropdown reflect the new notification within the refresh window (poll interval or on regaining window focus). Inspect the data layer and confirm a single shared query/cache key backs the badge, dropdown, and page, such that one invalidation updates all three.

**Acceptance Scenarios**:

1. **Given** the app is open and idle, **When** a new notification arrives for the user on the backend, **Then** within the refresh window the unread badge and dropdown reflect it without a manual page reload.
2. **Given** the user switches away from the tab and back, **When** the window regains focus, **Then** the feed refetches and any new notifications appear.
3. **Given** the badge, dropdown, and page are all mounted, **When** the underlying feed query is invalidated (by refetch or a future push event), **Then** all three surfaces update from the single shared cache without independent, divergent fetches.
4. **Given** a future real-time channel is added, **When** it receives a "new notification" signal, **Then** it can update the UI solely by invalidating/patching the existing shared query — no new fetching code paths or component rewrites are required (verified structurally: a single documented invalidation entry point exists).
5. **Given** background refetch is active, **When** it runs, **Then** it MUST NOT disrupt the user (no flicker, no scroll jump, no closing of an open dropdown) and MUST NOT issue redundant overlapping requests.

---

### Edge Cases

- **Badge cap**: An unread count over the display cap renders as "99+"; zero renders as no badge at all (never a "0" badge).
- **Dropdown vs page bound**: The dropdown previews a fixed small number of recent rows (e.g. 5–10); it is not paginated. "View all" is the only path to older entries.
- **Mark-read on a stale id**: Not normally reachable (the feed only ever contains the caller's own rows), but if a stale id 404s, the UI treats it as already-gone and reconciles silently rather than erroring loudly.
- **Optimistic rollback**: If a mark-read or mark-all fails, every optimistically-updated row reverts to its prior state and the badge is recomputed from the reconciled data.
- **Empty states**: Distinct, friendly empty states for the dropdown ("You're all caught up") and the page ("No notifications yet") — never a blank panel.
- **Long content**: Titles and messages are bounded by the backend (≤120 / ≤2000 chars). The dropdown truncates the message to a snippet; the page shows the full body. Neither breaks layout.
- **Type without a known icon**: If a notification `type` is not in the known set, it renders with a neutral default icon/label rather than breaking.
- **Session expiry mid-use**: If a feed refetch returns 401, the existing `http` interceptor / `RequireAuth` flow redirects to login with the return URL preserved — the notifications layer does not implement its own auth handling.
- **Refetch while dropdown open**: A background refetch while the dropdown is open updates the list in place without closing the dropdown or jumping scroll position.
- **Poll while backgrounded**: Polling pauses or no-ops when the tab is hidden and resumes on focus, to avoid wasted requests.

## Requirements *(mandatory)*

### Functional Requirements

#### Header bell & dropdown

- **FR-001**: The application header MUST render a notifications bell icon for every authenticated session, regardless of role.
- **FR-002**: The bell MUST display an unread-count badge when the caller has one or more unread notifications, and MUST display no badge when the unread count is zero.
- **FR-003**: When the unread count exceeds a defined display cap (default 99), the badge MUST render a capped form ("99+").
- **FR-004**: Clicking the bell MUST open a dropdown panel listing the most recent notifications (a fixed, bounded preview count) in reverse-chronological order; each entry MUST show title, a message snippet, a type indicator, a relative timestamp, and an unread marker on unread entries.
- **FR-005**: The dropdown MUST render a loading state while the feed is fetching, an empty state when there are no notifications, and an inline retry-able error state when the fetch fails.
- **FR-006**: The dropdown MUST be dismissable by clicking outside it or pressing Escape, and MUST expose a "View all" affordance that navigates to the notifications page.
- **FR-007**: The dropdown MUST be operable by keyboard (open, navigate entries, activate, dismiss) and MUST manage focus correctly (focus moves into the panel on open and returns to the bell on close).

#### Notifications page

- **FR-008**: A notifications page MUST be reachable at `/notifications`, gated by the existing `RequireAuth`, and MUST be reachable both by navigation affordances and by deep link.
- **FR-009**: The page MUST list the caller's notifications newest-first, each showing title, full message, type, read state, and timestamp, and MUST show the total notification count.
- **FR-010**: The page MUST support paging through the full feed (next page / load more) using the backend's `limit`/`offset` pagination, without a full page reload.
- **FR-011**: The page MUST render a skeleton/loading state, a friendly empty state when there are no notifications, and an inline retry-able error state on fetch failure.

#### Read/unread state

- **FR-012**: A user MUST be able to mark a single notification as read from the dropdown and from the page; the action MUST call the backend mark-read endpoint and MUST be idempotent (re-marking a read notification causes no error and no state change).
- **FR-013**: A user MUST be able to mark all currently-unread notifications as read in a single action; on success the unread badge MUST clear to zero.
- **FR-014**: Mark-read and mark-all MUST update the UI optimistically (row read-marker removed, badge decremented immediately) and MUST reconcile with the server response.
- **FR-015**: If a mark-read or mark-all request fails, the optimistic change MUST roll back to the prior state and a retry-able error MUST be surfaced without a page reload.
- **FR-016**: Read state changes MUST be reflected consistently across every mounted surface (badge, dropdown, page) and MUST persist across reloads (the backend is the source of truth).

#### Data layer & real-time readiness

- **FR-017**: The unread badge, the dropdown, and the page MUST be backed by a single shared query/cache keyed on the caller's feed, so that one invalidation updates all surfaces consistently rather than each surface fetching independently.
- **FR-018**: The feed MUST refresh in the background without a manual reload — at minimum on a configurable polling interval and on window refocus — and background refetches MUST NOT disrupt the user (no flicker, no scroll jump, no closing an open dropdown) nor issue redundant overlapping requests.
- **FR-019**: Background polling MUST pause/no-op while the tab is hidden and resume on focus, to avoid wasted requests.
- **FR-020**: The data layer MUST expose a single documented invalidation/update entry point such that a future real-time channel (WebSocket/SSE/push) can update the UI by invalidating or patching the existing shared query, with no new fetching code paths or component rewrites required.
- **FR-021**: When a feed request returns 401, the layer MUST defer to the existing `http` interceptor / `RequireAuth` redirect-to-login flow (preserving the return URL) and MUST NOT implement bespoke auth handling.
- **FR-022**: A notification whose `type` is outside the known set MUST render with a neutral default icon/label rather than failing to render.

### Key Entities

- **Notification** (from backend): Identifier, title (≤120), message (≤2000), type (`assignment | payment | payment_paid | deadline | system`), `is_read`, `read_at` (nullable), `created_at`. The frontend treats the backend as the source of truth and never fabricates rows.
- **NotificationFeed** (from backend): The envelope returned by `GET /notifications` — `items`, `unread_count`, `total`, `limit`, `offset`. Drives the badge (`unread_count`), the dropdown (recent `items`), and the page (`items` + `total` + paging).
- **FeedQuery** (client-only): The single shared cached query/key that backs all three surfaces; its invalidation entry point is the seam a future real-time channel plugs into.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can tell at a glance how many unread notifications they have — the header badge reflects the backend `unread_count` exactly (including no badge at zero and "99+" above the cap) on first paint.
- **SC-002**: A user can open the dropdown and read their most recent notifications without leaving the current page, in under 1 second on a typical broadband connection (cached or skeleton — never a blank flash).
- **SC-003**: Marking a single notification read decrements the badge by exactly one across all surfaces and persists across a reload, verified by a mark-then-reload test; re-marking an already-read notification changes nothing (idempotency test).
- **SC-004**: "Mark all as read" clears the badge to zero in one action and the change persists across a reload, verified by a mark-all-then-reload test.
- **SC-005**: A failed mark-read/mark-all rolls back the optimistic change to the exact prior state and surfaces a recoverable error in 100% of induced-failure tests, with no page reload.
- **SC-006**: A newly created notification appears in the badge and dropdown without a manual reload within the refresh window (poll interval or on refocus), verified by an integration test that seeds a notification and asserts the UI updates.
- **SC-007**: The badge, dropdown, and page are provably backed by one shared query — a single invalidation updates all three — verified structurally (one cache key, one invalidation entry point) so a future real-time channel is a drop-in.
- **SC-008**: Keyboard-only and screen-reader users can open the dropdown, read entries, mark read, mark all, reach the page, and page through it without a mouse; the dropdown announces open/close and read-state changes.
- **SC-009**: Background refetch never disrupts an in-progress interaction — zero observed flickers, scroll jumps, or dropdown auto-closes across the refetch tests — and polling is suppressed while the tab is hidden.

## Assumptions

- The backend `008-notifications` slice is deployed and its contract (`GET /notifications`, `PATCH /notifications/{id}/read`) is stable; field names, pagination semantics (`limit` default 50 / max 200, `offset`), and the closed `type` enum are pulled from there.
- The `009-auth-ui` foundation is in place: `RequireAuth`, the session store, the `http` Axios instance with its 401 interceptor, TanStack Query, and the `AppHeader` chrome the bell mounts into.
- There is **no** "mark all as read" backend endpoint in the `008-notifications` contract; "mark all" (FR-013) is implemented client-side by issuing mark-read for each currently-unread notification. If this proves too chatty at scale, a batch endpoint becomes a backend follow-up — but it is not required for this iteration.
- The feed fits comfortably in paged responses; the dropdown previews the newest page-slice and the page uses `limit`/`offset` paging. Server-side push is not available yet — freshness is poll + focus-refetch.
- Per-user notification preferences (mute, per-type opt-out), grouping/threading, and notification sound/desktop push are out of scope.
- The display cap for the badge (default 99 → "99+") and the poll interval are configurable constants, not user-facing settings.

## Out of Scope

- The admin **broadcast/send** UI (`POST /notifications/send`) and the **deadline-scan** trigger (`POST /notifications/scan-deadlines`) — this feature is the consumer-facing center, not the admin sender.
- Actual server-push/real-time transport (WebSocket/SSE/web-push). This iteration delivers a real-time-*ready* structure only (FR-017, FR-020).
- A backend "mark all as read" batch endpoint (mark-all is composed client-side for now).
- Per-user notification preferences / muting / per-type subscription management.
- Deleting, editing, archiving, or snoozing notifications — the backend is append + mark-read only.
- Notification grouping, threading, or de-duplication in the UI beyond what the backend already returns.
- Cross-device sync semantics beyond the existing session/auth behaviour.

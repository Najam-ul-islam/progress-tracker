# Quickstart: Notifications Center (Frontend)

## Prerequisites

- Backend `008-notifications` running (provides `GET /notifications`, `PATCH /notifications/{id}/read`).
- Frontend deps installed: `cd frontend && npm install` (adds `@radix-ui/react-popover`).
- A signed-in session (any role) — the feed is per-user and requires auth.

## Run

```bash
# backend (from repo root)
cd backend && uv run uvicorn app.main:app --reload

# frontend
cd frontend && npm run dev
```

Open the app, sign in, and look at the header — the **bell** appears for every role.

## Manual verification (maps to user stories)

**US1 — bell + dropdown**
1. Seed/trigger a few notifications for your user (e.g. get assigned to a module, or have an admin broadcast).
2. Confirm the bell shows a badge with the unread count (no badge when zero; "99+" above 99).
3. Click the bell → dropdown lists recent notifications newest-first with title, snippet, type icon, relative time, unread markers.
4. Press Escape / click outside → dropdown closes, focus returns to the bell.
5. Click "View all" → navigates to `/notifications`.

**US2 — page**
1. Go to `/notifications` (link or deep-link the URL).
2. Confirm the full feed renders newest-first with full message bodies and the total count.
3. If you have more than one page of rows, use the paging control to load older entries (no full reload).
4. Sign out and hit `/notifications` → redirected to login (`RequireAuth`).

**US3 — read/unread**
1. With unread notifications, mark one read → its marker clears and the badge drops by one immediately.
2. Reload → it is still read (persisted).
3. Click "Mark all as read" → badge clears to zero; reload confirms all read.
4. (Failure path) With the network throttled/offline, mark one read → it briefly flips then rolls back, and a retry-able error shows.

**US4 — real-time-ready freshness**
1. Leave the app open. Have a new notification created for your user on the backend.
2. Within ~60s (poll) or on switching back to the tab (focus refetch), the badge/dropdown reflect it — no manual reload.
3. Switch to another tab → polling pauses (no requests while hidden); switch back → it refetches.

## Test

```bash
cd frontend && npm run test
```

New tests (Vitest + RTL + MSW):
- `NotificationBell.test.tsx` — badge count, 99+ cap, zero hides badge.
- `NotificationDropdown.test.tsx` — open/close, loading/empty/error, "View all", Escape & focus return.
- `NotificationsPage.test.tsx` — list render, paging, states, deep link + auth gate.
- `MarkRead.test.tsx` — optimistic decrement, rollback on failure, idempotency on already-read.
- `MarkAllRead.test.tsx` — fan-out PATCH, badge → 0, persistence, partial-failure rollback.
- `NotificationsRealtime.test.tsx` — `onNotificationEvent` invalidation updates badge + dropdown + page (single-seam proof).

## Type-check & lint

```bash
cd frontend && npm run build   # tsc + vite build (no implicit any allowed)
npm run lint
```

## Key files

- Module: `frontend/src/modules/notifications/`
- Shared primitive: `frontend/src/components/ui/popover.tsx`
- Header mount: `frontend/src/modules/auth/components/AppHeader.tsx`
- Route: `frontend/src/routes.tsx` (`/notifications`)
- MSW: `frontend/tests/mocks/notifications-handlers.ts` → registered in `tests/mocks/server.ts`

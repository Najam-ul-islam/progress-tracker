# Frontend Contracts: Notifications Center

This feature defines **no new HTTP endpoints**. It consumes the frozen `008-notifications` backend contract and defines frontend-internal contracts (service, hooks, realtime seam) that the components depend on.

---

## 1. Consumed backend contract (frozen — `008-notifications`)

| Method & path | Purpose | Request | Response (200) | Errors |
|---------------|---------|---------|----------------|--------|
| `GET /notifications` | Caller's own feed, newest-first | query `limit` (1–200, default 50), `offset` (≥0, default 0) | `{ items: NotificationWire[], unread_count, total, limit, offset }` | `401` (→ interceptor), `422` (bad pagination) |
| `PATCH /notifications/{id}/read` | Mark one read (idempotent) | path `id` | `{ id, is_read: true, read_at }` | `401`, `404` (not yours / gone → treat as already-gone) |

Out of scope here (admin sender, not consumed): `POST /notifications/send`, `POST /notifications/scan-deadlines`.

The frontend MUST NOT assume any field beyond those above and MUST tolerate an unknown `type` value (render neutral default).

---

## 2. Service contract (`services/notifications.api.ts`)

```ts
export const notificationsApi = {
  // GET /notifications — maps envelope to domain NotificationFeed.
  getFeed(params: { limit: number; offset: number }): Promise<NotificationFeed>;

  // PATCH /notifications/{id}/read — idempotent; resolves with the read row.
  markRead(id: number): Promise<{ id: number; isRead: true; readAt: string }>;
};
```

- All Axios calls go through `@/lib/http` (Bearer + 401 interceptor already wired).
- Errors mapped through a `mapAxiosError`-style boundary (mirroring `users.api.ts`) into a typed `NotificationsApiError` with codes `unauthorized | not_found | validation | network | unknown`.
- `markRead` MUST resolve (not reject) on `404` by treating it as "already gone" so optimistic rollback isn't triggered for a benign stale id; the `onSettled` reconcile corrects the cache.

---

## 3. Hook contracts (`hooks/`)

```ts
// Shared feed query — backs BOTH the badge and the dropdown (single fetch).
useNotificationFeed(): UseQueryResult<NotificationFeed>;
//   queryKey: notificationsKeys.feed()
//   staleTime: 30_000, refetchInterval: POLL_INTERVAL_MS,
//   refetchIntervalInBackground: false, refetchOnWindowFocus: true

// Paged query for the full page (US2).
useNotificationsPage(limit, offset): UseQueryResult<NotificationFeed>;
//   queryKey: notificationsKeys.page(limit, offset)

// Single mark-read, optimistic + rollback (R5).
useMarkRead(): UseMutationResult<…, Error, number /* id */>;

// Client-composed mark-all (R6): PATCHes every cached-unread id.
useMarkAllRead(): UseMutationResult<…, Error, void>;
```

**Invariants**:
- Every mutation calls `invalidateQueries({ queryKey: notificationsKeys.all })` in `onSettled`.
- `useMarkRead.onMutate` snapshots and patches both `feed()` and any mounted `page(...)` caches; `onError` restores the snapshot exactly.
- No hook issues a fetch outside React Query (no bare `http.get` in components).

---

## 4. Realtime seam contract (`services/notifications.realtime.ts`) — FR-020

```ts
/**
 * THE single entry point a future WebSocket/SSE/push handler calls to make
 * the UI reflect a server-side change. Invalidating notificationsKeys.all
 * refreshes badge + dropdown + page from the one shared cache.
 * A future transport calls this and needs NO other UI changes.
 */
export function onNotificationEvent(queryClient: QueryClient): void;
```

Contract test (SC-007): mounting badge + dropdown + page, then calling `onNotificationEvent(queryClient)`, MUST cause all three to reflect updated data via a single invalidation — proving the drop-in seam.

---

## 5. Component contracts (props surface)

| Component | Key props | Contract |
|-----------|-----------|----------|
| `NotificationBell` | none (reads `useNotificationFeed`) | Renders a button; shows `UnreadBadge` only when `unreadCount > 0`; opens the Popover dropdown on click. |
| `NotificationDropdown` | `open`, `onOpenChange` | Radix Popover; lists ≤`DROPDOWN_PREVIEW_LIMIT` recent rows; loading/empty/error states; "View all" → `/notifications`; Escape & outside-click close; focus returns to bell. |
| `NotificationItem` | `notification`, `variant: "dropdown" \| "page"`, `onMarkRead` | Dropdown variant truncates message; page variant shows full body + absolute time. Unread rows show a marker. |
| `UnreadBadge` | `count` | `count<=0` → renders nothing; `count>CAP` → `"99+"`; else the number. |
| `NotificationTypeIcon` | `type` | Known type → icon+label; unknown → neutral default (FR-022). |
| `NotificationsPage` | none (reads `useNotificationsPage`) | Lists feed newest-first with `total`, paging via `limit`/`offset`, loading/empty/error states; under `RequireAuth`. |

---

## 6. MSW test handler contract (`tests/mocks/notifications-handlers.ts`)

Handlers MUST cover, to exercise the success criteria:
- `GET /notifications` returning a seeded envelope (configurable `items`, `unread_count`, `total`) and honouring `limit`/`offset`.
- `PATCH /notifications/:id/read` returning `{ id, is_read: true, read_at }`; an override that returns `500`/network-error for the rollback test (SC-005); an override returning `404` for the stale-id edge case.

Wire `defaultNotificationsHandlers` into `tests/mocks/server.ts` alongside the existing module handlers.

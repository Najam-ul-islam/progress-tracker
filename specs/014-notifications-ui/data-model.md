# Phase 1 Data Model: Notifications Center (Frontend)

The frontend holds **no persistent storage** — the backend is the source of truth and the only client state is the TanStack Query cache. This document defines the domain types the UI consumes, the wire→domain mapping, the query-key namespace, and the read-state transition.

---

## Wire shapes (from `008-notifications`, frozen — do not modify)

`GET /notifications?limit&offset` → `NotificationFeed` envelope:

```jsonc
{
  "items": [
    {
      "id": 17,
      "title": "Assigned to Acme / Auth module",
      "message": "You were assigned to the Auth module on project Acme.",
      "type": "assignment",          // assignment|payment|payment_paid|deadline|system
      "is_read": false,
      "read_at": null,                // ISO string | null
      "created_at": "2026-06-19T10:12:00Z"
    }
  ],
  "unread_count": 3,
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

`PATCH /notifications/{id}/read` → `MarkReadResponse`:

```jsonc
{ "id": 17, "is_read": true, "read_at": "2026-06-19T10:30:00Z" }
```

---

## Domain types (`modules/notifications/types.ts`)

```ts
export type NotificationType =
  | "assignment"
  | "payment"
  | "payment_paid"
  | "deadline"
  | "system";

export interface Notification {
  id: number;
  title: string;        // ≤120 (backend-enforced)
  message: string;      // ≤2000 (backend-enforced)
  type: NotificationType;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;    // ISO
}

export interface NotificationFeed {
  items: Notification[];
  unreadCount: number;
  total: number;
  limit: number;
  offset: number;
}

export const POLL_INTERVAL_MS = 60_000;
export const UNREAD_BADGE_CAP = 99;       // render "99+" above this
export const DROPDOWN_PREVIEW_LIMIT = 8;  // recent rows in the dropdown
export const PAGE_SIZE = 20;              // page-view limit/offset step
```

### Wire→domain mapping (`fromWire`, in `notifications.api.ts`)

| Wire field      | Domain field  | Note                                  |
|-----------------|---------------|---------------------------------------|
| `id`            | `id`          | passthrough                           |
| `title`         | `title`       | passthrough                           |
| `message`       | `message`     | passthrough                           |
| `type`          | `type`        | union; unknown → rendered as neutral default (FR-022), not coerced |
| `is_read`       | `isRead`      | snake→camel                           |
| `read_at`       | `readAt`      | snake→camel, nullable                 |
| `created_at`    | `createdAt`   | snake→camel                           |
| `unread_count`  | `unreadCount` | envelope                              |
| `total`         | `total`       | envelope                              |

---

## Client-only entities

### FeedQuery (the shared cache, FR-017)

Not a type the UI renders — it is the **cache contract**. Query keys:

```ts
// modules/notifications/services/notifications.keys.ts
export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: () => ["notifications", "feed"] as const,            // badge + dropdown
  page: (limit: number, offset: number) =>
    ["notifications", "page", limit, offset] as const,        // full page
};
```

- **Badge** and **dropdown** both subscribe to `feed()` → one fetch, deduplicated by React Query.
- **Page** uses `page(limit, offset)` per page slice.
- **Invalidation entry point**: `invalidateQueries({ queryKey: notificationsKeys.all })` refreshes everything (prefix match). This is the seam `onNotificationEvent()` (realtime) and every mutation's `onSettled` calls.

### FeedPage (US2 paging)

The page maintains the current `offset` (step `PAGE_SIZE`) and either appends ("load more") or replaces ("next page") slices. `total` from the envelope bounds paging. No infinite-scroll requirement — a simple next/prev or load-more is sufficient (FR-010).

---

## State transitions

### Read state (per notification)

```
unread (isRead=false, readAt=null)
   │  user marks read  →  PATCH /notifications/{id}/read
   ▼
read   (isRead=true,  readAt=<server ts>)   ── terminal, idempotent ──┐
   │                                                                  │
   └──────────────  re-mark read: no-op (read_at unchanged) ──────────┘
```

- The transition is **one-way** (no "mark unread" in this iteration — backend is append + mark-read only).
- **Optimistic**: the cache flips `isRead→true` and decrements `unreadCount` before the server responds; rolled back to the exact snapshot on error (R5).
- **Idempotent**: re-marking a read row does not decrement `unreadCount` and does not change `readAt`.

### Unread count (derived, drives the badge)

- Source of truth: `feed().unreadCount` from the envelope.
- Optimistic mutations adjust it locally; `onSettled` reconciles it with the server.
- Render rule: `0 → no badge`; `1..CAP → exact number`; `> CAP → "CAP+"` (i.e. "99+").

---

## Validation rules (client-side)

The frontend does **not** create or edit notification content, so there is no input validation here. The only client rules are display/interaction guards:

- Badge cap formatting (FR-003).
- Unknown `type` → neutral default render (FR-022).
- Stale-id 404 on mark-read → reconcile silently, no hard error (edge case).
- 401 on any feed request → defer to the existing `http` interceptor / `RequireAuth` (FR-021), no bespoke handling.

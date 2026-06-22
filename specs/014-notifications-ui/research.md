# Phase 0 Research: Notifications Center (Frontend)

All decisions are grounded in the existing codebase (`009-auth-ui` foundation, `010`–`013` dashboard conventions) and the frozen `008-notifications` backend contract. No `NEEDS CLARIFICATION` markers remain.

---

## R1 — Dropdown primitive: Radix Popover vs. hand-rolled vs. shadcn DropdownMenu

**Decision**: Add `@radix-ui/react-popover` and wrap it as `components/ui/popover.tsx` (shadcn style, mirroring the existing `components/ui/dialog.tsx`). The bell trigger + the panel render through it.

**Rationale**:
- The dropdown must close on outside-click and Escape (FR-006), move focus into the panel on open and back to the bell on close (FR-007), and expose correct ARIA semantics for screen readers (SC-008). Radix Popover delivers all of this for free.
- It is **not** a new primitive family: `@radix-ui/react-dialog` is already a dependency and `dialog.tsx` is already the established wrapper pattern — Popover is the consistent sibling.
- Radix DropdownMenu was considered but its menu-item roving-tabindex semantics fit a command menu, not a scrollable list of rich notification rows with links and per-row actions. Popover gives a plain focusable container, which is the right fit.

**Alternatives considered**:
- *Hand-rolled `onBlur`/`useEffect` dropdown*: rejected — reliably gets focus-trap, Escape, and SR semantics subtly wrong; reinvents what Radix already solves.
- *Radix DropdownMenu*: rejected — menu semantics (arrow-key roving, `role="menuitem"`) are wrong for a list of notification cards with embedded "View all" link and mark-read buttons.

---

## R2 — Single shared query backing badge + dropdown + page (FR-017)

**Decision**: One query-key namespace in `services/notifications.keys.ts`:
- `notificationsKeys.feed()` → `["notifications","feed"]` — the recent-feed query that backs **both** the badge (`unread_count`) and the dropdown (`items` preview). One fetch, two consumers.
- `notificationsKeys.page(limit, offset)` → `["notifications","page",limit,offset]` — the paged query for the full page (US2).
- `notificationsKeys.all` → `["notifications"]` — the prefix used for blanket invalidation.

The badge and dropdown both call `useNotificationFeed()`, which reads the **same** cached query — React Query deduplicates, so mounting the bell and opening the dropdown never double-fetches.

**Rationale**: FR-017 requires one invalidation to update all surfaces. Keying the badge and dropdown off a single `feed()` query means one `invalidateQueries({ queryKey: notificationsKeys.all })` refreshes badge, dropdown, and (by prefix) the page. This mirrors the `USERS_QUERY_KEYS` factory pattern already in `users.api.ts`.

**Alternatives considered**:
- *Separate `unreadCount` query + `feed` query*: rejected — two fetches for data the backend already returns in one envelope (`{ items, unread_count, total }`); divergent caches risk a badge that disagrees with the dropdown.

---

## R3 — Real-time-ready seam (FR-020)

**Decision**: `services/notifications.realtime.ts` exports a single function:

```ts
// The ONE entry point a future WebSocket/SSE handler calls.
export function onNotificationEvent(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
}
```

For this iteration there is no transport; `onNotificationEvent` is exercised by tests and is the documented seam. A future `useNotificationsSocket()` hook would call it on each inbound message. Optionally it can `setQueryData` to patch the cache directly instead of refetching — both paths funnel through this one module.

**Rationale**: FR-020 demands that adding push requires "no new fetching code paths or component rewrites." Because every surface already reads the shared query (R2), a push handler only needs to invalidate/patch that query through this single seam. The structural test (SC-007) asserts one invalidation updates all three surfaces.

**Alternatives considered**:
- *Wire polling and push separately into each component*: rejected — duplicates refresh logic across surfaces and violates FR-020's "drop-in" requirement.

---

## R4 — Background freshness: polling + window-focus, paused when hidden (FR-018, FR-019)

**Decision**: `useNotificationFeed()` sets:
- `refetchInterval: 60_000` and `refetchIntervalInBackground: false` — polls every 60s but **not** while the tab is hidden (FR-019).
- `refetchOnWindowFocus: true` — already the global default in `query-client.ts`; refetches when the tab regains focus (FR-018).
- `staleTime: 30_000` — matches the `useUsersList` convention; avoids redundant overlapping fetches.

The poll interval (60s) and the badge cap (99) live as named constants in `types.ts` (`POLL_INTERVAL_MS`, `UNREAD_BADGE_CAP`).

**Rationale**: TanStack Query's `refetchIntervalInBackground: false` is exactly FR-019 ("pause/no-op while hidden, resume on focus"). Background refetches do not unmount components, so the open dropdown stays open and scroll position is preserved (SC-009) — React Query swaps data in place. No bespoke visibility listener needed.

**Alternatives considered**:
- *Manual `document.visibilitychange` listener + `setInterval`*: rejected — reinvents what `refetchInterval`/`refetchIntervalInBackground` already provide and risks overlapping in-flight requests.

---

## R5 — Optimistic mark-read with rollback (FR-014, FR-015)

**Decision**: `useMarkRead()` uses the React Query optimistic pattern:
1. `onMutate(id)`: `cancelQueries(notificationsKeys.all)`, snapshot the feed + page caches, then `setQueryData` to flip the row's `isRead → true` and decrement `unread_count` by one. Return the snapshot in context.
2. `onError(_e,_id,ctx)`: restore the snapshot (rollback to exact prior state) and surface a retry-able error.
3. `onSettled`: `invalidateQueries(notificationsKeys.all)` to reconcile with the server.

Idempotency (FR-012, scenario US3-2): if the row is already read, `onMutate` is a no-op on the cache (no decrement below the current count) and the `PATCH` still returns 200 — `read_at` is unchanged server-side.

A 404 on a stale id (edge case) is treated as "already gone": `onSettled`'s invalidate reconciles silently rather than surfacing a hard error.

**Rationale**: This is the canonical TanStack Query optimistic recipe and matches the spec's exact-prior-state rollback requirement (SC-005). Snapshotting both `feed()` and `page(...)` caches keeps all surfaces consistent.

**Alternatives considered**:
- *Pessimistic (await server, then refetch)*: rejected — FR-014 explicitly requires optimistic update; pessimistic feels laggy on the badge decrement.

---

## R6 — "Mark all as read" composition (FR-013)

**Decision**: `useMarkAllRead()` reads the currently-cached unread notification ids from the shared feed, fires `PATCH /notifications/{id}/read` for each (bounded concurrency, e.g. `Promise.allSettled`), optimistically flips the whole feed to read + badge → 0, and reconciles on settle. Partial failures roll the still-unread ids back and surface a retry-able error.

**Rationale**: The `008-notifications` contract has no batch endpoint and the spec forbids backend changes (documented in spec Assumptions). Composing per-id PATCH is correct and the only in-scope option. `Promise.allSettled` ensures one failed PATCH doesn't abort the rest; the reconcile step makes the final state authoritative.

**Caveat / follow-up**: For a user with hundreds of unread rows this is chatty. If that becomes real, a backend `POST /notifications/mark-all-read` is the follow-up — flagged in spec Out-of-Scope, not built here.

**Alternatives considered**:
- *Block the button behind a backend batch endpoint*: rejected — out of scope; would leave US3 incomplete this iteration.

---

## R7 — Wire→domain mapping & type taxonomy (FR-022)

**Decision**: `services/notifications.api.ts` maps the snake_case wire shape to camelCase domain types via a `fromWire` boundary (mirroring `users.api.ts`). `NotificationType` is a TS union `"assignment" | "payment" | "payment_paid" | "deadline" | "system"`. `NotificationTypeIcon` maps each known type to an icon + label and falls back to a neutral default for any unknown string (FR-022) — the union is treated as open at the render boundary so an unexpected backend value never throws.

**Rationale**: Matches the established `fromWire` convention and the constitution's "no implicit any" + "API-first" rules. The neutral-default fallback satisfies FR-022's resilience requirement.

---

## R8 — Relative-time formatting

**Decision**: Add a small `formatRelativeTime(iso)` helper (e.g. "2h ago", "3d ago") to the notifications module (or extend `@/lib/format.ts`). The page additionally shows an absolute timestamp via the existing locale formatting.

**Rationale**: `@/lib/format.ts` today only covers currency/percent; relative time is a new, small, pure helper. Keeping it pure makes it unit-testable and avoids a date library dependency for this simple need.

**Alternatives considered**:
- *Pull in `date-fns`/`dayjs`*: rejected for now — a one-function need doesn't justify a dependency; revisit if more date math appears.

---

## Resolved unknowns summary

| Unknown (from Technical Context) | Resolution |
|----------------------------------|------------|
| Dropdown primitive | Radix Popover (`components/ui/popover.tsx`) — R1 |
| Single shared query design | `notifications.keys.ts` namespace; badge+dropdown share `feed()` — R2 |
| Real-time seam | `onNotificationEvent(queryClient)` single entry point — R3 |
| Polling / visibility behaviour | `refetchInterval` + `refetchIntervalInBackground:false` + focus refetch — R4 |
| Optimistic + rollback | Canonical `onMutate`/`onError`/`onSettled` recipe — R5 |
| Mark-all without a batch endpoint | Client-composed per-id PATCH, `allSettled` — R6 |
| Type fallback | Open-at-render union + neutral default icon — R7 |
| Relative time | Local pure helper, no date lib — R8 |

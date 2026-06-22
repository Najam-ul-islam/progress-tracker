// Single shared query-key namespace for the notifications feature (FR-017).
//
// The badge and the dropdown both read `feed()` (one deduplicated fetch); the
// page reads `page(limit, offset)`. `all` is the prefix used for blanket
// invalidation — invalidating it refreshes every surface, which is also the
// seam a future real-time channel plugs into (see notifications.realtime.ts).

export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: () => ["notifications", "feed"] as const,
  page: (limit: number, offset: number) =>
    ["notifications", "page", limit, offset] as const,
};

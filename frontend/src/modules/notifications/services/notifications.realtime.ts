import type { QueryClient } from "@tanstack/react-query";
import { notificationsKeys } from "@/modules/notifications/services/notifications.keys";

// THE single entry point a future real-time channel (WebSocket / SSE / push)
// calls to make the UI reflect a server-side change (FR-020).
//
// Because the badge, dropdown, and page all read from the one shared query
// namespace (notificationsKeys), invalidating `all` refreshes every surface at
// once. A future transport hook (e.g. useNotificationsSocket) only needs to call
// this on each inbound message — no new fetching code paths, no component
// rewrites. To avoid a refetch, a transport may instead patch the cache via
// queryClient.setQueryData against the same keys; both paths funnel through here.
export function onNotificationEvent(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
}

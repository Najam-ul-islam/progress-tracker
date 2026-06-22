import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/modules/notifications/services/notifications.api";
import { notificationsKeys } from "@/modules/notifications/services/notifications.keys";
import { DROPDOWN_PREVIEW_LIMIT, POLL_INTERVAL_MS } from "@/modules/notifications/types";

// The shared feed query that backs BOTH the header badge and the dropdown
// (FR-017). React Query deduplicates, so mounting the bell and opening the
// dropdown never double-fetch. Background freshness: polls on an interval but
// not while the tab is hidden (FR-018/FR-019); also refetches on window focus.
export function useNotificationFeed() {
  return useQuery({
    queryKey: notificationsKeys.feed(),
    queryFn: () => notificationsApi.getFeed({ limit: DROPDOWN_PREVIEW_LIMIT, offset: 0 }),
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

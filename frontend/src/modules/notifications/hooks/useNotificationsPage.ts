import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { notificationsApi } from "@/modules/notifications/services/notifications.api";
import { notificationsKeys } from "@/modules/notifications/services/notifications.keys";

// Paged feed query for the full notifications page (US2). Keyed per (limit,
// offset) slice but still under the shared notificationsKeys namespace, so the
// single invalidation entry point refreshes the page alongside the badge and
// dropdown. keepPreviousData avoids a blank flash when paging.
export function useNotificationsPage(limit: number, offset: number) {
  return useQuery({
    queryKey: notificationsKeys.page(limit, offset),
    queryFn: () => notificationsApi.getFeed({ limit, offset }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

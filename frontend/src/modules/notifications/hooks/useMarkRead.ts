import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/modules/notifications/services/notifications.api";
import { notificationsKeys } from "@/modules/notifications/services/notifications.keys";
import type { NotificationFeed } from "@/modules/notifications/types";

type FeedSnapshot = Array<[readonly unknown[], NotificationFeed | undefined]>;

function markIdRead(feed: NotificationFeed, id: number): NotificationFeed {
  let removedUnread = 0;
  const items = feed.items.map((n) => {
    if (n.id === id && !n.isRead) {
      removedUnread += 1;
      return { ...n, isRead: true, readAt: new Date().toISOString() };
    }
    return n;
  });
  return { ...feed, items, unreadCount: Math.max(0, feed.unreadCount - removedUnread) };
}

// Single mark-read with optimistic update + rollback (FR-014/FR-015). Patches
// every cached notifications query (feed + any mounted page) so the badge,
// dropdown, and page stay consistent, then reconciles with the server on settle.
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation<{ id: number }, Error, number, { snapshot: FeedSnapshot }>({
    mutationFn: async (id) => {
      await notificationsApi.markRead(id);
      return { id };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
      const snapshot = queryClient.getQueriesData<NotificationFeed>({
        queryKey: notificationsKeys.all,
      });
      for (const [key, feed] of snapshot) {
        if (feed) queryClient.setQueryData(key, markIdRead(feed, id));
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshot.forEach(([key, feed]) => queryClient.setQueryData(key, feed));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

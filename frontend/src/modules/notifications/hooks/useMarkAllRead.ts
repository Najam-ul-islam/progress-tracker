import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/modules/notifications/services/notifications.api";
import { notificationsKeys } from "@/modules/notifications/services/notifications.keys";
import type { NotificationFeed } from "@/modules/notifications/types";

type FeedSnapshot = Array<[readonly unknown[], NotificationFeed | undefined]>;

function markAllRead(feed: NotificationFeed): NotificationFeed {
  const now = new Date().toISOString();
  const items = feed.items.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: now }));
  return { ...feed, items, unreadCount: 0 };
}

// Client-composed "mark all as read" (FR-013): the backend has no batch
// endpoint, so we PATCH each currently-unread id. Optimistically flips every
// cached feed to read + badge to zero; on failure rolls back to the snapshot.
// Uses allSettled so one failed PATCH doesn't abort the rest; onSettled
// reconciles the final state with the server.
//
// The unread ids are captured in onMutate (which runs before mutationFn) BEFORE
// the optimistic flip, then consumed in mutationFn — otherwise mutationFn would
// read an already-flipped cache and fire zero PATCHes.
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const pendingIds = useRef<number[]>([]);
  return useMutation<void, Error, void, { snapshot: FeedSnapshot }>({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        pendingIds.current.map((id) => notificationsApi.markRead(id))
      );
      if (results.some((r) => r.status === "rejected")) {
        throw new Error("Some notifications could not be marked read");
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
      const feed = queryClient.getQueryData<NotificationFeed>(notificationsKeys.feed());
      pendingIds.current = (feed?.items ?? []).filter((n) => !n.isRead).map((n) => n.id);
      const snapshot = queryClient.getQueriesData<NotificationFeed>({
        queryKey: notificationsKeys.all,
      });
      for (const [key, snap] of snapshot) {
        if (snap) queryClient.setQueryData(key, markAllRead(snap));
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, feed]) => queryClient.setQueryData(key, feed));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

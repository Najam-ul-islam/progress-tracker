import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/modules/notifications/components/NotificationItem";
import { NotificationsEmptyState } from "@/modules/notifications/components/NotificationsEmptyState";
import { NotificationsErrorState } from "@/modules/notifications/components/NotificationsErrorState";
import { useNotificationsPage } from "@/modules/notifications/hooks/useNotificationsPage";
import { useMarkRead } from "@/modules/notifications/hooks/useMarkRead";
import { useMarkAllRead } from "@/modules/notifications/hooks/useMarkAllRead";
import { PAGE_SIZE } from "@/modules/notifications/types";

function PageSkeleton() {
  return (
    <div className="space-y-4" data-testid="notifications-loading">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-slate-100 p-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsPage() {
  const [offset, setOffset] = useState(0);
  const query = useNotificationsPage(PAGE_SIZE, offset);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const feed = query.data;
  const total = feed?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const hasUnread = (feed?.unreadCount ?? 0) > 0;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          {total > 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
          ) : null}
        </div>
        {hasUnread ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <NotificationsErrorState variant="page" onRetry={() => query.refetch()} />
      ) : (feed?.items.length ?? 0) === 0 ? (
        <NotificationsEmptyState variant="page" />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {feed?.items.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  variant="page"
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              </li>
            ))}
          </ul>

          {hasPrev || hasNext ? (
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

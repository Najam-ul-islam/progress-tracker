import { Link } from "react-router-dom";
import { PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/modules/notifications/components/NotificationItem";
import { NotificationsEmptyState } from "@/modules/notifications/components/NotificationsEmptyState";
import { NotificationsErrorState } from "@/modules/notifications/components/NotificationsErrorState";
import { useNotificationFeed } from "@/modules/notifications/hooks/useNotificationFeed";
import { useMarkRead } from "@/modules/notifications/hooks/useMarkRead";
import { useMarkAllRead } from "@/modules/notifications/hooks/useMarkAllRead";
import { DROPDOWN_PREVIEW_LIMIT } from "@/modules/notifications/types";

type NotificationDropdownProps = {
  onNavigate?: () => void;
};

function DropdownSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" data-testid="notifications-loading">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// The Popover panel content: header with "Mark all as read", a scrollable list
// of recent notifications (loading/empty/error states), and a "View all" footer.
export function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const feedQuery = useNotificationFeed();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const feed = feedQuery.data;
  const items = feed?.items.slice(0, DROPDOWN_PREVIEW_LIMIT) ?? [];
  const hasUnread = (feed?.unreadCount ?? 0) > 0;

  return (
    <PopoverContent
      aria-label="Notifications"
      className="flex max-h-[28rem] w-96 flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
        {hasUnread ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {feedQuery.isLoading ? (
          <DropdownSkeleton />
        ) : feedQuery.isError ? (
          <NotificationsErrorState variant="dropdown" onRetry={() => feedQuery.refetch()} />
        ) : items.length === 0 ? (
          <NotificationsEmptyState variant="dropdown" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  variant="dropdown"
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2 text-center">
        <Link
          to="/notifications"
          onClick={onNavigate}
          className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
        >
          View all notifications
        </Link>
      </div>
    </PopoverContent>
  );
}

import { NotificationTypeIcon } from "@/modules/notifications/components/NotificationTypeIcon";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/modules/notifications/types";
import { cn } from "@/lib/cn";

type NotificationItemProps = {
  notification: Notification;
  variant: "dropdown" | "page";
  onMarkRead?: (id: number) => void;
};

// Shared notification row. The dropdown variant truncates the message and shows
// a relative time; the page variant shows the full body and an absolute time.
// Unread rows carry a marker and (when onMarkRead is provided) a mark-read
// affordance.
export function NotificationItem({ notification, variant, onMarkRead }: NotificationItemProps) {
  const { id, title, message, type, isRead, createdAt } = notification;
  const isDropdown = variant === "dropdown";

  return (
    <div
      data-testid="notification-item"
      data-read={isRead ? "true" : "false"}
      className={cn(
        "flex gap-3 px-4 py-3",
        !isRead && "bg-sky-50/60"
      )}
    >
      <NotificationTypeIcon type={type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm text-slate-900", !isRead && "font-semibold")}>{title}</p>
          {!isRead ? (
            <span
              data-testid="unread-dot"
              aria-label="Unread"
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500"
            />
          ) : null}
        </div>
        <p
          className={cn(
            "mt-0.5 text-sm text-slate-600",
            isDropdown && "line-clamp-2"
          )}
        >
          {message}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <time
            dateTime={createdAt}
            title={formatDateTime(createdAt)}
            className="text-xs text-slate-400"
          >
            {isDropdown ? formatRelativeTime(createdAt) : formatDateTime(createdAt)}
          </time>
          {!isRead && onMarkRead ? (
            <button
              type="button"
              onClick={() => onMarkRead(id)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
            >
              Mark as read
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

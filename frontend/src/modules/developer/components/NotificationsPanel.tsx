import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { useNotificationFeed } from "@/modules/notifications/hooks/useNotificationFeed";
import { formatRelativeTime } from "@/lib/format";
import { Link } from "react-router-dom";

const RELEVANT_TYPES = ["assignment", "deadline", "payment", "payment_paid"] as const;

function getNotificationLabel(type: string): string {
  const labels: Record<string, string> = {
    assignment: "New assignment",
    deadline: "Deadline reminder",
    payment: "Payment received",
    payment_paid: "Payment completed",
    system: "System update",
  };
  return labels[type] ?? "Notification";
}

export function NotificationsPanel() {
  const query = useNotificationFeed();

  if (query.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="Couldn't load notifications" message="Try refreshing the page." />
        </CardContent>
      </Card>
    );
  }

  const allNotifications = query.data?.items ?? [];
  const notifications = allNotifications.filter((n) =>
    (RELEVANT_TYPES as readonly string[]).includes(n.type)
  );

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="All caught up"
            message="No new notifications for your work."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
          <Link
            to="/notifications"
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200 w-full"
          >
            View all
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface NotificationItemProps {
  notification: {
    id: number;
    title: string;
    message: string;
    type: string;
    createdAt: string;
    isRead: boolean;
  };
}

function NotificationItem({ notification }: NotificationItemProps) {
  const { title, message, type, createdAt, isRead } = notification;

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className={`mt-0.5 h-2 w-2 rounded-full ${isRead ? "bg-slate-300" : "bg-indigo-600"}`} />
      <div className="flex-1">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{message}</div>
        <div className="mt-1 text-xs text-slate-400">
          {getNotificationLabel(type)} • {formatRelativeTime(createdAt)}
        </div>
      </div>
    </div>
  );
}
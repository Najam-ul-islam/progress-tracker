import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { UnreadBadge } from "@/modules/notifications/components/UnreadBadge";
import { NotificationDropdown } from "@/modules/notifications/components/NotificationDropdown";
import { useNotificationFeed } from "@/modules/notifications/hooks/useNotificationFeed";

// Header bell for every authenticated role. Reads the shared feed query for the
// unread count and toggles the Radix Popover dropdown. The open state is local
// and independent of query refetch, so a background poll never closes the panel.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const feedQuery = useNotificationFeed();
  const unreadCount = feedQuery.data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          aria-haspopup="dialog"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <UnreadBadge count={unreadCount} />
        </button>
      </PopoverTrigger>
      <NotificationDropdown onNavigate={() => setOpen(false)} />
    </Popover>
  );
}

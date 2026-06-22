import { Inbox } from "lucide-react";

type NotificationsEmptyStateProps = {
  variant: "dropdown" | "page";
};

export function NotificationsEmptyState({ variant }: NotificationsEmptyStateProps) {
  const heading = variant === "dropdown" ? "You're all caught up" : "No notifications yet";
  const sub =
    variant === "dropdown"
      ? "New notifications will show up here."
      : "When something happens, you'll see it here.";
  return (
    <div
      data-testid="notifications-empty"
      className="flex flex-col items-center gap-2 px-4 py-10 text-center"
    >
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-700">{heading}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

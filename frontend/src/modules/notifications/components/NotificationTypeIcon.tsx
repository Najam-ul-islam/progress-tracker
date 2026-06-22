import { Bell, CircleDollarSign, CalendarClock, UserPlus, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@/modules/notifications/types";
import { cn } from "@/lib/cn";

type IconMeta = { Icon: LucideIcon; label: string; className: string };

const KNOWN: Record<NotificationType, IconMeta> = {
  assignment: { Icon: UserPlus, label: "Assignment", className: "text-sky-600 bg-sky-50" },
  payment: { Icon: CircleDollarSign, label: "Payment", className: "text-emerald-600 bg-emerald-50" },
  payment_paid: { Icon: CircleDollarSign, label: "Payment paid", className: "text-emerald-700 bg-emerald-50" },
  deadline: { Icon: CalendarClock, label: "Deadline", className: "text-amber-600 bg-amber-50" },
  system: { Icon: Megaphone, label: "System", className: "text-slate-600 bg-slate-100" },
};

// Neutral default for any unknown/unexpected type value (FR-022).
const DEFAULT: IconMeta = { Icon: Bell, label: "Notification", className: "text-slate-500 bg-slate-100" };

type NotificationTypeIconProps = {
  type: string;
};

export function NotificationTypeIcon({ type }: NotificationTypeIconProps) {
  const meta = (KNOWN as Record<string, IconMeta>)[type] ?? DEFAULT;
  const { Icon, label, className } = meta;
  return (
    <span
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", className)}
      role="img"
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

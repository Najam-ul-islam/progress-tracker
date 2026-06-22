import { UNREAD_BADGE_CAP } from "@/modules/notifications/types";

type UnreadBadgeProps = {
  count: number;
};

// Renders the unread-count pill on the bell. Nothing at zero (never a "0"
// badge), the raw count up to the cap, and "99+" above it (FR-002/FR-003).
export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null;
  const label = count > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(count);
  return (
    <span
      data-testid="unread-badge"
      aria-label={`${count} unread notifications`}
      className="absolute -right-1 -top-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[0.625rem] font-semibold leading-tight text-white"
    >
      {label}
    </span>
  );
}

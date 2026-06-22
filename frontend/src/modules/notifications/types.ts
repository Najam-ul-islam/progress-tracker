// Domain types for the notifications center. The backend (008-notifications) is
// the source of truth; these are the camelCase shapes the UI consumes after the
// fromWire boundary in services/notifications.api.ts.

export type NotificationType =
  | "assignment"
  | "payment"
  | "payment_paid"
  | "deadline"
  | "system";

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  items: Notification[];
  unreadCount: number;
  total: number;
  limit: number;
  offset: number;
}

export type NotificationsApiErrorCode =
  | "unauthorized"
  | "not_found"
  | "validation"
  | "network"
  | "unknown";

export const POLL_INTERVAL_MS = 60_000;
export const UNREAD_BADGE_CAP = 99;
export const DROPDOWN_PREVIEW_LIMIT = 8;
export const PAGE_SIZE = 20;

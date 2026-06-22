import { AxiosError } from "axios";
import { http } from "@/lib/http";
import type {
  Notification,
  NotificationFeed,
  NotificationsApiErrorCode,
  NotificationType,
} from "@/modules/notifications/types";

type NotificationWire = {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type FeedWire = {
  items: NotificationWire[];
  unread_count: number;
  total: number;
  limit: number;
  offset: number;
};

type MarkReadWire = {
  id: number;
  is_read: boolean;
  read_at: string;
};

export class NotificationsApiError extends Error {
  readonly code: NotificationsApiErrorCode;
  readonly status: number;
  constructor(code: NotificationsApiErrorCode, message: string, status = 0) {
    super(message);
    this.name = "NotificationsApiError";
    this.code = code;
    this.status = status;
  }
}

function notificationFromWire(w: NotificationWire): Notification {
  return {
    id: w.id,
    title: w.title,
    message: w.message,
    // The type union is treated as open at this boundary; an unknown value is
    // preserved and rendered with a neutral default downstream (FR-022).
    type: w.type as NotificationType,
    isRead: w.is_read,
    readAt: w.read_at,
    createdAt: w.created_at,
  };
}

function feedFromWire(w: FeedWire): NotificationFeed {
  return {
    items: w.items.map(notificationFromWire),
    unreadCount: w.unread_count,
    total: w.total,
    limit: w.limit,
    offset: w.offset,
  };
}

function mapAxiosError(err: unknown): never {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as { detail?: unknown } | undefined;
    const detailText = typeof data?.detail === "string" ? data.detail : undefined;

    let code: NotificationsApiErrorCode;
    let message: string;
    switch (status) {
      case 401:
        code = "unauthorized";
        message = "Session expired";
        break;
      case 404:
        code = "not_found";
        message = detailText ?? "Notification not found";
        break;
      case 400:
      case 422:
        code = "validation";
        message = detailText ?? "Validation failed";
        break;
      default:
        if (err.code === "ERR_NETWORK" || !err.response) {
          code = "network";
          message = "Can't reach the server. Please try again.";
        } else {
          code = "unknown";
          message = detailText ?? "Something went wrong";
        }
    }
    throw new NotificationsApiError(code, message, status ?? 0);
  }
  throw new NotificationsApiError("unknown", "Unexpected error");
}

async function getFeed(params: { limit: number; offset: number }): Promise<NotificationFeed> {
  try {
    const res = await http.get<FeedWire>("/notifications", { params });
    return feedFromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

export type MarkReadResult = { id: number; isRead: true; readAt: string | null };

async function markRead(id: number): Promise<MarkReadResult> {
  try {
    const res = await http.patch<MarkReadWire>(`/notifications/${id}/read`);
    return { id: res.data.id, isRead: true, readAt: res.data.read_at };
  } catch (err) {
    // A 404 means the notification is gone / not ours — treat as already-read so
    // optimistic flows reconcile silently instead of surfacing a hard error.
    if (err instanceof AxiosError && err.response?.status === 404) {
      return { id, isRead: true, readAt: null };
    }
    mapAxiosError(err);
  }
}

export const notificationsApi = {
  getFeed,
  markRead,
};

import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

export type NotificationSeed = {
  id: number;
  title: string;
  message: string;
  type: "assignment" | "payment" | "payment_paid" | "deadline" | "system";
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string;
};

export const seededNotifications: NotificationSeed[] = [
  {
    id: 1,
    title: "Assigned to Acme / Auth module",
    message: "You were assigned to the Auth module on project Acme.",
    type: "assignment",
    is_read: false,
    created_at: "2026-06-19T10:00:00Z",
  },
  {
    id: 2,
    title: "Payment generated",
    message: "A payment of $350.00 was generated for you.",
    type: "payment",
    is_read: false,
    created_at: "2026-06-19T09:30:00Z",
  },
  {
    id: 3,
    title: "Deadline approaching",
    message: "Project Acme is due in 3 days.",
    type: "deadline",
    is_read: false,
    created_at: "2026-06-19T09:00:00Z",
  },
  {
    id: 4,
    title: "Payment marked paid",
    message: "Your payment of $350.00 was marked paid.",
    type: "payment_paid",
    is_read: true,
    read_at: "2026-06-18T12:00:00Z",
    created_at: "2026-06-18T11:00:00Z",
  },
  {
    id: 5,
    title: "Scheduled maintenance",
    message: "The platform will be down for maintenance on Sunday.",
    type: "system",
    is_read: true,
    read_at: "2026-06-17T08:00:00Z",
    created_at: "2026-06-17T07:00:00Z",
  },
];

function normalize(n: NotificationSeed) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.is_read ?? false,
    read_at: n.read_at ?? null,
    created_at: n.created_at ?? "2026-06-19T00:00:00Z",
  };
}

function feedEnvelope(all: NotificationSeed[], limit: number, offset: number) {
  // Newest-first by created_at, then paginate.
  const sorted = [...all].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );
  const page = sorted.slice(offset, offset + limit).map(normalize);
  const unread = all.filter((n) => !(n.is_read ?? false)).length;
  return {
    items: page,
    unread_count: unread,
    total: all.length,
    limit,
    offset,
  };
}

export const notificationsFeedSuccess = (all: NotificationSeed[] = seededNotifications) =>
  http.get(`${BASE}/notifications`, ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return HttpResponse.json(feedEnvelope(all, limit, offset));
  });

export const notificationsFeedUnauthorized = () =>
  http.get(`${BASE}/notifications`, () =>
    HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 })
  );

export const notificationsFeedNetworkError = () =>
  http.get(`${BASE}/notifications`, () => HttpResponse.error());

export const markReadSuccess = () =>
  http.patch(`${BASE}/notifications/:id/read`, ({ params }) =>
    HttpResponse.json({
      id: Number(params.id),
      is_read: true,
      read_at: "2026-06-19T10:30:00Z",
    })
  );

export const markReadNotFound = () =>
  http.patch(`${BASE}/notifications/:id/read`, () =>
    HttpResponse.json({ detail: "Notification not found" }, { status: 404 })
  );

export const markReadServerError = () =>
  http.patch(`${BASE}/notifications/:id/read`, () =>
    HttpResponse.json({ detail: "Internal error" }, { status: 500 })
  );

export const markReadNetworkError = () =>
  http.patch(`${BASE}/notifications/:id/read`, () => HttpResponse.error());

export const defaultNotificationsHandlers = [
  notificationsFeedSuccess(),
  markReadSuccess(),
];

/**
 * Stateful handler pair: PATCH /notifications/:id/read flips the in-memory copy
 * to read so a subsequent GET /notifications reflects the change. Use this when
 * a test exercises the full optimistic-update → server-reconcile cycle (mark
 * read / mark all) and needs the refetched feed to agree with the mutation.
 */
export function statefulNotificationsHandlers(seed: NotificationSeed[] = seededNotifications) {
  const state: NotificationSeed[] = seed.map((n) => ({ ...n }));
  return [
    http.get(`${BASE}/notifications`, ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      return HttpResponse.json(feedEnvelope(state, limit, offset));
    }),
    http.patch(`${BASE}/notifications/:id/read`, ({ params }) => {
      const id = Number(params.id);
      const row = state.find((n) => n.id === id);
      if (!row) {
        return HttpResponse.json({ detail: "Notification not found" }, { status: 404 });
      }
      row.is_read = true;
      row.read_at = "2026-06-19T10:30:00Z";
      return HttpResponse.json({ id, is_read: true, read_at: row.read_at });
    }),
  ];
}

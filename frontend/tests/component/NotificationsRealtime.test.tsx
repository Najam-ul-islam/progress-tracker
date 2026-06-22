import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../mocks/server";
import { notificationsFeedSuccess, type NotificationSeed } from "../mocks/notifications-handlers";
import { clearSession, seedSession } from "../helpers/renderWithProviders";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { onNotificationEvent } from "@/modules/notifications/services/notifications.realtime";

afterEach(() => clearSession());

function oneUnread(n: number): NotificationSeed[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: i + 1,
    title: `N${i + 1}`,
    message: "m",
    type: "system",
    is_read: false,
    created_at: `2026-06-19T${String(12 - i).padStart(2, "0")}:00:00Z`,
  }));
}

describe("Real-time-ready single-invalidation seam", () => {
  it("onNotificationEvent updates the badge from the shared cache without a manual reload", async () => {
    server.use(notificationsFeedSuccess(oneUnread(1)));
    seedSession({ role: "developer", id: 3 });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("1")).toBeInTheDocument();

    // Simulate a server-side change + a future push channel firing the seam.
    server.use(notificationsFeedSuccess(oneUnread(4)));
    onNotificationEvent(queryClient);

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());
  });
});

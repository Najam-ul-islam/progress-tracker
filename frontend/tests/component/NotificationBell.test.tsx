import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { server } from "../mocks/server";
import {
  notificationsFeedSuccess,
  type NotificationSeed,
} from "../mocks/notifications-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";

afterEach(() => clearSession());

function seedFeed(unread: number, total = unread) {
  const items: NotificationSeed[] = Array.from({ length: total }).map((_, i) => ({
    id: i + 1,
    title: `Notification ${i + 1}`,
    message: `Body ${i + 1}`,
    type: "system",
    is_read: i >= unread,
    created_at: `2026-06-${String(10 + (total - i)).padStart(2, "0")}T10:00:00Z`,
  }));
  server.use(notificationsFeedSuccess(items));
}

describe("NotificationBell badge", () => {
  it("shows the exact unread count", async () => {
    seedFeed(3, 5);
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("renders no badge when there are zero unread", async () => {
    seedFeed(0, 4);
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    // Bell is present; badge is not.
    expect(await screen.findByRole("button", { name: /notifications/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument()
    );
  });

  it("caps the badge at 99+", async () => {
    seedFeed(150, 150);
    seedSession({ role: "admin", id: 1 });
    renderRoute("/", <NotificationBell />);
    expect(await screen.findByText("99+")).toBeInTheDocument();
  });
});

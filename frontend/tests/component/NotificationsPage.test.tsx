import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  notificationsFeedSuccess,
  notificationsFeedNetworkError,
  type NotificationSeed,
} from "../mocks/notifications-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { NotificationsPage } from "@/modules/notifications/pages/NotificationsPage";

afterEach(() => clearSession());

function seedMany(count: number) {
  const items: NotificationSeed[] = Array.from({ length: count }).map((_, i) => ({
    id: i + 1,
    title: `Notification ${i + 1}`,
    message: `Full message body for notification ${i + 1}`,
    type: "system",
    is_read: false,
    created_at: `2026-06-19T${String(23 - (i % 24)).padStart(2, "0")}:00:00Z`,
  }));
  server.use(notificationsFeedSuccess(items));
}

describe("NotificationsPage", () => {
  it("renders the feed with the total count", async () => {
    seedMany(5);
    seedSession({ role: "developer", id: 3 });
    renderRoute("/notifications", <NotificationsPage />);
    expect(await screen.findByText("Notification 1")).toBeInTheDocument();
    expect(screen.getByText(/of 5/i)).toBeInTheDocument();
  });

  it("pages through older entries without a reload", async () => {
    seedMany(45); // PAGE_SIZE = 20 → 3 pages
    seedSession({ role: "developer", id: 3 });
    renderRoute("/notifications", <NotificationsPage />);
    await screen.findByText(/showing 1.20 of 45/i);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/showing 21.40 of 45/i)).toBeInTheDocument());
  });

  it("shows an empty state when there are no notifications", async () => {
    server.use(notificationsFeedSuccess([]));
    seedSession({ role: "developer", id: 3 });
    renderRoute("/notifications", <NotificationsPage />);
    expect(await screen.findByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("shows a retry-able error state on fetch failure", async () => {
    server.use(notificationsFeedNetworkError());
    seedSession({ role: "developer", id: 3 });
    renderRoute("/notifications", <NotificationsPage />);
    expect(await screen.findByTestId("notifications-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

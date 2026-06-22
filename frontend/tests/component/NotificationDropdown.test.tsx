import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  notificationsFeedSuccess,
  notificationsFeedNetworkError,
  seededNotifications,
} from "../mocks/notifications-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";

afterEach(() => clearSession());

async function openDropdown() {
  const user = userEvent.setup();
  const bell = await screen.findByRole("button", { name: /notifications/i });
  await user.click(bell);
  return user;
}

describe("NotificationDropdown", () => {
  it("opens on bell click and lists recent notifications newest-first", async () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    await openDropdown();

    const panel = await screen.findByRole("dialog", { name: /notifications/i });
    const items = within(panel).getAllByTestId("notification-item");
    expect(items.length).toBe(seededNotifications.length);
    // Newest first: seeded id 1 (10:00) is newest.
    expect(within(items[0]).getByText("Assigned to Acme / Auth module")).toBeInTheDocument();
  });

  it("marks unread rows with a visible indicator", async () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    await openDropdown();
    const panel = await screen.findByRole("dialog", { name: /notifications/i });
    // 3 unread in the default seed.
    expect(within(panel).getAllByTestId("unread-dot").length).toBe(3);
  });

  it("shows an empty state when there are no notifications", async () => {
    server.use(notificationsFeedSuccess([]));
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    await openDropdown();
    expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("shows a retry-able error state on fetch failure", async () => {
    server.use(notificationsFeedNetworkError());
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    await openDropdown();
    expect(await screen.findByTestId("notifications-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    const user = await openDropdown();
    await screen.findByRole("dialog", { name: /notifications/i });
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /notifications/i })).not.toBeInTheDocument()
    );
  });

  it("exposes a View all link to the notifications page", async () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    await openDropdown();
    const link = await screen.findByRole("link", { name: /view all/i });
    expect(link).toHaveAttribute("href", "/notifications");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  notificationsFeedSuccess,
  statefulNotificationsHandlers,
  markReadServerError,
  type NotificationSeed,
} from "../mocks/notifications-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";

afterEach(() => clearSession());

const threeUnread: NotificationSeed[] = [
  { id: 1, title: "First", message: "m1", type: "system", is_read: false, created_at: "2026-06-19T12:00:00Z" },
  { id: 2, title: "Second", message: "m2", type: "system", is_read: false, created_at: "2026-06-19T11:00:00Z" },
  { id: 3, title: "Third", message: "m3", type: "system", is_read: false, created_at: "2026-06-19T10:00:00Z" },
];

async function openDropdown() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /notifications/i }));
  await screen.findByRole("dialog", { name: /notifications/i });
  return user;
}

describe("Mark single notification read", () => {
  it("optimistically decrements the badge by one", async () => {
    server.use(...statefulNotificationsHandlers(threeUnread));
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();

    const user = await openDropdown();
    const panel = screen.getByRole("dialog", { name: /notifications/i });
    await user.click(within(panel).getAllByRole("button", { name: /mark as read/i })[0]);

    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
  });

  it("rolls back to the prior count when the request fails", async () => {
    server.use(notificationsFeedSuccess(threeUnread), markReadServerError());
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();

    const user = await openDropdown();
    const panel = screen.getByRole("dialog", { name: /notifications/i });
    await user.click(within(panel).getAllByRole("button", { name: /mark as read/i })[0]);

    // Optimistic flip to 2, then rollback to 3 after the server 500 + reconcile.
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  statefulNotificationsHandlers,
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

describe("Mark all as read", () => {
  it("clears the badge to zero in one action", async () => {
    server.use(...statefulNotificationsHandlers(threeUnread));
    seedSession({ role: "developer", id: 3 });
    renderRoute("/", <NotificationBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    const panel = await screen.findByRole("dialog", { name: /notifications/i });

    await user.click(within(panel).getByRole("button", { name: /mark all as read/i }));

    await waitFor(() => expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument());
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import { usersListForbidden, usersListNetworkError } from "../mocks/users-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { UsersListPage } from "@/modules/users/pages/UsersListPage";

afterEach(() => clearSession());

describe("UsersListPage", () => {
  it("renders rows with role badges for admin", async () => {
    seedSession({ role: "admin", id: 1, name: "Ada" });
    renderRoute("/users", <UsersListPage />);
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("Maya Manager")).toBeInTheDocument();
    expect(screen.getByText("Dev Devon")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Role: Admin").length).toBeGreaterThan(0);
  });

  it("renders Edit action only for admin", async () => {
    seedSession({ role: "manager", id: 2, name: "Maya" });
    renderRoute("/users", <UsersListPage />);
    await screen.findByText("Ada Admin");
    expect(screen.queryAllByRole("button", { name: /^edit$/i })).toHaveLength(0);
  });

  it("blocks developer with Access denied", async () => {
    seedSession({ role: "developer", id: 3, name: "Devon" });
    renderRoute("/users", <UsersListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/access denied/i);
    expect(screen.queryByText("Ada Admin")).not.toBeInTheDocument();
  });

  it("filters by client-side search without a network refetch", async () => {
    seedSession({ role: "admin" });
    renderRoute("/users", <UsersListPage />);
    await screen.findByText("Ada Admin");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/search/i), "maya");
    await waitFor(() => expect(screen.queryByText("Ada Admin")).not.toBeInTheDocument());
    expect(screen.getByText("Maya Manager")).toBeInTheDocument();
  });

  it("shows empty state with Clear filters when no rows match", async () => {
    seedSession({ role: "admin" });
    renderRoute("/users", <UsersListPage />);
    await screen.findByText("Ada Admin");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/search/i), "zzz-no-match");
    expect(await screen.findByText(/no users match these filters/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
  });

  it("renders error state with Try again on fetch failure", async () => {
    server.use(usersListNetworkError());
    seedSession({ role: "admin" });
    renderRoute("/users", <UsersListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders error state on 403", async () => {
    server.use(usersListForbidden());
    seedSession({ role: "admin" });
    renderRoute("/users", <UsersListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
  });

  it("clicking a row navigates to the profile route", async () => {
    seedSession({ role: "admin" });
    renderRoute("/users", <UsersListPage />);
    const row = (await screen.findByText("Maya Manager")).closest("tr")!;
    const user = userEvent.setup();
    await user.click(within(row).getByText("Maya Manager"));
    expect(await screen.findByText("USER_PROFILE")).toBeInTheDocument();
  });
});

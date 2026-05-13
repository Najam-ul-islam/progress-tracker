import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { server } from "../mocks/server";
import { seededUsers, userGetNotFound, userGetSuccess } from "../mocks/users-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { UserProfilePage } from "@/modules/users/pages/UserProfilePage";

afterEach(() => clearSession());

describe("UserProfilePage", () => {
  it("renders any profile for admin with Edit button visible", async () => {
    server.use(userGetSuccess(seededUsers[1]));
    seedSession({ role: "admin", id: 1 });
    renderRoute("/users/:id", <UserProfilePage />, { initialEntries: ["/users/2"] });
    expect(await screen.findByText("Maya Manager")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit user/i })).toBeInTheDocument();
  });

  it("renders read-only for manager (no Edit button)", async () => {
    server.use(userGetSuccess(seededUsers[2]));
    seedSession({ role: "manager", id: 2 });
    renderRoute("/users/:id", <UserProfilePage />, { initialEntries: ["/users/3"] });
    expect(await screen.findByText("Dev Devon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit user/i })).not.toBeInTheDocument();
  });

  it("lets developer view their own profile read-only", async () => {
    server.use(userGetSuccess(seededUsers[2]));
    seedSession({ role: "developer", id: 3 });
    renderRoute("/users/:id", <UserProfilePage />, { initialEntries: ["/users/3"] });
    expect(await screen.findByText("Dev Devon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit user/i })).not.toBeInTheDocument();
  });

  it("denies developer viewing someone else", async () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/users/:id", <UserProfilePage />, { initialEntries: ["/users/2"] });
    expect(await screen.findByRole("alert")).toHaveTextContent(/access denied/i);
  });

  it("renders user-not-found state on 404", async () => {
    server.use(userGetNotFound());
    seedSession({ role: "admin", id: 1 });
    renderRoute("/users/:id", <UserProfilePage />, { initialEntries: ["/users/999"] });
    expect(await screen.findByText(/user not found/i)).toBeInTheDocument();
  });
});

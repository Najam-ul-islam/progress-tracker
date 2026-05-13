import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { RequireUsersAccess } from "@/modules/users/components/RequireUsersAccess";

afterEach(() => clearSession());

describe("RequireUsersAccess", () => {
  it("renders children for admin", () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute(
      "/users",
      <RequireUsersAccess>
        <div>USERS_CONTENT</div>
      </RequireUsersAccess>
    );
    expect(screen.getByText("USERS_CONTENT")).toBeInTheDocument();
  });

  it("renders children for manager", () => {
    seedSession({ role: "manager", id: 2 });
    renderRoute(
      "/users",
      <RequireUsersAccess>
        <div>USERS_CONTENT</div>
      </RequireUsersAccess>
    );
    expect(screen.getByText("USERS_CONTENT")).toBeInTheDocument();
  });

  it("blocks developer with Access denied and does not render children", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    seedSession({ role: "developer", id: 3 });
    renderRoute(
      "/users",
      <RequireUsersAccess>
        <div>USERS_CONTENT</div>
      </RequireUsersAccess>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/access denied/i);
    expect(screen.queryByText("USERS_CONTENT")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

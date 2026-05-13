import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { AppHeader } from "@/modules/auth/components/AppHeader";

afterEach(() => clearSession());

describe("AppHeader nav link RBAC", () => {
  it("shows the Users link for admin", () => {
    seedSession({ role: "admin", id: 1, name: "Ada" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /users/i })).toBeInTheDocument();
  });

  it("shows the Users link for manager", () => {
    seedSession({ role: "manager", id: 2, name: "Maya" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /users/i })).toBeInTheDocument();
  });

  it("hides the Users link for developer", () => {
    seedSession({ role: "developer", id: 3, name: "Devon" });
    renderRoute("/", <AppHeader />);
    expect(screen.queryByRole("link", { name: /users/i })).not.toBeInTheDocument();
  });
});

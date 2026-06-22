import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { AppHeader } from "@/modules/auth/components/AppHeader";

afterEach(() => clearSession());

describe("AppHeader Clients link RBAC", () => {
  it("shows the Clients link for admin", () => {
    seedSession({ role: "admin", id: 1, name: "Ada" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /clients/i })).toBeInTheDocument();
  });

  it("shows the Clients link for manager", () => {
    seedSession({ role: "manager", id: 2, name: "Maya" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /clients/i })).toBeInTheDocument();
  });

  it("hides the Clients link for developer", () => {
    seedSession({ role: "developer", id: 3, name: "Devon" });
    renderRoute("/", <AppHeader />);
    expect(screen.queryByRole("link", { name: /clients/i })).not.toBeInTheDocument();
  });
});

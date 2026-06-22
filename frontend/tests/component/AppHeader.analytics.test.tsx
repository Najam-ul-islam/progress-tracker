import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { AppHeader } from "@/modules/auth/components/AppHeader";

afterEach(() => clearSession());

describe("AppHeader analytics navigation RBAC", () => {
  it("shows Analytics (not My Earnings) for an admin", () => {
    seedSession({ role: "admin", id: 1, name: "Ada" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my earnings/i })).not.toBeInTheDocument();
  });

  it("shows Analytics (not My Earnings) for a manager", () => {
    seedSession({ role: "manager", id: 2, name: "Maya" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my earnings/i })).not.toBeInTheDocument();
  });

  it("shows My Earnings (not Analytics) for a developer", () => {
    seedSession({ role: "developer", id: 3, name: "Devon" });
    renderRoute("/", <AppHeader />);
    expect(screen.getByRole("link", { name: /my earnings/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /analytics/i })).not.toBeInTheDocument();
  });

  it("does not render the old Financial Reports link", () => {
    seedSession({ role: "admin", id: 1, name: "Ada" });
    renderRoute("/", <AppHeader />);
    expect(screen.queryByRole("link", { name: /financial reports/i })).not.toBeInTheDocument();
  });
});

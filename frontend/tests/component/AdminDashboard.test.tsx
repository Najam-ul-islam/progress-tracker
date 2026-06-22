import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { ThemeProvider } from "@/context/ThemeContext";

afterEach(() => clearSession());

describe("Admin Dashboard Page Rendering", () => {
  it("renders the dashboard page headers and main elements", async () => {
    // Seed session for an admin user
    seedSession({ role: "admin", id: 1, name: "Test Administrator" });

    // Render dashboard wrapped in the ThemeProvider
    renderRoute("/", (
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>
    ));

    // Verify page title (renders after data loads)
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

    // Verify KPI Card labels are present
    expect(await screen.findByText("Total Revenue", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("Active Users", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("Projects", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("Pending Payments", { selector: "p" })).toBeInTheDocument();

    // Verify recent activity feed header
    expect(screen.getByText("Recent Activity Events")).toBeInTheDocument();
  });
});

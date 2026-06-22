import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { ThemeProvider } from "@/context/ThemeContext";

afterEach(() => clearSession());

describe("Developer Dashboard Page Rendering", () => {
  it("renders the developer dashboard page headers and personalized stats", async () => {
    // Seed session for a developer user
    seedSession({ role: "developer", id: 3, name: "Dev One" });

    // Render dashboard wrapped in the ThemeProvider
    renderRoute("/", (
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>
    ));

    // Verify personalized greeting headers
    expect(await screen.findByRole("heading", { level: 1, name: /Welcome back, Dev One/i })).toBeInTheDocument();

    // Verify developer KPI Card labels and values are present
    expect(await screen.findByText("Projects Completed", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("Pending Projects", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("Total Earnings", { selector: "p" })).toBeInTheDocument();

    const kpiValues = await screen.findAllByText("1");
    expect(kpiValues).toHaveLength(2); // projects_completed + projects_pending

    // Verify assigned modules table/card is present
    expect(await screen.findByText("Assigned Modules")).toBeInTheDocument();
    expect(await screen.findByText("Auth")).toBeInTheDocument();
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
  });
});

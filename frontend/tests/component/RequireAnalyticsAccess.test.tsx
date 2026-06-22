import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { AnalyticsDashboardPage } from "@/modules/reporting/pages/AnalyticsDashboardPage";

afterEach(() => clearSession());

function renderDashboard() {
  return renderRoute("/analytics", <AnalyticsDashboardPage />, {
    initialEntries: ["/analytics"],
  });
}

describe("RequireAnalyticsAccess", () => {
  it("denies a developer deep-linking the analytics dashboard", async () => {
    seedSession({ role: "developer", id: 3 });
    renderDashboard();
    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText("Total revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Total projects")).not.toBeInTheDocument();
  });

  it("allows an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderDashboard();
    expect(await screen.findByText("Total revenue")).toBeInTheDocument();
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
  });
});

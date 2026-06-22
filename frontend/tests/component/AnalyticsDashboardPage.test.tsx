import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  dashboardSuccess,
  dashboardNetworkError,
  emptyDashboard,
} from "../mocks/reporting-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { AnalyticsDashboardPage } from "@/modules/reporting/pages/AnalyticsDashboardPage";

afterEach(() => clearSession());

function renderDashboard() {
  return renderRoute("/analytics", <AnalyticsDashboardPage />, {
    initialEntries: ["/analytics"],
  });
}

describe("AnalyticsDashboardPage", () => {
  it("renders KPI values matching /reports/dashboard for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderDashboard();
    // project counts
    expect(await screen.findByText("Total projects")).toBeInTheDocument();
    expect(screen.getByText("Total revenue")).toBeInTheDocument();
    // money + percent formatted
    expect(screen.getByText("$6,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
  });

  it("renders for a manager too", async () => {
    seedSession({ role: "manager", id: 2 });
    renderDashboard();
    expect(await screen.findByText("Total revenue")).toBeInTheDocument();
  });

  it("renders structurally valid zeros on an empty system", async () => {
    server.use(dashboardSuccess(emptyDashboard));
    seedSession({ role: "admin", id: 1 });
    renderDashboard();
    expect(await screen.findByText("Total revenue")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows an error state with retry on failure, then recovers", async () => {
    server.use(dashboardNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    const retry = screen.getByRole("button", { name: /try again/i });
    server.use(dashboardSuccess());
    await userEvent.click(retry);
    expect(await screen.findByText("Total revenue")).toBeInTheDocument();
  });
});

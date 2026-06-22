import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  developersReportSuccess,
  developersReportNetworkError,
  seededDevelopers,
} from "../mocks/reporting-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { DeveloperPerformancePage } from "@/modules/reporting/pages/DeveloperPerformancePage";

afterEach(() => clearSession());

function renderDevelopers() {
  return renderRoute("/analytics/developers", <DeveloperPerformancePage />, {
    initialEntries: ["/analytics/developers"],
  });
}

describe("DeveloperPerformancePage", () => {
  it("renders developer rows and earnings for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderDevelopers();
    
    expect(await screen.findByText("Dev One")).toBeInTheDocument();
    // Earnings: paid $700.00, pending $300.00, total $1,000.00
    expect(screen.getByText("$700.00")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    // Module count: 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the earnings chart (accessible label)", async () => {
    seedSession({ role: "admin", id: 1 });
    renderDevelopers();
    
    expect(await screen.findByText("Dev One")).toBeInTheDocument();
    expect(screen.getByLabelText(/total earnings by developer/i)).toBeInTheDocument();
  });

  it("shows an error state with retry, then recovers", async () => {
    server.use(developersReportNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderDevelopers();
    
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    
    server.use(developersReportSuccess(seededDevelopers));
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    
    expect(await screen.findByText("Dev One")).toBeInTheDocument();
  });
});

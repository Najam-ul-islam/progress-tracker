import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import {
  selfReportSuccess,
  selfReportNetworkError,
  emptySelfReport,
} from "../mocks/reporting-handlers";
import { server } from "../mocks/server";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { DeveloperEarningsPage } from "@/modules/earnings/pages/DeveloperEarningsPage";

afterEach(() => clearSession());

function renderEarnings() {
  return renderRoute("/earnings", <DeveloperEarningsPage />, {
    initialEntries: ["/earnings"],
  });
}

describe("DeveloperEarningsPage", () => {
  it("renders personal earnings and modules for a developer", async () => {
    seedSession({ role: "developer", id: 3 });
    renderEarnings();
    
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(screen.getByText("Auth")).toBeInTheDocument();
    // Earnings: paid + total both $400.00 → appears in multiple places
    expect(screen.getAllByText("$400.00").length).toBeGreaterThan(0);
    // Share: 30.00 → formatted as 30%
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("shows an empty state when the developer has no assignments", async () => {
    server.use(selfReportSuccess(emptySelfReport));
    seedSession({ role: "developer", id: 4 });
    renderEarnings();
    
    expect(await screen.findByText(/no assignments/i)).toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
  });

  it("shows an error state on network failure", async () => {
    server.use(selfReportNetworkError());
    seedSession({ role: "developer", id: 3 });
    renderEarnings();
    
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
  });
});

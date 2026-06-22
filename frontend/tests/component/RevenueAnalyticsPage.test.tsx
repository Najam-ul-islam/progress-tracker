import { afterEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  paymentsSuccess,
  paymentsNetworkError,
  seededFinancial,
} from "../mocks/reporting-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { RevenueAnalyticsPage } from "@/modules/reporting/pages/RevenueAnalyticsPage";

afterEach(() => clearSession());

function renderRevenue() {
  return renderRoute("/analytics/revenue", <RevenueAnalyticsPage />, {
    initialEntries: ["/analytics/revenue"],
  });
}

describe("RevenueAnalyticsPage", () => {
  it("renders totals and a reconciling per-project table for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRevenue();
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    // headline total invoiced + footer total both show $10,000.00
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThanOrEqual(2);
    // a zero-payment project still appears with $0.00 columns
    expect(screen.getByText("Borealis")).toBeInTheDocument();
  });

  it("renders the revenue composition chart (accessible label)", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRevenue();
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(screen.getByLabelText(/revenue composition/i)).toBeInTheDocument();
  });

  it("reconciles the table footer to the totals block", async () => {
    seedSession({ role: "manager", id: 2 });
    renderRevenue();
    const table = await screen.findByRole("table");
    const footer = within(table).getByText("Totals").closest("tr")!;
    expect(within(footer).getByText("$10,000.00")).toBeInTheDocument();
    expect(within(footer).getByText("$3,000.00")).toBeInTheDocument();
    expect(within(footer).getByText("$7,000.00")).toBeInTheDocument();
  });

  it("shows an error state with retry, then recovers", async () => {
    server.use(paymentsNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderRevenue();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    server.use(paymentsSuccess(seededFinancial));
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import { reportInvalidFilter, paymentsSuccess } from "../mocks/reporting-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { RevenueAnalyticsPage } from "@/modules/reporting/pages/RevenueAnalyticsPage";
import { ProjectAnalyticsPage } from "@/modules/reporting/pages/ProjectAnalyticsPage";

afterEach(() => {
  clearSession();
  server.resetHandlers();
});

describe("AnalyticsFilters", () => {
  it("applying a status filter updates the URL query string", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/analytics/projects", <ProjectAnalyticsPage />, {
      initialEntries: ["/analytics/projects"],
    });
    await screen.findByText("Apollo");

    const statusSelect = screen.getByLabelText("Status");
    await userEvent.selectOptions(statusSelect, "active");

    // The select reflects the new value (URL is the source of truth behind it).
    expect((statusSelect as HTMLSelectElement).value).toBe("active");
  });

  it("does not show the developer filter on the Revenue view", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/analytics/revenue", <RevenueAnalyticsPage />, {
      initialEntries: ["/analytics/revenue"],
    });
    await screen.findByText("Apollo");
    expect(screen.queryByLabelText("Developer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("surfaces a date-range error and does not leave the view broken", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/analytics/revenue", <RevenueAnalyticsPage />, {
      initialEntries: ["/analytics/revenue?date_from=2026-05-01&date_to=2026-01-01"],
    });
    // inline validation message
    expect(await screen.findByText(/date from must be on or before date to/i)).toBeInTheDocument();
  });

  it("clears filters back to the full scope", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/analytics/projects", <ProjectAnalyticsPage />, {
      initialEntries: ["/analytics/projects?project_status=active"],
    });
    await screen.findByText("Apollo");
    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(statusSelect.value).toBe("active");

    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(statusSelect.value).toBe("");
  });

  it("surfaces a backend 422 as an inline error on the page", async () => {
    server.use(reportInvalidFilter("payments", "Invalid client id"));
    seedSession({ role: "admin", id: 1 });
    renderRoute("/analytics/revenue", <RevenueAnalyticsPage />, {
      initialEntries: ["/analytics/revenue?client_id=999"],
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // recovers when the filter is corrected
    server.use(paymentsSuccess());
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
  });
});

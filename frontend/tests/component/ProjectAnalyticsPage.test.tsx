import { afterEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  projectsReportSuccess,
  projectsReportNetworkError,
  seededProjects,
} from "../mocks/reporting-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { ProjectAnalyticsPage } from "@/modules/reporting/pages/ProjectAnalyticsPage";

afterEach(() => clearSession());

function renderProjects() {
  return renderRoute("/analytics/projects", <ProjectAnalyticsPage />, {
    initialEntries: ["/analytics/projects"],
  });
}

describe("ProjectAnalyticsPage", () => {
  it("renders project rows and progress bars for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderProjects();
    
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    const table = screen.getByRole("table");
    // Client name appears in the table row (the filter dropdown also lists it).
    expect(within(table).getByText("Acme Corp")).toBeInTheDocument();
    // Progress bar for Apollo (60%)
    expect(within(table).getByText("60%")).toBeInTheDocument();
    // Module counts: 3 total, 1 completed, 1 in progress, 1 pending
    expect(within(table).getByText("3")).toBeInTheDocument();
  });

  it("renders the project status chart (accessible label)", async () => {
    seedSession({ role: "admin", id: 1 });
    renderProjects();
    
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(screen.getByLabelText(/project count by status/i)).toBeInTheDocument();
  });

  it("shows an error state with retry, then recovers", async () => {
    server.use(projectsReportNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderProjects();
    
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    
    server.use(projectsReportSuccess(seededProjects));
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
  });
});

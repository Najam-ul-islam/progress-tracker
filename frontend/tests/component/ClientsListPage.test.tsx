import { afterEach, describe, expect, it } from "vitest";
import { Route } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  clientsListSuccess,
  clientsListForbidden,
  clientsListNetworkError,
  seededClients,
} from "../mocks/clients-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { ClientsListPage } from "@/modules/clients/pages/ClientsListPage";

afterEach(() => clearSession());

const detailRoute = <Route path="/clients/:id" element={<div>CLIENT_DETAILS</div>} />;

function renderList(initialEntries = ["/clients"]) {
  return renderRoute("/clients", <ClientsListPage />, {
    initialEntries,
    extraRoutes: detailRoute,
  });
}

describe("ClientsListPage", () => {
  it("renders a row per client for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderList();
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beth Boran")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("renders the list for a manager too", async () => {
    seedSession({ role: "manager", id: 2 });
    renderList();
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("denies access to a developer", async () => {
    seedSession({ role: "developer", id: 3 });
    renderList();
    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("narrows rows by search and clears them", async () => {
    seedSession({ role: "admin", id: 1 });
    renderList();
    await screen.findByText("Acme Corp");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/search/i), "globex");
    await waitFor(() => {
      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("shows a search-empty state with a clear action", async () => {
    seedSession({ role: "admin", id: 1 });
    renderList();
    await screen.findByText("Acme Corp");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/search/i), "zzzznomatch");
    expect(await screen.findByText(/no clients match your search/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows a first-run empty state when there are no clients", async () => {
    server.use(clientsListSuccess([]));
    seedSession({ role: "admin", id: 1 });
    renderList();
    expect(await screen.findByText(/no clients yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry on failure", async () => {
    server.use(clientsListNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderList();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("navigates to the details route when a row is clicked", async () => {
    seedSession({ role: "admin", id: 1 });
    renderList();
    const row = await screen.findByText("Acme Corp");
    const user = userEvent.setup();
    await user.click(row);
    expect(await screen.findByText("CLIENT_DETAILS")).toBeInTheDocument();
  });

  it("forbidden list response surfaces an error state", async () => {
    server.use(clientsListForbidden());
    seedSession({ role: "admin", id: 1 });
    renderList();
    // 403 on list (admin is allowed, but defensively handled) → error state
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows an Actions column for roles that can edit", async () => {
    seedSession({ role: "admin", id: 1 });
    renderList();
    await screen.findByText("Acme Corp");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("button", { name: /edit/i }).length).toBe(
      seededClients.length
    );
  });
});

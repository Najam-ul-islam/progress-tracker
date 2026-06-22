import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { RequireDashboardAccess } from "@/modules/dashboard/components/RequireDashboardAccess";

afterEach(() => clearSession());

describe("RequireDashboardAccess", () => {
  it("renders children for admin role", () => {
    seedSession({ role: "admin" });
    renderRoute("/", <RequireDashboardAccess><div>PROTECTED</div></RequireDashboardAccess>);
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });

  it("renders children for manager role", () => {
    seedSession({ role: "manager" });
    renderRoute("/", <RequireDashboardAccess><div>PROTECTED</div></RequireDashboardAccess>);
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });

  it("renders children for developer role", () => {
    seedSession({ role: "developer" });
    renderRoute("/", <RequireDashboardAccess><div>PROTECTED</div></RequireDashboardAccess>);
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });

  it("shows access denied for null role", () => {
    renderRoute("/", <RequireDashboardAccess><div>PROTECTED</div></RequireDashboardAccess>);
    expect(screen.queryByText("PROTECTED")).not.toBeInTheDocument();
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });
});
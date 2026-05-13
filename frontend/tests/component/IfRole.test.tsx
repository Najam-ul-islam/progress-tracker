import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IfAdmin, IfRole } from "@/modules/users/components/IfRole";
import { clearSession, seedSession } from "../helpers/renderWithProviders";

afterEach(() => clearSession());

describe("IfRole", () => {
  it("renders when role is allowed", () => {
    seedSession({ role: "admin" });
    render(
      <IfRole roles={["admin", "manager"]}>
        <span>VISIBLE</span>
      </IfRole>
    );
    expect(screen.getByText("VISIBLE")).toBeInTheDocument();
  });

  it("renders nothing (DOM-absent) when role is not allowed", () => {
    seedSession({ role: "developer" });
    render(
      <IfRole roles={["admin", "manager"]}>
        <span>VISIBLE</span>
      </IfRole>
    );
    expect(screen.queryByText("VISIBLE")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no session", () => {
    render(
      <IfRole roles={["admin"]}>
        <span>VISIBLE</span>
      </IfRole>
    );
    expect(screen.queryByText("VISIBLE")).not.toBeInTheDocument();
  });
});

describe("IfAdmin", () => {
  it("renders for admin only", () => {
    seedSession({ role: "admin" });
    render(
      <IfAdmin>
        <span>EDIT</span>
      </IfAdmin>
    );
    expect(screen.getByText("EDIT")).toBeInTheDocument();
  });

  it("DOM-absent for manager", () => {
    seedSession({ role: "manager" });
    render(
      <IfAdmin>
        <span>EDIT</span>
      </IfAdmin>
    );
    expect(screen.queryByText("EDIT")).not.toBeInTheDocument();
  });

  it("DOM-absent for developer", () => {
    seedSession({ role: "developer" });
    render(
      <IfAdmin>
        <span>EDIT</span>
      </IfAdmin>
    );
    expect(screen.queryByText("EDIT")).not.toBeInTheDocument();
  });
});

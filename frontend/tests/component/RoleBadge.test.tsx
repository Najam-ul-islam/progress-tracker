import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "@/modules/users/components/RoleBadge";

describe("RoleBadge", () => {
  it("renders the role label", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("includes an aria-label per role", () => {
    render(<RoleBadge role="manager" />);
    expect(screen.getByLabelText("Role: Manager")).toBeInTheDocument();
  });

  it("renders developer", () => {
    render(<RoleBadge role="developer" />);
    expect(screen.getByText("Developer")).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { canViewClients, canEditClients, canDeleteClients } from "@/lib/rbac";

describe("clients RBAC", () => {
  it("admin can view, edit, and delete", () => {
    expect(canViewClients("admin")).toBe(true);
    expect(canEditClients("admin")).toBe(true);
    expect(canDeleteClients("admin")).toBe(true);
  });

  it("manager can view and edit but not delete", () => {
    expect(canViewClients("manager")).toBe(true);
    expect(canEditClients("manager")).toBe(true);
    expect(canDeleteClients("manager")).toBe(false);
  });

  it("developer has no access", () => {
    expect(canViewClients("developer")).toBe(false);
    expect(canEditClients("developer")).toBe(false);
    expect(canDeleteClients("developer")).toBe(false);
  });

  it("null role has no access", () => {
    expect(canViewClients(null)).toBe(false);
    expect(canEditClients(null)).toBe(false);
    expect(canDeleteClients(null)).toBe(false);
  });
});

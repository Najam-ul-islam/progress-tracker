import { describe, expect, it } from "vitest";
import { canEditUsers, canViewUserProfile, canViewUsers } from "@/lib/rbac";

describe("canViewUsers", () => {
  it("allows admin and manager", () => {
    expect(canViewUsers("admin")).toBe(true);
    expect(canViewUsers("manager")).toBe(true);
  });
  it("denies developer and null", () => {
    expect(canViewUsers("developer")).toBe(false);
    expect(canViewUsers(null)).toBe(false);
  });
});

describe("canEditUsers", () => {
  it("allows only admin", () => {
    expect(canEditUsers("admin")).toBe(true);
    expect(canEditUsers("manager")).toBe(false);
    expect(canEditUsers("developer")).toBe(false);
    expect(canEditUsers(null)).toBe(false);
  });
});

describe("canViewUserProfile", () => {
  it("lets admin/manager view anyone", () => {
    expect(canViewUserProfile("admin", 1, 99)).toBe(true);
    expect(canViewUserProfile("manager", 2, 99)).toBe(true);
  });
  it("lets developer view only themselves", () => {
    expect(canViewUserProfile("developer", 5, 5)).toBe(true);
    expect(canViewUserProfile("developer", 5, 6)).toBe(false);
  });
  it("denies when role is null or no session id", () => {
    expect(canViewUserProfile(null, 1, 1)).toBe(false);
    expect(canViewUserProfile("developer", null, 5)).toBe(false);
  });
});

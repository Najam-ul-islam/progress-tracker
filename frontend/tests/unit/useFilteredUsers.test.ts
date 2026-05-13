import { describe, expect, it } from "vitest";
import { filterUsers } from "@/modules/users/hooks/useFilteredUsers";
import type { User } from "@/modules/users/types";

const u = (over: Partial<User>): User => ({
  id: 1,
  name: "Ada Admin",
  email: "ada@example.com",
  role: "admin",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

const sample: User[] = [
  u({ id: 1, name: "Ada Admin", email: "ada@example.com", role: "admin" }),
  u({ id: 2, name: "Maya Manager", email: "maya@example.com", role: "manager" }),
  u({ id: 3, name: "Dev Devon", email: "devon@example.com", role: "developer" }),
  u({ id: 4, name: "Inactive Ian", email: "ian@example.com", role: "developer", isActive: false }),
];

describe("filterUsers", () => {
  it("returns all users with default filter", () => {
    const out = filterUsers(sample, { q: "", role: "any", status: "all" });
    expect(out).toHaveLength(4);
  });

  it("case-insensitive name match", () => {
    const out = filterUsers(sample, { q: "ADA", role: "any", status: "all" });
    expect(out.map((x) => x.id)).toEqual([1]);
  });

  it("matches email substring", () => {
    const out = filterUsers(sample, { q: "maya@", role: "any", status: "all" });
    expect(out.map((x) => x.id)).toEqual([2]);
  });

  it("filters by role", () => {
    const out = filterUsers(sample, { q: "", role: "developer", status: "all" });
    expect(out.map((x) => x.id)).toEqual([3, 4]);
  });

  it("filters by status=active", () => {
    const out = filterUsers(sample, { q: "", role: "any", status: "active" });
    expect(out.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("filters by status=inactive", () => {
    const out = filterUsers(sample, { q: "", role: "any", status: "inactive" });
    expect(out.map((x) => x.id)).toEqual([4]);
  });

  it("AND-combines q + role + status", () => {
    const out = filterUsers(sample, { q: "ian", role: "developer", status: "inactive" });
    expect(out.map((x) => x.id)).toEqual([4]);
  });

  it("returns empty when nothing matches", () => {
    const out = filterUsers(sample, { q: "zzz", role: "any", status: "all" });
    expect(out).toEqual([]);
  });
});

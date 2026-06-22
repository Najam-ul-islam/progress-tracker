import { describe, expect, it } from "vitest";
import { canViewAnalytics, canViewOwnPerformance } from "@/lib/rbac";

describe("analytics RBAC", () => {
  it("canViewAnalytics: admin and manager only", () => {
    expect(canViewAnalytics("admin")).toBe(true);
    expect(canViewAnalytics("manager")).toBe(true);
    expect(canViewAnalytics("developer")).toBe(false);
    expect(canViewAnalytics(null)).toBe(false);
  });

  it("canViewOwnPerformance: developer only", () => {
    expect(canViewOwnPerformance("developer")).toBe(true);
    expect(canViewOwnPerformance("admin")).toBe(false);
    expect(canViewOwnPerformance("manager")).toBe(false);
    expect(canViewOwnPerformance(null)).toBe(false);
  });
});

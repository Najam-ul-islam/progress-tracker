import { describe, expect, it } from "vitest";
import { canViewEarnings, canViewPayments, canViewNotifications, canViewSettings } from "@/lib/rbac";

describe("sidebar RBAC functions", () => {
  describe("canViewEarnings", () => {
    it("allows admin, manager, developer", () => {
      expect(canViewEarnings("admin")).toBe(true);
      expect(canViewEarnings("manager")).toBe(true);
      expect(canViewEarnings("developer")).toBe(true);
    });
    it("denies null role", () => {
      expect(canViewEarnings(null)).toBe(false);
    });
  });

  describe("canViewPayments", () => {
    it("allows admin and manager only", () => {
      expect(canViewPayments("admin")).toBe(true);
      expect(canViewPayments("manager")).toBe(true);
      expect(canViewPayments("developer")).toBe(false);
      expect(canViewPayments(null)).toBe(false);
    });
  });

  describe("canViewNotifications", () => {
    it("allows all authenticated roles", () => {
      expect(canViewNotifications("admin")).toBe(true);
      expect(canViewNotifications("manager")).toBe(true);
      expect(canViewNotifications("developer")).toBe(true);
    });
    it("denies null role", () => {
      expect(canViewNotifications(null)).toBe(false);
    });
  });

  describe("canViewSettings", () => {
    it("allows all authenticated roles", () => {
      expect(canViewSettings("admin")).toBe(true);
      expect(canViewSettings("manager")).toBe(true);
      expect(canViewSettings("developer")).toBe(true);
    });
    it("denies null role", () => {
      expect(canViewSettings(null)).toBe(false);
    });
  });
});
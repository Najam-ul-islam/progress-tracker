import { describe, expect, it } from "vitest";
import { formatCurrency, formatPercent } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a decimal string as USD with thousands separators", () => {
    expect(formatCurrency("1800.00")).toBe("$1,800.00");
  });

  it("formats zero", () => {
    expect(formatCurrency("0.00")).toBe("$0.00");
  });

  it("formats a large value without float artifacts", () => {
    expect(formatCurrency("4200.50")).toBe("$4,200.50");
  });

  it("accepts a number too", () => {
    expect(formatCurrency(6000)).toBe("$6,000.00");
  });

  it("falls back to $0.00 for non-numeric input", () => {
    expect(formatCurrency("abc")).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  it("formats a one-decimal value", () => {
    expect(formatPercent("66.7")).toBe("66.7%");
  });

  it("drops a trailing .0 for whole values", () => {
    expect(formatPercent("100")).toBe("100%");
    expect(formatPercent("0.0")).toBe("0%");
  });

  it("accepts a number too", () => {
    expect(formatPercent(50)).toBe("50%");
  });
});

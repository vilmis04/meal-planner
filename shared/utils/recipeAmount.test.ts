import { describe, expect, it } from "vitest";
import { formatAmount } from "./recipeAmount";

describe("formatAmount", () => {
  it.each([
    [2, "2"],
    [2.0, "2"],
    [0.25, "0.25"],
    [0.5, "0.5"],
    [1.5, "1.5"],
    [12.5, "12.5"],
    [375, "375"],
    [0.333, "0.33"],
  ])("writes %s as %s in English", (amount, expected) => {
    expect(formatAmount(amount, "en")).toBe(expected);
  });

  it("uses the Lithuanian decimal comma", () => {
    expect(formatAmount(0.5, "lt")).toBe("0,5");
    expect(formatAmount(12.5, "lt-LT")).toBe("12,5");
  });

  it("separates thousands the way the locale does", () => {
    expect(formatAmount(1200, "en")).toBe("1,200");
  });

  it("returns null for a to-taste ingredient so the caller can show its own label", () => {
    expect(formatAmount(null, "en")).toBeNull();
    expect(formatAmount(null, "lt")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { ODD_SPACES, formatPlanDay, formatPlanRange } from "./formatPlanDate";

// ODD_SPACES is global, so search() is used: it ignores lastIndex.
const hasOddSpaces = (text: string): boolean => text.search(ODD_SPACES) !== -1;

describe("formatPlanRange", () => {
  it("writes a range within a month with plain spaces only", () => {
    const range = formatPlanRange("2026-11-09", "2026-11-15", "en");
    expect(range).toBe("9 – 15 Nov");
    expect(hasOddSpaces(range)).toBe(false);
  });

  it("names both months across a month end", () => {
    expect(formatPlanRange("2026-10-26", "2026-11-01", "en")).toBe("26 Oct – 1 Nov");
  });

  it("adds the years across a year end", () => {
    expect(formatPlanRange("2026-12-28", "2027-01-03", "en")).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("writes a one-day plan as one date", () => {
    expect(formatPlanRange("2026-11-09", "2026-11-09", "en")).toBe("9 Nov");
  });

  it("formats Lithuanian with month names, not numbers, and without odd spaces", () => {
    expect(formatPlanRange("2026-11-09", "2026-11-15", "lt")).toBe("lapkričio 9–15");
    expect(formatPlanRange("2026-10-26", "2026-11-01", "lt")).toBe("spalio 26 – lapkričio 1");
    expect(hasOddSpaces(formatPlanRange("2026-11-09", "2026-11-15", "lt"))).toBe(false);
  });
});

describe("formatPlanDay", () => {
  it("shows the stored day whatever the time zone", () => {
    expect(formatPlanDay("2026-11-09", "en", { weekday: "long" })).toBe("Monday");
    expect(formatPlanDay("2026-11-09", "en", { day: "numeric", month: "short" })).toBe("9 Nov");
  });

  it("spells the month out in Lithuanian", () => {
    expect(formatPlanDay("2026-11-09", "lt", { day: "numeric", month: "short" })).toBe("lapkričio 9 d.");
  });
});

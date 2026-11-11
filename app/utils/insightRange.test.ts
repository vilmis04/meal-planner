import { describe, expect, it } from "vitest";
import { DEFAULT_INSIGHT_RANGE, INSIGHT_RANGES, INSIGHT_RANGE_DAYS, parseInsightRange } from "./insightRange";

describe("parseInsightRange", () => {
  it.each(INSIGHT_RANGES)("reads %s from the address", (range) => {
    expect(parseInsightRange(range)).toBe(range);
  });

  it.each([undefined, null, "", "last_7_days", ["all_time"]])("falls back to the default for %j", (query) => {
    expect(parseInsightRange(query)).toBe(DEFAULT_INSIGHT_RANGE);
  });
});

describe("INSIGHT_RANGE_DAYS", () => {
  it("looks back a whole number of days the insights functions accept, or over everything", () => {
    for (const days of Object.values(INSIGHT_RANGE_DAYS)) {
      expect(days === null || (Number.isInteger(days) && days >= 1 && days <= 3660)).toBe(true);
    }
    expect(INSIGHT_RANGE_DAYS.all_time).toBeNull();
  });
});

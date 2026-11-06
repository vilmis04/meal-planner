import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLAN_DAY_COUNT_DEFAULT,
  PLAN_DAY_COUNT_MAX,
  PLAN_DAY_COUNT_MIN,
  PLAN_KINDS,
  addDays,
  clampDayCount,
  getDefaultStartDate,
  getPlanDays,
  getPlanEndDate,
  getPlanServings,
  getVisibleMealTypes,
  isIsoDate,
  toLocalIsoDate,
} from "./mealPlan";

describe("plan limits", () => {
  // Written out on purpose: these are the database checks.
  it("matches the database checks", () => {
    expect([...PLAN_KINDS].sort()).toEqual(["household", "individual"]);
    expect([PLAN_DAY_COUNT_MIN, PLAN_DAY_COUNT_DEFAULT, PLAN_DAY_COUNT_MAX]).toEqual([1, 7, 14]);
  });
});

describe("getDefaultStartDate", () => {
  it.each([
    ["a Monday", "2026-10-26", "2026-11-02"],
    ["a Tuesday", "2026-10-27", "2026-11-02"],
    ["a Saturday", "2026-10-31", "2026-11-02"],
    ["a Sunday", "2026-11-01", "2026-11-02"],
    ["the end of a month", "2026-11-28", "2026-11-30"],
    ["the end of a year", "2026-12-29", "2027-01-04"],
    ["a leap year February", "2028-02-27", "2028-02-28"],
  ])("from %s gives the next Monday", (_description, today, expected) => {
    expect(getDefaultStartDate(today)).toBe(expected);
  });
});

describe("clampDayCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [7, 7],
    [14, 14],
    [15, 14],
    [-3, 1],
    [6.6, 7],
  ])("keeps %s within 1 to 14 as %s", (value, expected) => {
    expect(clampDayCount(value)).toBe(expected);
  });

  it("falls back to 7 for something that is not a number", () => {
    expect(clampDayCount(Number.NaN)).toBe(7);
  });
});

describe("plan days", () => {
  it("lists every date of the plan in order", () => {
    expect(getPlanDays("2026-10-27", 7)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("gives the last day as the end date", () => {
    expect(getPlanEndDate("2026-10-27", 7)).toBe("2026-11-02");
    expect(getPlanEndDate("2026-10-27", 1)).toBe("2026-10-27");
    expect(getPlanEndDate("2026-12-25", 14)).toBe("2027-01-07");
  });

  describe("across a daylight saving change", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("never skips or repeats a day", () => {
      vi.stubEnv("TZ", "Europe/Vilnius");
      // Clocks go back on 25 Oct 2026 in Vilnius.
      expect(getPlanDays("2026-10-24", 3)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
      expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    });
  });
});

describe("toLocalIsoDate", () => {
  it("uses the local calendar date", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("isIsoDate", () => {
  it.each(["2026-10-27", "2028-02-29"])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "27/10/2026", "2026-10-27T00:00:00Z", "", null, 20261027])(
    "rejects %s",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("getVisibleMealTypes", () => {
  it("shows all four meals when snacks are included", () => {
    expect(getVisibleMealTypes(true)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  it("hides the snack and keeps the order when snacks are skipped", () => {
    expect(getVisibleMealTypes(false)).toEqual(["breakfast", "lunch", "dinner"]);
  });
});

describe("getPlanServings", () => {
  it("is one portion per participant", () => {
    expect(getPlanServings(["ana", "monika", "petras"])).toBe(3);
    expect(getPlanServings(["monika"])).toBe(1);
  });

  it("counts a participant once", () => {
    expect(getPlanServings(["monika", "monika"])).toBe(1);
  });

  it("is 0 for a plan with no one in it", () => {
    expect(getPlanServings([])).toBe(0);
  });
});

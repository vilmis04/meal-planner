import { describe, expect, it } from "vitest";
import { ODD_SPACES, formatDateTime, formatDateTimeRange, formatList, formatNumber } from "./localeFormat";

// ODD_SPACES is global, so search() is used: it ignores lastIndex.
const hasOddSpaces = (text: string): boolean => text.search(ODD_SPACES) !== -1;

describe("formatNumber", () => {
  it("groups and separates decimals the way each language does", () => {
    expect(formatNumber(1920, "en")).toBe("1,920");
    expect(formatNumber(1.5, "en")).toBe("1.5");
    expect(formatNumber(1.5, "lt")).toBe("1,5");
  });

  it("writes Lithuanian thousands with a plain space, the same on the server and in the browser", () => {
    const text = formatNumber(12500, "lt");
    expect(text).toBe("12 500");
    expect(hasOddSpaces(text)).toBe(false);
  });

  it("passes the options on", () => {
    expect(formatNumber(1.236, "en", { maximumFractionDigits: 2 })).toBe("1.24");
  });
});

describe("formatList", () => {
  it("joins names with the language's own word", () => {
    expect(formatList(["Ana", "Jonas", "Rūta"], "en")).toBe("Ana, Jonas and Rūta");
    expect(formatList(["Ana", "Jonas", "Rūta"], "lt")).toBe("Ana, Jonas ir Rūta");
  });
});

describe("formatDateTime", () => {
  const moment = new Date("2026-11-09T10:00:00Z");

  it("puts the day first in English", () => {
    expect(formatDateTime(moment, "en", { day: "numeric", month: "short", timeZone: "UTC" })).toBe("9 Nov");
  });

  it("spells the month out in Lithuanian, which has no short month names", () => {
    expect(formatDateTime(moment, "lt", { day: "numeric", month: "short", timeZone: "UTC" })).toBe("lapkričio 9 d.");
  });
});

describe("formatDateTimeRange", () => {
  it("leaves out what both ends share, without odd spaces", () => {
    const range = formatDateTimeRange(
      new Date("2026-11-09T00:00:00Z"),
      new Date("2026-11-15T00:00:00Z"),
      "en",
      { day: "numeric", month: "short", timeZone: "UTC" },
    );
    expect(range).toBe("9 – 15 Nov");
    expect(hasOddSpaces(range)).toBe(false);
  });
});

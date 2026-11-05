import { describe, expect, it } from "vitest";
import { createSwapMissLimiter } from "./swapMissLimiter";

describe("swap miss limiter", () => {
  it("allows up to the limit per user per hour", () => {
    let now = 0;
    const allow = createSwapMissLimiter(2, () => now);
    expect([allow("ana"), allow("ana"), allow("ana")]).toEqual([true, true, false]);
    expect(allow("ben")).toBe(true);

    now = 60 * 60 * 1000 + 1;
    expect(allow("ana")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { BREAKPOINTS, DISPLAY_THRESHOLDS, getMaxWidthQuery, getMinWidthQuery } from "./layoutBreakpoints";

describe("layout breakpoints", () => {
  it("are Vuetify's display thresholds", () => {
    expect(DISPLAY_THRESHOLDS).toEqual({ xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920, xxl: 2560 });
  });

  it("go up in order", () => {
    const widths = Object.values(BREAKPOINTS);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  it("write the media query from a breakpoint up and below it", () => {
    expect(getMinWidthQuery("md")).toBe("(min-width: 960px)");
    expect(getMaxWidthQuery("md")).toBe("(max-width: 959.98px)");
    expect(getMaxWidthQuery("lg")).toBe("(max-width: 1279.98px)");
  });
});

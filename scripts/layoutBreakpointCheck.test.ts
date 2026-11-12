import { describe, expect, it } from "vitest";
import { checkLayoutBreakpoints } from "./layoutBreakpointCheck";

const check = (path: string, text: string): string[] => checkLayoutBreakpoints([{ path, text }]);

describe("checkLayoutBreakpoints", () => {
  it("passes the defined breakpoints, from and below, however they are spaced", () => {
    const style = [
      "@media (min-width: 960px) { .a { display: none; } }",
      "@media (max-width:959.98px) { .b { display: none; } }",
      "@media (min-width: 1280px) and (prefers-reduced-motion: reduce) { .c { transition: none; } }",
      "@media (prefers-color-scheme: dark) { .d { opacity: 1; } }",
      "@container recipe-detail (min-width: 560px) { .e { display: grid; } }",
      "/* Below --breakpoint-md: the list; @media (min-width: 720px) {} reads as prose here. */",
    ].join("\n");
    expect(check("app/components/Good.vue", `<template><div /></template>\n<style module>\n${style}\n</style>`)).toEqual([]);
  });

  it("finds other widths, with their lines", () => {
    const style = "\n@media (min-width: 720px) {}\n@media (max-width: 960px) {}\n@media (width >= 600px) {}\n";
    expect(check("app/components/Bad.vue", style)).toEqual([
      "app/components/Bad.vue:2: (min-width: 720px) is not a layout breakpoint",
      "app/components/Bad.vue:3: (max-width: 960px) is not a layout breakpoint",
      "app/components/Bad.vue:4: (width >= 600px) is not a layout breakpoint",
    ]);
  });

  it("finds each wrong width of a query that has several", () => {
    expect(check("app/a.css", "@media (min-width: 600px) and (max-width: 900px) {}")).toEqual([
      "app/a.css:1: (max-width: 900px) is not a layout breakpoint",
    ]);
  });

  it("keeps the breakpoint tokens equal to the defined breakpoints", () => {
    const tokens = ":root {\n  --breakpoint-sm: 600px;\n  --breakpoint-md: 900px;\n  --breakpoint-huge: 3000px;\n}";
    expect(check("app/assets/css/tokens.css", tokens)).toEqual([
      "app/assets/css/tokens.css:3: --breakpoint-md: 900px; does not match shared/utils/layoutBreakpoints.ts",
      "app/assets/css/tokens.css:4: --breakpoint-huge: 3000px; does not match shared/utils/layoutBreakpoints.ts",
    ]);
  });
});

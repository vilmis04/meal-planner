import { describe, expect, it } from "vitest";
import { checkThemeColors } from "./themeColorCheck";

const check = (path: string, text: string): string[] => checkThemeColors([{ path, text }]);

const component = (template: string, style = "", script = ""): string =>
  `<script setup lang="ts">\n${script}\n</script>\n\n<template>\n${template}\n</template>\n\n<style module>\n${style}\n</style>\n`;

describe("checkThemeColors", () => {
  it("passes theme tokens", () => {
    const style = [
      ".a { color: var(--color-muted); background: rgba(var(--v-theme-primary), 0.14); }",
      ".b { border: 1px solid rgb(var(--v-theme-border)); white-space: nowrap; background: transparent; }",
      ".c:hover { --batch-rgb: var(--v-theme-secondary); color: currentColor; }",
    ].join("\n");
    const template = '<v-btn color="primary" bg-color="surface" />\n<template #default><a href="#main">x</a></template>';
    expect(check("app/components/Good.vue", component(template, style, 'const tone = { color: "warning" };'))).toEqual([]);
  });

  it("finds hex colors, color functions and named colors in styles, with their lines", () => {
    const style = ".a {\n  color: #fff;\n  background-color: rgb(255 255 255 / 14%);\n  border-color: white;\n}";
    expect(check("app/components/Bad.vue", component("<div />", style))).toEqual([
      "app/components/Bad.vue:11: #fff is not a theme color",
      "app/components/Bad.vue:12: rgb(255 255 255 / 14%) is not a theme color",
      "app/components/Bad.vue:13: white is not a theme color",
    ]);
  });

  it("checks CSS files", () => {
    expect(check("app/assets/css/extra.css", "body {\n  color: hsl(0, 0%, 10%);\n}")).toEqual([
      "app/assets/css/extra.css:2: hsl(0, 0%, 10%) is not a theme color",
    ]);
  });

  it("finds palette colors and literal colors in templates and scripts", () => {
    const text = component('<v-chip color="red-lighten-2" :style="{ color: \'#0B6B43\' }" />', "", 'const tone = { color: "grey" };');
    expect(check("app/components/Bad.vue", text)).toEqual([
      "app/components/Bad.vue:6: #0B6B43 is not a theme color",
      'app/components/Bad.vue:6: color="red-lighten-2" is not a theme color',
      'app/components/Bad.vue:2: color: "grey" is not a theme color',
    ]);
  });

  it("checks TypeScript files", () => {
    expect(check("app/utils/chart.ts", 'export const LINE = "rgba(0, 0, 0, 0.5)";')).toEqual([
      "app/utils/chart.ts:1: rgba(0, 0, 0, 0.5) is not a theme color",
    ]);
  });
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The Nuxt aliases the app's own modules import with, so their tests resolve them as the app does.
export default defineConfig({
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      // The modules unit tests can reach: Vue components, pages and Nuxt plugins are checked in the browser instead.
      include: ["shared/**/*.ts", "server/**/*.ts", "app/utils/**/*.ts", "scripts/**/*.ts", "i18n/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.types.ts"],
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      // A floor for the pure rules (plan generator, scaling, shopping list merging, diets and the rest of shared/):
      // they are fully unit tested, so a drop means new logic came without tests. The server's stores and handlers
      // talk to Supabase and are covered by the database tests instead, so they get no floor.
      thresholds: {
        "shared/**/*.ts": { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  },
});

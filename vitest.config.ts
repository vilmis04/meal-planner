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
});

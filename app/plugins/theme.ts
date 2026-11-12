import { appendResponseHeader, setResponseHeader } from "h3";

// Applies the theme cookie on every render, so all layouts get it without a component having to.
export default defineNuxtPlugin({
  name: "theme",
  // vuetify-nuxt-module creates Vuetify in a parallel plugin, so wait for it explicitly.
  // Nuxt ignores the name that isn't registered on the current side.
  dependsOn: ["vuetify:nuxt:server:plugin", "vuetify:nuxt:client:plugin"],
  setup(nuxtApp) {
    const { preference, applyPreference, rememberSystemTheme } = useAppTheme();
    const theme = nuxtApp.$vuetify.theme;
    applyPreference(preference.value);

    // <html> carries the rendered theme and preference for SYSTEM_THEME_SCRIPT, and its color scheme, so the
    // canvas and scrollbars match before Vuetify's stylesheet (at the start of <body>) is read.
    useHead({
      htmlAttrs: {
        "data-theme": () => theme.global.name.value,
        "data-theme-preference": () => preference.value,
        style: () => `color-scheme: ${theme.global.name.value}`,
      },
      script: [{ key: "system-theme", innerHTML: SYSTEM_THEME_SCRIPT, tagPriority: "critical" }],
    });

    if (import.meta.server) {
      // Chromium then sends the OS color scheme with every request (and Critical-CH retries this first one with
      // it), so the server renders "system" right even on a first visit.
      const event = useRequestEvent();
      if (event) {
        setResponseHeader(event, "Accept-CH", COLOR_SCHEME_HINT_HEADER);
        setResponseHeader(event, "Critical-CH", COLOR_SCHEME_HINT_HEADER);
        appendResponseHeader(event, "Vary", COLOR_SCHEME_HINT_HEADER);
      }
    }

    if (import.meta.client) {
      onNuxtReady(() => {
        // Hydration is over, so "system" can now follow the OS setting live.
        applyPreference(preference.value);
        watch(() => theme.global.name.value, rememberSystemTheme, { immediate: true });
      });
    }
  },
});

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ["~/assets/css/tokens.css", "~/assets/css/theme.css"],

  runtimeConfig: {
    supabaseServiceRoleKey: "",
    public: {
      supabaseUrl: "",
      supabaseAnonKey: "",
    },
  },

  nitro: {
    preset: "node-server",
  },

  modules: ["vuetify-nuxt-module", "@nuxtjs/i18n"],

  i18n: {
    strategy: "no_prefix",
    defaultLocale: "en",
    locales: [
      { code: "en", language: "en-US", name: "English", file: "en.json" },
      { code: "lt", language: "lt-LT", name: "Lietuvių", file: "lt.json" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "locale",
      fallbackLocale: "en",
    },
  },

  // Palette values here must stay in sync with app/assets/css/theme.css,
  // which mirrors the same colors as CSS custom properties for CSS-modules layout code.
  vuetify: {
    moduleOptions: {},
    vuetifyOptions: {
      theme: {
        defaultTheme: "light",
        themes: {
          light: {
            dark: false,
            colors: {
              primary: "#0B6B43",
              secondary: "#9A5B00",
              background: "#F4F6F3",
              surface: "#FFFFFF",
              error: "#B8382A",
              warning: "#9A5B00",
              info: "#2563EB",
              success: "#0B6B43",
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: "#6FD39C",
              "on-primary": "#062A1A",
              secondary: "#F2B544",
              background: "#0D1612",
              surface: "#15211B",
              error: "#F08A7C",
              warning: "#F2B544",
              info: "#60A5FA",
              success: "#6FD39C",
            },
          },
        },
      },
    },
  },
})
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

  modules: ["vuetify-nuxt-module"],

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
              primary: "#16A34A",
              secondary: "#F59E0B",
              background: "#FFFFFF",
              surface: "#F8FAFC",
              error: "#DC2626",
              warning: "#D97706",
              info: "#2563EB",
              success: "#16A34A",
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: "#4ADE80",
              secondary: "#FBBF24",
              background: "#0F172A",
              surface: "#1E293B",
              error: "#F87171",
              warning: "#FBBF24",
              info: "#60A5FA",
              success: "#4ADE80",
            },
          },
        },
      },
    },
  },
})
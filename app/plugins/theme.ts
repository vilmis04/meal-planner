// Applies the theme cookie on every render, so all layouts get it without a component having to.
export default defineNuxtPlugin({
  name: "theme",
  // vuetify-nuxt-module creates Vuetify in a parallel plugin, so wait for it explicitly.
  // Nuxt ignores the name that isn't registered on the current side.
  dependsOn: ["vuetify:nuxt:server:plugin", "vuetify:nuxt:client:plugin"],
  setup(nuxtApp) {
    const { preference, applyPreference, rememberSystemTheme } = useAppTheme();
    applyPreference(preference.value);

    if (import.meta.client) {
      const theme = nuxtApp.$vuetify.theme;
      onNuxtReady(() => {
        // Hydration is over, so "system" can now follow the OS setting live.
        applyPreference(preference.value);
        watch(() => theme.global.name.value, rememberSystemTheme, { immediate: true });
      });
    }
  },
});

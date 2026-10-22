<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <v-app>
    <v-app-bar flat border>
      <v-app-bar-title>{{ t("app.name") }}</v-app-bar-title>
      <v-spacer />
      <AppThemeToggle />
      <v-btn icon="mdi-account-circle" variant="text" to="/me" :aria-label="t('profile.open')" />
    </v-app-bar>

    <v-main>
      <div :class="$style.container">
        <slot />
      </div>
    </v-main>

    <AppNavigation />
    <AppSnackbar />
  </v-app>
</template>

<style module>
.container {
  max-width: var(--layout-max-width);
  margin-inline: auto;
  /* Keeps the end of every page clear of the fixed bottom navigation. */
  padding: var(--space-4) var(--space-3) calc(var(--nav-height) + var(--space-4));
}

/* 960px is --breakpoint-md; custom properties cannot be used in media queries. */
@media (min-width: 960px) {
  .container {
    /* The navigation becomes a rail on the left edge instead. */
    padding: var(--space-4) var(--space-3) var(--space-4) calc(var(--nav-rail-width) + var(--space-3));
  }
}
</style>

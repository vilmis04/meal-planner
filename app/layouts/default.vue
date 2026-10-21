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

    <AppSnackbar />
  </v-app>
</template>

<style module>
.container {
  max-width: var(--layout-max-width);
  margin-inline: auto;
  padding: var(--space-4) var(--space-3);
}
</style>

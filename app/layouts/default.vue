<template>
  <v-app>
    <v-app-bar flat border>
      <v-app-bar-title>{{ t("app.title") }}</v-app-bar-title>
      <v-spacer />
      <AppThemeToggle />
    </v-app-bar>

    <v-main>
      <div :class="$style.container">
        <slot />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>

<style module>
.container {
  max-width: var(--layout-max-width);
  margin-inline: auto;
  padding: var(--space-4) var(--space-3);
}
</style>

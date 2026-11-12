<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <v-app>
    <!-- Phones and small tablets: a bar along the top with the language, the theme and the profile. From 960px they
         move to the foot of the navigation rail, as in the desktop design, and the bar goes. -->
    <header :class="$style.topBar">
      <span :class="$style.appName">{{ t("app.name") }}</span>
      <AppLanguageSwitcher />
      <AppThemeToggle />
      <v-btn icon="mdi-account-circle" variant="text" to="/me" :aria-label="t('profile.open')" />
    </header>

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
.topBar {
  position: sticky;
  top: 0;
  z-index: 1004;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--app-bar-height);
  padding-inline: var(--page-gutter) var(--space-1);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-on-surface);
}

/* The name takes the free space itself, so the buttons never cut it short on a phone. */
.appName {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.container {
  /* Keeps the end of every page clear of the fixed bottom navigation. */
  padding: var(--space-4) var(--page-gutter) calc(var(--nav-height) + var(--space-4) + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 960px) {
  .topBar {
    display: none;
  }

  .container {
    /* The navigation becomes a rail on the left edge instead. */
    padding: var(--space-4) var(--space-4) var(--space-4) calc(var(--nav-rail-width) + var(--space-4));
  }
}
</style>

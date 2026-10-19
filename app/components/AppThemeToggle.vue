<template>
  <v-btn
    :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
    variant="text"
    :aria-label="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggleTheme"
  />
</template>

<script setup lang="ts">
const { t } = useI18n();
const { isDark, toggleTheme } = useAppTheme();
</script>

<template>
  <v-btn
    :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
    variant="text"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggleTheme"
  />
</template>

<script setup lang="ts">
const { isDark, toggleTheme } = useAppTheme();
</script>

<script setup lang="ts">
const { t } = useI18n();
const { isDark } = useAppTheme();
const { changeTheme } = useProfileSettings();
const { show } = useAppSnackbar();

async function handleClick() {
  const isSaved = await changeTheme(isDark.value ? "light" : "dark");
  if (!isSaved) {
    show("profile.errors.saveFailed", "error");
  }
}
</script>

<template>
  <v-btn
    :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
    variant="text"
    :aria-label="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="handleClick"
  />
</template>

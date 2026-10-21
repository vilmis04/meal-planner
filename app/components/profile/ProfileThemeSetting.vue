<script setup lang="ts">
import type { ThemePreference } from "~/types/profile.types";

const THEME_ICONS: Record<ThemePreference, string> = {
  light: "mdi-weather-sunny",
  dark: "mdi-weather-night",
  system: "mdi-theme-light-dark",
};

const { t } = useI18n();
const { preference } = useAppTheme();
const { changeTheme } = useProfileSettings();
const { show } = useAppSnackbar();

const options = computed(() =>
  THEME_PREFERENCES.map((value) => ({
    value,
    label: t(`profile.theme.${value}`),
    icon: THEME_ICONS[value],
  })),
);

async function handleSelect(next: ThemePreference) {
  const isSaved = await changeTheme(next);
  if (!isSaved) {
    show("profile.errors.saveFailed", "error");
  }
}
</script>

<template>
  <ProfileChoiceSetting
    :title="t('profile.theme.title')"
    :options="options"
    :selected="preference"
    @select="handleSelect"
  />
</template>

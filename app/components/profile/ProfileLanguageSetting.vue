<script setup lang="ts">
import type { LocaleCode } from "~/types/profile.types";

const { t, locale, locales } = useI18n();
const { changeLanguage } = useProfileSettings();
const { show } = useAppSnackbar();

// Locale names ("English", "Lietuvių") come from i18n.locales in nuxt.config.ts.
const options = computed(() =>
  locales.value.map(({ code, name }) => ({ value: code, label: name ?? code })),
);

async function handleSelect(next: LocaleCode) {
  const isSaved = await changeLanguage(next);
  if (!isSaved) {
    show("profile.errors.saveFailed", "error");
  }
}
</script>

<template>
  <ProfileChoiceSetting
    :title="t('profile.language.title')"
    :options="options"
    :selected="locale"
    @select="handleSelect"
  />
</template>

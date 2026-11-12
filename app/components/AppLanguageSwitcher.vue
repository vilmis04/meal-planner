<script setup lang="ts">
import type { LocaleCode } from "~/types/profile.types";

// On the auth hero the pill carries the translate icon and a light outline, as in the mock-up.
const { isOnHero = false } = defineProps<{ isOnHero?: boolean }>();

const { t, locale, locales, localeProperties } = useI18n();
const { changeLanguage } = useProfileSettings();
const { show } = useAppSnackbar();

// Locale names ("English", "Lietuvių") come from i18n.locales in nuxt.config.ts; each is written in its own language.
const options = computed(() =>
  locales.value.map(({ code, name, language }) => ({ code, label: name ?? code, language })),
);
const currentName = computed(() => localeProperties.value.name ?? locale.value);

async function handleSelect(next: LocaleCode) {
  if (next === locale.value) {
    return;
  }
  const isSaved = await changeLanguage(next);
  if (!isSaved) {
    show("profile.errors.saveFailed", "error");
  }
}
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        :class="[$style.pill, isOnHero && $style.onHero]"
        :prepend-icon="isOnHero ? 'mdi-translate' : undefined"
        variant="outlined"
        rounded="pill"
        :aria-label="t('language.switcher', { language: currentName })"
      >
        {{ locale.toUpperCase() }}
      </v-btn>
    </template>

    <v-list density="compact" :aria-label="t('profile.language.title')">
      <v-list-item
        v-for="option in options"
        :key="option.code"
        :lang="option.language"
        :active="option.code === locale"
        color="primary"
        @click="handleSelect(option.code)"
      >
        <v-list-item-title>{{ option.label }}</v-list-item-title>
        <template #append>
          <v-icon v-if="option.code === locale" icon="mdi-check" size="18" />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<style module>
.pill {
  height: 36px;
  min-width: 0;
  padding-inline: 10px;
  border-color: var(--color-border);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: normal;
}

.onHero {
  padding-inline: 12px;
  border-color: rgb(255 255 255 / 30%);
}
</style>

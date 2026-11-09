<script setup lang="ts">
// "Show nutrition" (F1): one setting per user, the same on plans and recipes. With isCompactOnPhone it is a round
// icon button below 960px, as in the phone nutrition design, and a labelled button from there.
defineProps<{ isCompactOnPhone?: boolean }>();

const { t } = useI18n();
const { isNutritionShown, setNutritionShown } = useNutritionVisibility();
const { show } = useAppSnackbar();

const label = computed(() => (isNutritionShown.value ? t("nutrition.hide") : t("nutrition.show")));

async function toggle() {
  const isSaved = await setNutritionShown(!isNutritionShown.value);
  if (!isSaved) {
    show("nutrition.saveFailed", "error");
  }
}
</script>

<template>
  <v-btn
    v-if="isCompactOnPhone"
    icon="mdi-chart-donut"
    :variant="isNutritionShown ? 'tonal' : 'text'"
    :color="isNutritionShown ? 'primary' : undefined"
    :aria-label="label"
    :aria-pressed="isNutritionShown"
    :class="$style.iconButton"
    data-testid="nutrition-toggle-icon"
    @click="toggle"
  />
  <v-btn
    :variant="isNutritionShown ? 'tonal' : 'outlined'"
    :color="isNutritionShown ? 'primary' : undefined"
    rounded="pill"
    prepend-icon="mdi-chart-donut"
    :aria-pressed="isNutritionShown"
    :class="[$style.textButton, { [$style.desktopOnly]: isCompactOnPhone }]"
    data-testid="nutrition-toggle"
    @click="toggle"
  >
    {{ label }}
  </v-btn>
</template>

<style module>
.iconButton {
  flex: 0 0 auto;
}

.textButton {
  flex: 0 0 auto;
  min-height: 44px;
  text-transform: none;
}

/* 960px is --breakpoint-md. */
@media (max-width: 959.98px) {
  .desktopOnly {
    display: none;
  }
}

@media (min-width: 960px) {
  .iconButton {
    display: none;
  }
}
</style>

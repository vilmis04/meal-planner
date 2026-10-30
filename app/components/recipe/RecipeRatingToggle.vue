<script setup lang="ts">
const props = defineProps<{ recipeId: string }>();

const { t } = useI18n();
const { ratingOf, rate } = useRecipeRatings();
const { show } = useAppSnackbar();

const current = computed(() => ratingOf(props.recipeId));

const options = computed(() =>
  RECIPE_RATINGS.map((rating) => ({
    rating,
    label: t(`recipes.rating.options.${rating}`),
    icon: RECIPE_RATING_DISPLAY[rating].icon,
    color: RECIPE_RATING_DISPLAY[rating].color,
    isActive: current.value === rating,
  })),
);

// Tapping the rating a recipe already has clears it.
async function handleTap(tapped: RecipeRating) {
  const isSaved = await rate(props.recipeId, nextRating(current.value, tapped));
  if (!isSaved) {
    show("recipes.rating.saveFailed", "error");
  }
}
</script>

<template>
  <div role="group" :aria-label="t('recipes.rating.label')" :class="$style.group" data-testid="recipe-rating">
    <v-btn
      v-for="option in options"
      :key="option.rating"
      :variant="option.isActive ? 'tonal' : 'text'"
      :color="option.isActive ? option.color : undefined"
      :prepend-icon="option.icon"
      :aria-pressed="option.isActive"
      :class="$style.option"
      rounded="0"
      :data-testid="`recipe-rating-${option.rating}`"
      @click="handleTap(option.rating)"
    >
      {{ option.label }}
    </v-btn>
  </div>
</template>

<style module>
.group {
  display: flex;
  margin-top: var(--space-1);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-muted) 45%, transparent);
  border-radius: 12px;
}

/* Sized by their labels and then sharing what is left, so a long label ("Mažiau mėgstu") never clips its icon. */
.option {
  flex: 1 1 auto;
  min-width: 0;
  height: 44px !important;
  padding-inline: var(--space-1) !important;
  font-size: 14px;
  letter-spacing: normal;
  text-transform: none;
}

.option + .option {
  border-inline-start: 1px solid color-mix(in srgb, var(--color-muted) 45%, transparent);
}
</style>

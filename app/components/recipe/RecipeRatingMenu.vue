<script setup lang="ts">
const props = defineProps<{ recipeId: string; recipeName: string }>();

const { t } = useI18n();
const { ratingOf, rate } = useRecipeRatings();
const { show } = useAppSnackbar();

const current = computed(() => ratingOf(props.recipeId));
// The button shows the current rating, or an outlined heart while the recipe is unrated.
const buttonIcon = computed(() => (current.value ? RECIPE_RATING_DISPLAY[current.value].icon : UNRATED_ICON));
const buttonColor = computed(() => (current.value ? RECIPE_RATING_DISPLAY[current.value].color : undefined));

const options = computed(() =>
  RECIPE_RATINGS.map((rating) => ({
    rating,
    label: t(`recipes.rating.options.${rating}`),
    icon: RECIPE_RATING_DISPLAY[rating].icon,
    color: RECIPE_RATING_DISPLAY[rating].color,
    isActive: current.value === rating,
  })),
);

async function save(rating: RecipeRating | null) {
  const isSaved = await rate(props.recipeId, rating);
  if (!isSaved) {
    show("recipes.rating.saveFailed", "error");
  }
}
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        :icon="buttonIcon"
        :color="buttonColor"
        :width="44"
        :height="44"
        variant="text"
        :aria-label="t('recipes.rating.rate', { name: recipeName })"
        data-testid="recipe-rating-menu"
      />
    </template>
    <v-list density="comfortable" :aria-label="t('recipes.rating.label')">
      <v-list-item
        v-for="option in options"
        :key="option.rating"
        :prepend-icon="option.icon"
        :title="option.label"
        :active="option.isActive"
        :color="option.color"
        :aria-current="option.isActive || undefined"
        :data-testid="`recipe-rating-menu-${option.rating}`"
        @click="save(nextRating(current, option.rating))"
      />
      <v-list-item
        v-if="current"
        prepend-icon="mdi-close"
        :title="t('recipes.rating.clear')"
        data-testid="recipe-rating-menu-clear"
        @click="save(null)"
      />
    </v-list>
  </v-menu>
</template>

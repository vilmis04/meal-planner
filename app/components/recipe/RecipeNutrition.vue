<script setup lang="ts">
import type { Diet } from "#shared/utils/diet";
import type { Recipe, RecipeSwapState } from "~/types/recipe.types";

// A recipe's calories and macros per portion (F1), shown once the user asks for nutrition. While the user's protein
// swap is shown (D3) the values are the swap's estimate, or the recipe's own as an approximation when it has none.
const props = defineProps<{
  recipe: Recipe;
  diet: Diet | null;
  swapState: RecipeSwapState;
  showOriginal: boolean;
}>();

const { t } = useI18n();
const { nutritionByRecipe, loadFailed } = useRecipeNutrition();
const { formatNumber, formatGrams } = useNutritionFormat();

const meal = computed(() => {
  const nutrition = nutritionByRecipe.value?.[props.recipe.id];
  if (!nutrition) {
    return null;
  }
  const swap = props.swapState.status === "ready" && !props.showOriginal ? props.swapState.swap : null;
  const swapNutrition = swap?.nutrition && isNutritionComplete(swap.nutrition) ? swap.nutrition : null;
  return getMealNutrition(
    props.recipe.id,
    { mainProteins: props.recipe.mainProteins, nutrition },
    swap ? props.diet : null,
    new Map(swapNutrition && props.diet ? [[props.recipe.id, { [props.diet]: swapNutrition }]] : []),
  );
});

const tiles = computed(() => {
  const nutrition = meal.value?.nutrition;
  if (!nutrition) {
    return [];
  }
  return [
    { key: "kcal", label: t("nutrition.kcal"), value: formatNumber(nutrition.caloriesKcal) },
    { key: "carbohydrates", label: t("nutrition.carbohydrates"), value: formatGrams(nutrition.carbohydrates) },
    { key: "protein", label: t("nutrition.protein"), value: formatGrams(nutrition.protein) },
    { key: "fat", label: t("nutrition.fat"), value: formatGrams(nutrition.fat) },
  ];
});

const sourceNote = computed(() => {
  if (meal.value?.source === "swap") {
    return t("nutrition.recipe.swapEstimate");
  }
  if (meal.value?.source === "recipe_without_swap_estimate") {
    return t("nutrition.recipe.swapWithoutEstimate");
  }
  return null;
});
</script>

<template>
  <section :class="$style.section" :aria-label="t('nutrition.recipe.title')" data-testid="recipe-nutrition">
    <v-alert v-if="loadFailed" type="error" variant="tonal" density="compact">{{ t("nutrition.loadFailed") }}</v-alert>
    <template v-else-if="meal">
      <dl :class="$style.tiles">
        <div v-for="tile in tiles" :key="tile.key" :class="$style.tile" :data-testid="`recipe-nutrition-${tile.key}`">
          <dt :class="$style.label">{{ tile.label }}</dt>
          <dd :class="$style.value">{{ tile.value }}</dd>
        </div>
      </dl>
      <p v-if="sourceNote" :class="$style.note" data-testid="recipe-nutrition-approximate">{{ sourceNote }}</p>
      <p v-if="!meal.isComplete" :class="$style.note" data-testid="recipe-nutrition-incomplete">
        {{ t("nutrition.recipe.incomplete") }}
      </p>
    </template>
    <v-progress-linear v-else indeterminate rounded color="primary" />
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Four values in a row, as in the recipe design. */
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding-inline: var(--space-1);
}

.tile {
  min-width: 0;
}

.label {
  font-size: 12px;
  color: var(--color-muted);
}

.value {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-muted);
}
</style>

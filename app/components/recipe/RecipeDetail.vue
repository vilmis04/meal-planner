<script setup lang="ts">
import type { Recipe } from "~/types/recipe.types";

const props = defineProps<{ recipe: Recipe }>();

const { t } = useI18n();
const { isLoaded: isRatingLoaded } = useRecipeRatings();
const { diet, state: swapState, showOriginal } = useRecipeSwap(() => props.recipe);
const { isNutritionShown } = useNutritionVisibility();

// The swapped ingredients while a swap is shown, the recipe's own after "Show original" or without a swap.
const ingredients = computed(() =>
  swapState.value.status === "ready" && !showOriginal.value
    ? applySwap(props.recipe.ingredients, swapState.value.swap.items)
    : props.recipe.ingredients,
);
</script>

<template>
  <article :class="$style.detail" data-testid="recipe-detail">
    <header :class="$style.header">
      <div :class="$style.tags">
        <v-chip size="small" label variant="tonal">{{ t(`recipes.mealType.${recipe.mealType}`) }}</v-chip>
        <RecipeBatchChip :portion-days="recipe.portionDays" data-testid="recipe-batch" />
      </div>
      <h2 :class="$style.title">{{ recipe.name }}</h2>
      <RecipeRatingToggle v-if="isRatingLoaded" :recipe-id="recipe.id" />
      <NutritionToggle :class="$style.nutritionToggle" />
    </header>

    <RecipeNutrition
      v-if="isNutritionShown"
      :recipe="recipe"
      :diet="diet"
      :swap-state="swapState"
      :show-original="showOriginal"
    />

    <RecipeSwapCard v-if="diet && swapState.status !== 'none'" v-model:show-original="showOriginal" :diet="diet" :state="swapState" />

    <!-- The seed has one recipe with no ingredients and no instructions yet; its empty sections are left out. -->
    <section v-if="recipe.ingredients.length > 0" :class="$style.section">
      <div :class="$style.sectionHeading">
        <h3 :class="$style.sectionTitle">{{ t("recipes.detail.ingredients") }}</h3>
        <p :class="$style.hint">{{ t("recipes.detail.ingredientsHint") }}</p>
      </div>
      <RecipeIngredientList :ingredients="ingredients" />
    </section>

    <section v-if="recipe.instructions" :class="$style.section">
      <h3 :class="$style.sectionTitle">{{ t("recipes.detail.instructions") }}</h3>
      <p :class="$style.instructions" data-testid="recipe-instructions">{{ recipe.instructions }}</p>
    </section>
  </article>
</template>

<style module>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  /* Lets the ingredient list ask how wide the detail itself is, not the screen. */
  container: recipe-detail / inline-size;
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.nutritionToggle {
  align-self: flex-start;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sectionHeading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-inline: var(--space-1);
}

.sectionTitle {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: 17px;
  font-weight: 700;
}

.sectionHeading .sectionTitle {
  padding-inline: 0;
}

.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
}

.instructions {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: 15px;
  line-height: 1.55;
  white-space: pre-line;
}
</style>

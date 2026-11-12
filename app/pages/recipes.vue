<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { RouteLocationRaw } from "vue-router";
import type { RecipeSummary } from "~/types/recipe.types";

defineOptions({ name: "RecipesPage" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { recipes, loadFailed, loadList } = useRecipes();

useHead({ title: () => t("recipes.pageTitle") });

const { isLoaded: isRatingLoaded, loadFailed: ratingsLoadFailed, load: loadRatings } = useRecipeRatings();
const { isNutritionShown } = useNutritionVisibility();
const { nutritionByRecipe, load: loadNutrition } = useRecipeNutrition();

// Loaded once and kept; a failed load leaves the list empty, so the next visit asks again. The user's own ratings
// load beside it and fail on their own: the recipes still show, only without the rating controls.
await Promise.all([
  recipes.value ? undefined : loadList(),
  isRatingLoaded.value ? undefined : loadRatings(),
  // Calories and macros are read only for a user who asked to see them (F1).
  isNutritionShown.value && !nutritionByRecipe.value ? loadNutrition() : undefined,
]);

watch(isNutritionShown, (isShown) => {
  if (isShown && !nutritionByRecipe.value) {
    loadNutrition();
  }
});

// The filter lives in the address (?meal=dinner), so reload and the back button keep it.
const filter = computed(() => parseMealFilter(route.query.meal));
const visibleRecipes = computed(() =>
  filter.value === "all"
    ? (recipes.value ?? [])
    : (recipes.value ?? []).filter((recipe) => recipe.mealType === filter.value),
);

const isRecipeOpen = computed(() => typeof route.params.id === "string");

function changeFilter(next: MealFilter) {
  return router.replace({ query: next === DEFAULT_MEAL_FILTER ? {} : { meal: next } });
}

function recipeLocation(recipe: DeepReadonly<RecipeSummary>): RouteLocationRaw {
  return { path: `/recipes/${recipe.id}`, query: route.query };
}
</script>

<template>
  <LayoutPage width="wide">
    <!-- Phones show one pane at a time: the list, or the recipe that was opened. From 960px both show. -->
    <LayoutSplit
      aside="start"
      is-aside-sticky
      :phone-pane="isRecipeOpen ? 'main' : 'aside'"
      :aside-label="t('recipes.title')"
    >
      <template #aside>
        <h1 :class="$style.title">{{ t("recipes.title") }}</h1>

        <v-alert v-if="loadFailed" type="error" variant="tonal">
          {{ t("recipes.errors.loadFailed") }}
        </v-alert>
        <template v-else>
          <v-alert v-if="ratingsLoadFailed" type="warning" variant="tonal" density="compact" data-testid="ratings-load-failed">
            {{ t("recipes.rating.loadFailed") }}
          </v-alert>
          <RecipeMealFilter :model-value="filter" @update:model-value="changeFilter" />
          <RecipeList :recipes="visibleRecipes" :link-to="recipeLocation" />
        </template>
      </template>

      <NuxtPage />
    </LayoutSplit>
  </LayoutPage>
</template>

<style module>
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
</style>

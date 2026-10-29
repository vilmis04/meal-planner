<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { RecipeSummary } from "~/types/recipe.types";

defineOptions({ name: "RecipesPage" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { recipes, loadFailed, loadList } = useRecipes();

useHead({ title: () => t("recipes.pageTitle") });

// Loaded once and kept; a failed load leaves the list empty, so the next visit asks again.
if (!recipes.value) {
  await loadList();
}

// The filter lives in the address (?meal=dinner), so reload and the back button keep it.
const filter = computed(() => parseMealFilter(route.query.meal));
const visibleRecipes = computed(() =>
  filter.value === "all"
    ? (recipes.value ?? [])
    : (recipes.value ?? []).filter((recipe) => recipe.mealType === filter.value),
);

// Phones show one pane at a time: the list, or the recipe that was opened. From 960px both show.
const isRecipeOpen = computed(() => typeof route.params.id === "string");

function changeFilter(next: MealFilter) {
  return router.replace({ query: next === DEFAULT_MEAL_FILTER ? {} : { meal: next } });
}

function recipeLocation(recipe: RecipeSummary): RouteLocationRaw {
  return { path: `/recipes/${recipe.id}`, query: route.query };
}
</script>

<template>
  <div :class="[$style.layout, isRecipeOpen ? $style.recipeOpen : $style.listOnly]">
    <section :class="$style.listPane" :aria-label="t('recipes.title')">
      <h1 :class="$style.title">{{ t("recipes.title") }}</h1>

      <v-alert v-if="loadFailed" type="error" variant="tonal">
        {{ t("recipes.errors.loadFailed") }}
      </v-alert>
      <template v-else>
        <RecipeMealFilter :model-value="filter" @update:model-value="changeFilter" />
        <RecipeList :recipes="visibleRecipes" :link-to="recipeLocation" />
      </template>
    </section>

    <div :class="$style.detailPane">
      <NuxtPage />
    </div>
  </div>
</template>

<style module>
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.listPane {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

/* Without this the chips (a scroll container) shrink to nothing once the pane has a maximum height. */
.listPane > * {
  flex: none;
}

.detailPane {
  min-width: 0;
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

/* 960px is --breakpoint-md; custom properties cannot be used in media queries. */
@media (max-width: 959.98px) {
  .recipeOpen .listPane,
  .listOnly .detailPane {
    display: none;
  }
}

@media (min-width: 960px) {
  .layout {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    align-items: start;
  }

  /* The list keeps its place and scrolls on its own while a recipe is open beside it. */
  .listPane {
    position: sticky;
    top: calc(64px + var(--space-3));
    max-height: calc(100vh - 64px - 2 * var(--space-3));
    overflow-y: auto;
  }
}
</style>

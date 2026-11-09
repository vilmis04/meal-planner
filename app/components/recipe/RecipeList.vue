<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { RouteLocationRaw } from "vue-router";
import type { RecipeSummary } from "~/types/recipe.types";

// The cached recipe library is read-only (useRecipes()), and so is every list made from it.
defineProps<{
  recipes: DeepReadonly<RecipeSummary[]>;
  // Where a row opens its recipe; the list keeps the meal filter in the address, so the link must carry it.
  linkTo: (recipe: DeepReadonly<RecipeSummary>) => RouteLocationRaw;
}>();

const { t } = useI18n();
</script>

<template>
  <p v-if="recipes.length === 0" :class="$style.empty" data-testid="recipe-list-empty">
    {{ t("recipes.list.empty") }}
  </p>
  <ul v-else :class="$style.list" :aria-label="t('recipes.list.label')" data-testid="recipe-list">
    <li v-for="recipe in recipes" :key="recipe.id">
      <RecipeListItem :recipe="recipe" :to="linkTo(recipe)" />
    </li>
  </ul>
</template>

<style module>
.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.empty {
  margin: 0;
  padding: var(--space-4) var(--space-2);
  color: var(--color-muted);
  text-align: center;
}
</style>

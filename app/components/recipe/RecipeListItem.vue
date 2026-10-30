<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { RecipeSummary } from "~/types/recipe.types";

defineProps<{ recipe: RecipeSummary; to: RouteLocationRaw }>();

const { t } = useI18n();
const { isLoaded } = useRecipeRatings();
</script>

<template>
  <!-- The link covers the whole row (see .link::after); the rating button sits above it, as a sibling, because a
       button cannot live inside a link. -->
  <div :class="$style.row">
    <NuxtLink :to="to" :class="$style.link" :active-class="$style.active">
      <!-- Recipes have no photos yet, so every row shows the same placeholder tile. -->
      <span :class="$style.tile" aria-hidden="true">
        <v-icon icon="mdi-silverware-fork-knife" size="22" />
      </span>
      <span :class="$style.body">
        <span :class="$style.name">{{ recipe.name }}</span>
        <span :class="$style.tags">
          <v-chip size="small" label variant="tonal">{{ t(`recipes.mealType.${recipe.mealType}`) }}</v-chip>
          <RecipeBatchChip v-if="recipe.portionDays > 1" :portion-days="recipe.portionDays" />
        </span>
      </span>
    </NuxtLink>
    <span v-if="isLoaded" :class="$style.rating">
      <RecipeRatingMenu :recipe-id="recipe.id" :recipe-name="recipe.name" />
    </span>
    <v-icon icon="mdi-chevron-right" :class="$style.chevron" aria-hidden="true" />
  </div>
</template>

<style module>
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 64px;
  padding: var(--space-2);
  border-radius: var(--radius-lg);
}

.row:hover {
  background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
}

.row:has(.active) {
  background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.link {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

/* Stretches the link's tap area over the whole row, under the rating button. */
.link::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
}

.link:focus-visible {
  outline: none;
}

.link:focus-visible::after {
  outline: 2px solid var(--color-primary);
}

.tile {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--color-muted) 14%, transparent);
  color: var(--color-muted);
}

.body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

/* Two lines at most; the full name is on the recipe itself. */
.name {
  display: -webkit-box;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.rating {
  position: relative;
  z-index: 1;
  flex: none;
}

/* The link underneath takes the tap. */
.chevron {
  flex: none;
  color: var(--color-muted);
  pointer-events: none;
}
</style>

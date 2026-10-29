<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { RecipeSummary } from "~/types/recipe.types";

defineProps<{ recipe: RecipeSummary; to: RouteLocationRaw }>();

const { t } = useI18n();
</script>

<template>
  <NuxtLink :to="to" :class="$style.item" :active-class="$style.active">
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
    <v-icon icon="mdi-chevron-right" :class="$style.chevron" aria-hidden="true" />
  </NuxtLink>
</template>

<style module>
.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 64px;
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  color: inherit;
  text-decoration: none;
}

.item:hover {
  background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
}

.active {
  background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
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

.chevron {
  flex: none;
  color: var(--color-muted);
}
</style>

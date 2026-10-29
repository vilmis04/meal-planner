<script setup lang="ts">
import type { RecipeIngredient } from "~/types/recipe.types";

defineProps<{ ingredients: readonly RecipeIngredient[] }>();

const { t, locale } = useI18n();

// Units are free text from the seed (g, ml, vnt., v.š.) and shown as stored; a missing amount means "to taste".
function amountLabel(ingredient: RecipeIngredient): string {
  const amount = formatAmount(ingredient.amount, locale.value);
  if (amount === null) {
    return t("recipes.detail.toTaste");
  }
  return ingredient.unit ? `${amount} ${ingredient.unit}` : amount;
}
</script>

<template>
  <ul :class="$style.list" data-testid="recipe-ingredients">
    <li v-for="(ingredient, index) in ingredients" :key="index" :class="$style.row">
      <span :class="$style.item">{{ ingredient.item }}</span>
      <span :class="$style.amount">{{ amountLabel(ingredient) }}</span>
    </li>
  </ul>
</template>

<style module>
.list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Wide panes (desktop) set the ingredients out in two columns. */
@container recipe-detail (min-width: 560px) {
  .list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-1);
  border-bottom: 1px solid var(--color-border);
  font-size: 15px;
}

.item {
  min-width: 0;
  overflow-wrap: anywhere;
}

.amount {
  flex: none;
  max-width: 50%;
  color: var(--color-muted);
  text-align: right;
}
</style>

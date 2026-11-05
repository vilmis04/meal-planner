<script setup lang="ts">
import type { RecipeIngredient } from "~/types/recipe.types";

// A line a protein swap (D3) replaced is marked swapped and highlighted.
type IngredientRow = RecipeIngredient & { swapped?: boolean };

defineProps<{ ingredients: readonly IngredientRow[] }>();

const { t, locale } = useI18n();

// Units are free text from the seed (g, ml, vnt., v.š.) and shown as stored; a missing amount means "to taste".
function amountLabel(ingredient: IngredientRow): string {
  const amount = formatAmount(ingredient.amount, locale.value);
  if (amount === null) {
    return t("recipes.detail.toTaste");
  }
  return ingredient.unit ? `${amount} ${ingredient.unit}` : amount;
}
</script>

<template>
  <ul :class="$style.list" data-testid="recipe-ingredients">
    <li
      v-for="ingredient in ingredients"
      :key="ingredient.position"
      :class="[$style.row, ingredient.swapped && $style.swapped]"
      :data-testid="ingredient.swapped ? 'recipe-ingredient-swapped' : undefined"
    >
      <span :class="$style.item">
        {{ ingredient.item }}
        <span v-if="ingredient.swapped" :class="$style.visuallyHidden">({{ t("recipes.swap.swappedLine") }})</span>
      </span>
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

/* A swapped line stands out as a soft primary band, as in the design. */
.swapped {
  padding-inline: var(--space-3);
  margin-inline: calc(-1 * var(--space-2));
  border-bottom-color: transparent;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  font-weight: 600;
}

.swapped .amount {
  color: var(--color-primary);
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

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

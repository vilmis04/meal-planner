<script setup lang="ts">
import type { InsightMealRow } from "~/types/preferenceInsights.types";

// One list on the preference insights page (I2): a heading, what the list counts, and its meals, each linked to its
// recipe with how often it counted. With `isRatable` each row has the rating menu, so a meal can be rated where it
// shows up. The footer slot holds a link or a hint under the list.
const props = defineProps<{
  kind: "liked" | "skipped";
  heading: string;
  description: string;
  icon: string;
  meals: InsightMealRow[];
  emptyText: string;
  isRatable: boolean;
}>();

const { t } = useI18n();

const headingId = computed(() => `insights-meals-${props.kind}`);
</script>

<template>
  <v-card
    variant="flat"
    border
    :class="$style.card"
    :aria-labelledby="headingId"
    tag="section"
    :data-testid="`insights-meals-${kind}`"
  >
    <div :class="$style.header">
      <v-icon :icon="icon" size="22" :class="$style.icon" aria-hidden="true" />
      <h2 :id="headingId" :class="$style.heading">{{ heading }}</h2>
    </div>
    <p :class="$style.description">{{ description }}</p>

    <p v-if="meals.length === 0" :class="$style.empty" :data-testid="`insights-meals-${kind}-empty`">{{ emptyText }}</p>
    <ol v-else :class="$style.list" :data-testid="`insights-meals-${kind}-list`">
      <li v-for="meal in meals" :key="meal.id" :class="$style.row" :data-testid="`insights-meals-${kind}-row`">
        <div :class="$style.body">
          <NuxtLink :to="`/recipes/${meal.id}`" :class="$style.name">{{ meal.name }}</NuxtLink>
          <span :class="$style.meta" :data-testid="`insights-meals-${kind}-meta`">{{ t(`recipes.mealType.${meal.mealType}`) }} · {{ meal.countText }}</span>
        </div>
        <RecipeRatingMenu v-if="isRatable" :recipe-id="meal.id" :recipe-name="meal.name" />
      </li>
    </ol>

    <slot name="footer" />
  </v-card>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.heading {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.description,
.empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 56px;
  padding-block: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: 0;
}

.body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.name {
  color: inherit;
  font-size: 15px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
}

.name:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.meta {
  color: var(--color-muted);
  font-size: 12px;
}
</style>

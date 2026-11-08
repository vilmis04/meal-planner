<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HatedRecipes, MealPlan, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";

const props = defineProps<{
  plan: MealPlan;
  recipes: DeepReadonly<RecipeSummary[]> | null;
  hated: HatedRecipes | null;
  viewerId: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{ pick: [slot: MealPlanSlot] }>();

const { t, locale } = useI18n();

const recipeNames = computed(() => new Map((props.recipes ?? []).map((recipe) => [recipe.id, recipe.name])));
// A recipe deleted from the library empties its slots; one missing here only means the list did not load.
const recipeName = (recipeId: string): string => recipeNames.value.get(recipeId) ?? t("plan.slot.unknownRecipe");
// The same "hate" warning as the picker, as an icon on a filled slot.
const isHated = (recipeId: string | null): boolean => Boolean(recipeId && props.hated?.[recipeId]?.length);

// One card per day with its slots in meal order. Skipped snack slots stay in the plan but are not shown.
const days = computed(() => {
  const mealTypes = getVisibleMealTypes(props.plan.includeSnacks);
  return getPlanDays(props.plan.startDate, props.plan.dayCount).map((date, dayIndex) => ({
    date,
    weekday: formatPlanDay(date, locale.value, { weekday: "long" }),
    day: formatPlanDay(date, locale.value, { day: "numeric", month: "short" }),
    slots: props.plan.slots.filter((slot) => slot.dayIndex === dayIndex && mealTypes.includes(slot.mealType)),
  }));
});
</script>

<template>
  <ol :class="$style.days" data-testid="plan-days">
    <li v-for="day in days" :key="day.date" :class="$style.day" data-testid="plan-day">
      <h2 :class="$style.dayTitle">
        <span>{{ day.weekday }}</span>
        <span :class="$style.date">{{ day.day }}</span>
      </h2>
      <v-card variant="flat" border :class="$style.card">
        <ul :class="$style.slots">
          <li v-for="slot in day.slots" :key="slot.id" data-testid="plan-slot">
            <button
              type="button"
              :class="$style.slot"
              :disabled="disabled"
              :aria-label="
                t('plan.slot.open', {
                  meal: t(`recipes.mealType.${slot.mealType}`),
                  day: day.weekday,
                  recipe: slot.recipeId ? recipeName(slot.recipeId) : t('plan.detail.emptySlot'),
                })
              "
              data-testid="plan-slot-button"
              @click="emit('pick', slot)"
            >
              <span :class="$style.text">
                <span :class="$style.meal">
                  {{ t(`recipes.mealType.${slot.mealType}`) }}
                  <template v-if="slot.mealType === 'snack' && !plan.snacksOnList">
                    · {{ t("plan.detail.notOnList") }}
                  </template>
                </span>
                <span v-if="slot.recipeId" :class="$style.recipe" data-testid="plan-slot-recipe">
                  {{ recipeName(slot.recipeId) }}
                </span>
                <span v-else :class="$style.empty">{{ t("plan.detail.emptySlot") }}</span>
              </span>
              <v-icon
                v-if="isHated(slot.recipeId)"
                icon="mdi-alert-outline"
                color="error"
                size="20"
                :aria-label="t('plan.slot.hate.icon')"
                role="img"
                data-testid="plan-slot-hate"
              />
              <v-icon :icon="slot.recipeId ? 'mdi-pencil-outline' : 'mdi-plus'" size="20" :class="$style.action" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </v-card>
    </li>
  </ol>
</template>

<style module>
.days {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.day {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dayTitle {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  text-transform: capitalize;
}

.date {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-muted);
}

.card {
  border-radius: var(--radius-lg);
}

.slots {
  margin: 0;
  padding: 0;
  list-style: none;
}

.slots > li + li {
  border-top: 1px solid var(--color-border);
}

.slot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.slot:hover,
.slot:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.slot:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.slot:disabled {
  cursor: default;
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.recipe {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.action {
  flex: 0 0 auto;
  color: var(--color-muted);
}

/* The first and last rows follow the card's rounded corners when hovered. */
.slots > li:first-child .slot {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.slots > li:last-child .slot {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.meal {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
}

.empty {
  font-size: 15px;
  font-style: italic;
  color: var(--color-muted);
}

/* With room, the week reads left to right like a calendar. */
@media (min-width: 960px) {
  .days {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}
</style>

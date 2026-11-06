<script setup lang="ts">
import type { MealPlan } from "~/types/mealPlan.types";

const props = defineProps<{ plan: MealPlan }>();

const { t, locale } = useI18n();

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
          <li v-for="slot in day.slots" :key="slot.id" :class="$style.slot" data-testid="plan-slot">
            <span :class="$style.meal">
              {{ t(`recipes.mealType.${slot.mealType}`) }}
              <template v-if="slot.mealType === 'snack' && !plan.snacksOnList">
                · {{ t("plan.detail.notOnList") }}
              </template>
            </span>
            <span :class="$style.empty">{{ t("plan.detail.emptySlot") }}</span>
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

.slot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
}

.slot + .slot {
  border-top: 1px solid var(--color-border);
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

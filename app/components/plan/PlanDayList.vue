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

const emit = defineEmits<{ pick: [slot: MealPlanSlot]; toggleLock: [slot: MealPlanSlot] }>();

const { t, locale } = useI18n();

const recipeNames = computed(() => new Map((props.recipes ?? []).map((recipe) => [recipe.id, recipe.name])));
const planDays = computed(() => getPlanDays(props.plan.startDate, props.plan.dayCount));
// Slot id → its place in a batch, for "Day 1 of 2 · covers Wed" (E4).
const batchDays = computed(() => getBatchDays(props.plan.slots, props.recipes ?? []));
const shortWeekday = (dayIndex: number): string => {
  const date = planDays.value[dayIndex];
  return date ? formatShortWeekday(date, locale.value) : "";
};
const batchLine = (slotId: string): string | null => {
  const batchDay = batchDays.value.get(slotId);
  if (!batchDay) {
    return null;
  }
  const position = t("plan.batch.position", { day: batchDay.dayNumber, count: batchDay.dayCount });
  const detail =
    batchDay.dayNumber === 1
      ? t("plan.batch.covers", { day: shortWeekday(batchDay.lastDayIndex) })
      : t("plan.batch.cooked", { day: shortWeekday(batchDay.firstDayIndex) });
  return `${position} · ${detail}`;
};
// A recipe deleted from the library empties its slots; one missing here only means the list did not load.
const recipeName = (recipeId: string): string => recipeNames.value.get(recipeId) ?? t("plan.slot.unknownRecipe");
// The same "hate" warning as the picker, as an icon on a filled slot.
const isHated = (recipeId: string | null): boolean => Boolean(recipeId && props.hated?.[recipeId]?.length);

// The button's name says everything the row shows: what it holds, its batch and the generator's note.
const slotLabel = (slot: MealPlanSlot, weekday: string): string => {
  const open = t("plan.slot.open", {
    meal: t(`recipes.mealType.${slot.mealType}`),
    day: weekday,
    recipe: slot.recipeId ? recipeName(slot.recipeId) : t("plan.detail.emptySlot"),
  });
  const note = slot.fillNote ? t(`plan.fillNote.${slot.fillNote}`) : null;
  const lock = slot.isLocked ? t("plan.lock.locked") : null;
  return [open, batchLine(slot.id), note, lock].filter((part) => part !== null).join(". ");
};

// "Lock lunch on Monday" / "Unlock lunch on Monday" (E5). A batch locks with its other days.
const lockLabel = (slot: MealPlanSlot, weekday: string): string =>
  t(slot.isLocked ? "plan.lock.unlock" : "plan.lock.lock", { meal: t(`recipes.mealType.${slot.mealType}`), day: weekday });

// One card per day with its slots in meal order. Skipped snack slots stay in the plan but are not shown.
const days = computed(() => {
  const mealTypes = getVisibleMealTypes(props.plan.includeSnacks);
  return planDays.value.map((date, dayIndex) => ({
    date,
    isWorkday: props.plan.workdays.includes(getIsoWeekday(date)),
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
        <span v-if="day.isWorkday" :class="$style.workday" data-testid="plan-day-workday">{{ t("plan.detail.workday") }}</span>
      </h2>
      <v-card variant="flat" border :class="$style.card">
        <ul :class="$style.slots">
          <li v-for="slot in day.slots" :key="slot.id" :class="$style.row" data-testid="plan-slot">
            <button
              type="button"
              :class="$style.slot"
              :disabled="disabled"
              :aria-label="slotLabel(slot, day.weekday)"
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
                <span v-if="batchLine(slot.id)" :class="$style.batch" data-testid="plan-slot-batch">
                  <v-icon icon="mdi-link-variant" size="14" aria-hidden="true" />
                  {{ batchLine(slot.id) }}
                </span>
                <span v-if="slot.fillNote" :class="$style.note" data-testid="plan-slot-note">
                  <v-icon icon="mdi-information-outline" size="14" aria-hidden="true" />
                  {{ t(`plan.fillNote.${slot.fillNote}`) }}
                </span>
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
              <v-icon v-if="!slot.recipeId" icon="mdi-plus" size="20" :class="$style.action" aria-hidden="true" />
            </button>
            <!-- Beside the slot's button, not in it: a button cannot hold another. -->
            <v-btn
              v-if="slot.recipeId"
              :icon="slot.isLocked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
              variant="text"
              :color="slot.isLocked ? 'primary' : undefined"
              :class="$style.lock"
              :disabled="disabled"
              :aria-label="lockLabel(slot, day.weekday)"
              :aria-pressed="slot.isLocked"
              data-testid="plan-slot-lock"
              @click="emit('toggleLock', slot)"
            />
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

.workday {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.row {
  display: flex;
  align-items: center;
}

.lock {
  flex: 0 0 auto;
  margin-right: var(--space-1);
  color: var(--color-muted);
}

.slot {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
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

/* The first and last rows follow the card's rounded corners when hovered; a lock button takes the right ones. */
.slots > li:first-child .slot {
  border-top-left-radius: var(--radius-lg);
}

.slots > li:first-child .slot:last-child {
  border-top-right-radius: var(--radius-lg);
}

.slots > li:last-child .slot {
  border-bottom-left-radius: var(--radius-lg);
}

.slots > li:last-child .slot:last-child {
  border-bottom-right-radius: var(--radius-lg);
}

.batch,
.note {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
}

.batch {
  color: var(--color-primary);
}

.note {
  color: var(--color-warning);
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

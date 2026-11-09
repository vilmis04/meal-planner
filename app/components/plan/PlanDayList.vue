<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { MealNutrition, PlanNutrition } from "#shared/utils/nutrition.types";
import type { HatedRecipes, MealPlan, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";

const props = defineProps<{
  plan: MealPlan;
  recipes: DeepReadonly<RecipeSummary[]> | null;
  hated: HatedRecipes | null;
  disabled?: boolean;
  // A past plan (E6): its slots are shown, not chosen or locked.
  isReadOnly?: boolean;
  // Calories and macros, once the user asks for them (F1); null keeps them hidden.
  nutrition?: PlanNutrition | null;
}>();

const emit = defineEmits<{
  pick: [slot: MealPlanSlot];
  toggleLock: [slot: MealPlanSlot];
}>();

const { t } = useI18n();
const { days, getBatchLine, getBatchTone, getRecipeName, isHated, getSlotLabel, getLockLabel } = usePlanWeek(
  () => props.plan,
  () => props.recipes,
  () => props.hated,
);

const { formatNumber, formatMacroLine, formatMealLine, formatNutritionLabel } = useNutritionFormat();

// Each day with its total and each slot with its meal's values; both null while nutrition is hidden.
const nutritionDays = computed(() =>
  days.value.map((day) => ({
    day,
    dayNutrition: props.nutrition?.days[day.dayIndex] ?? null,
    slots: day.slots.map((slot) => ({ slot, meal: props.nutrition?.meals.get(slot.id) ?? null })),
  })),
);

const style = useCssModule();
const getToneClass = (slotId: string): string | null => {
  const tone = getBatchTone(slotId);
  return tone ? (style[tone] ?? null) : null;
};

// A past plan's slot is plain text; any other slot is a button that opens the picker.
// With nutrition shown, the button's name also says the meal's values.
const getLabel = (slot: MealPlanSlot, weekday: string, meal: MealNutrition | null): string => {
  const label = getSlotLabel(slot, weekday);
  return meal ? `${label}. ${formatNutritionLabel(meal.nutrition)}` : label;
};

const getSlotAttributes = (slot: MealPlanSlot, weekday: string, meal: MealNutrition | null) =>
  props.isReadOnly
    ? { "data-testid": "plan-slot-view" }
    : {
        type: "button",
        disabled: props.disabled,
        "aria-label": getLabel(slot, weekday, meal),
        "data-testid": "plan-slot-button",
        onClick: () => emit("pick", slot),
      };
</script>

<template>
  <div :class="$style.list">
    <PlanWeekStrip :days="days" />
    <ol :class="$style.days" data-testid="plan-days">
      <li v-for="{ day, dayNutrition, slots } in nutritionDays" :id="`plan-day-${day.date}`" :key="day.date" :class="$style.day" data-testid="plan-day">
        <h2 :class="$style.dayTitle">
          <span>{{ day.weekday }}</span>
          <span :class="$style.date">{{ day.day }}</span>
          <span v-if="day.isToday" :class="$style.today" data-testid="plan-day-today">{{
            t("plan.detail.today")
          }}</span>
          <!-- "Cook tonight" says more than "Workday" on a workday a batch is cooked, as in the design. -->
          <span v-if="day.isCookingDay" :class="$style.cook" data-testid="plan-day-cook">
            <v-icon icon="mdi-pot-steam-outline" size="14" aria-hidden="true" />
            {{ t("plan.detail.cookTonight") }}
          </span>
          <span v-else-if="day.isWorkday" :class="$style.workday" data-testid="plan-day-workday">
            {{ t("plan.detail.workday") }}
          </span>
        </h2>
        <v-card variant="flat" border :class="$style.card">
          <ul :class="$style.slots">
            <li
              v-for="{ slot, meal } in slots"
              :key="slot.id"
              :class="[$style.row, getToneClass(slot.id)]"
              data-testid="plan-slot"
            >
              <component
                :is="isReadOnly ? 'div' : 'button'"
                :class="[$style.slot, { [$style.interactive]: !isReadOnly }]"
                v-bind="getSlotAttributes(slot, day.weekday, meal)"
              >
                <span :class="$style.text">
                  <span :class="$style.meal">
                    {{ t(`recipes.mealType.${slot.mealType}`) }}
                    <template v-if="slot.mealType === 'snack' && !plan.snacksOnList">
                      · {{ t("plan.detail.notOnList") }}
                    </template>
                    <template v-if="meal?.source === 'swap'"> · {{ t("nutrition.withSwap") }}</template>
                  </span>
                  <span v-if="slot.recipeId" :class="$style.recipe" data-testid="plan-slot-recipe">
                    {{ getRecipeName(slot.recipeId) }}
                  </span>
                  <span v-else :class="$style.empty">{{ t("plan.detail.emptySlot") }}</span>
                  <span v-if="getBatchLine(slot.id)" :class="$style.batch" data-testid="plan-slot-batch">
                    <v-icon icon="mdi-link-variant" size="14" aria-hidden="true" />
                    {{ getBatchLine(slot.id) }}
                  </span>
                  <span v-if="slot.fillNote" :class="$style.note" data-testid="plan-slot-note">
                    <v-icon icon="mdi-information-outline" size="14" aria-hidden="true" />
                    {{ t(`plan.fillNote.${slot.fillNote}`) }}
                  </span>
                  <span v-if="meal" :class="$style.macros" data-testid="plan-slot-macros">
                    {{ formatMealLine(meal) }}
                  </span>
                </span>
                <span v-if="meal" :class="$style.kcal" data-testid="plan-slot-kcal">
                  {{ formatNumber(meal.nutrition.caloriesKcal) }}
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
                <v-icon
                  v-if="!slot.recipeId && !isReadOnly"
                  icon="mdi-plus"
                  size="20"
                  :class="$style.action"
                  aria-hidden="true"
                />
              </component>
              <!-- Beside the slot's button, not in it: a button cannot hold another. -->
              <v-btn
                v-if="slot.recipeId && !isReadOnly"
                :icon="slot.isLocked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
                variant="text"
                :color="slot.isLocked ? 'primary' : undefined"
                :class="$style.lock"
                :disabled="disabled"
                :aria-label="getLockLabel(slot, day.weekday)"
                :aria-pressed="slot.isLocked"
                data-testid="plan-slot-lock"
                @click="emit('toggleLock', slot)"
              />
            </li>
          </ul>
          <div v-if="dayNutrition" :class="$style.total" data-testid="plan-day-total">
            <span :class="$style.text">
              <span :class="$style.totalTitle">{{ t("nutrition.plan.dayTotal") }}</span>
              <span v-if="dayNutrition.total" :class="$style.macros">{{ formatMacroLine(dayNutrition.total) }}</span>
              <span v-if="dayNutrition.excludedMealCount > 0" :class="$style.excluded">
                {{ t("nutrition.plan.dayExcluded", dayNutrition.excludedMealCount) }}
              </span>
            </span>
            <span :class="$style.kcal" data-testid="plan-day-total-kcal">
              {{ formatNumber(dayNutrition.total?.caloriesKcal ?? null) }}
              <span :class="$style.unit">{{ t("nutrition.kcal") }}</span>
            </span>
          </div>
        </v-card>
      </li>
    </ol>
  </div>
</template>

<style module>
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

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
  /* Room above a day the week strip scrolls to. */
  scroll-margin-top: var(--space-4);
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

.today {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.cook {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-secondary);
  text-transform: none;
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

/* The days of a batch carry its tint on the left edge, the same as in the week grid, so they read as one. */
.primary,
.secondary {
  box-shadow: inset 4px 0 0 var(--batch-color);
}

.primary {
  --batch-color: var(--color-primary);
}

.secondary {
  --batch-color: var(--color-secondary);
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
}

.interactive {
  cursor: pointer;
}

.interactive:hover,
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
  color: var(--batch-color, var(--color-primary));
}

.note {
  color: var(--color-warning);
}

.meal {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
}

.macros,
.excluded {
  font-size: 12px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.excluded {
  color: var(--color-warning);
}

.kcal {
  flex: 0 0 auto;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted);
}

.total {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--color-border);
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-bottom-left-radius: var(--radius-lg);
  border-bottom-right-radius: var(--radius-lg);
}

.totalTitle {
  font-size: 13px;
  font-weight: 700;
}

.empty {
  font-size: 15px;
  font-style: italic;
  color: var(--color-muted);
}
</style>

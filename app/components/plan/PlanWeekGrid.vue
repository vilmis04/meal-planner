<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HatedRecipes, MealPlan, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";
import type { PlanWeekCell } from "~/types/planWeek.types";

// The week as a grid from 960px (E6): days across, meals down, as in the desktop design. The days of a batch are
// drawn as one joined block in its tint. Plans longer than a week wrap into one grid per week.
const props = defineProps<{
  plan: MealPlan;
  recipes: DeepReadonly<RecipeSummary[]> | null;
  hated: HatedRecipes | null;
  disabled?: boolean;
  // A past plan: its slots are shown, not chosen or locked.
  isReadOnly?: boolean;
}>();

const emit = defineEmits<{
  pick: [slot: MealPlanSlot];
  toggleLock: [slot: MealPlanSlot];
}>();

const { t } = useI18n();
const { days, getBatchLine, getBatchTone, getBatchJoins, getRecipeName, isHated, getSlotLabel, getLockLabel } =
  usePlanWeek(
    () => props.plan,
    () => props.recipes,
    () => props.hated,
  );

const DAYS_PER_ROW = 7;

const columnCount = computed(() => Math.min(DAYS_PER_ROW, days.value.length));

// Weeks of up to seven days, each with a row per meal the plan shows. A batch that runs over the end of a row is
// not joined across it: each part says which day it belongs to.
const weeks = computed(() => {
  const mealTypes = getVisibleMealTypes(props.plan.includeSnacks);
  return Array.from({ length: Math.ceil(days.value.length / DAYS_PER_ROW) }, (_, weekIndex) => {
    const weekDays = days.value.slice(weekIndex * DAYS_PER_ROW, (weekIndex + 1) * DAYS_PER_ROW);
    return {
      days: weekDays,
      rows: mealTypes.map((mealType) => ({
        mealType,
        cells: weekDays.map((day, column): PlanWeekCell => {
          const slot = day.slots.find((candidate) => candidate.mealType === mealType) ?? null;
          const joins = slot ? getBatchJoins(slot.id) : { hasPrevious: false, hasNext: false };
          return {
            day,
            slot,
            tone: slot ? getBatchTone(slot.id) : null,
            isJoinedToPrevious: joins.hasPrevious && column > 0,
            isJoinedToNext: joins.hasNext && column < weekDays.length - 1,
          };
        }),
      })),
    };
  });
});

// A past plan's slot is plain text; any other slot is a button that opens the picker.
const getSlotAttributes = (slot: MealPlanSlot, weekday: string) =>
  props.isReadOnly
    ? { "data-testid": "plan-cell-view" }
    : {
        type: "button",
        disabled: props.disabled,
        "aria-label": getSlotLabel(slot, weekday),
        "data-testid": "plan-cell-button",
        onClick: () => emit("pick", slot),
      };
</script>

<template>
  <div :class="$style.weeks" data-testid="plan-week-grid">
    <div
      v-for="week in weeks"
      :key="week.days[0]?.date"
      role="table"
      :aria-label="t('plan.detail.weekGrid')"
      :class="$style.grid"
      :style="{ '--column-count': columnCount }"
    >
      <div role="row" :class="$style.row">
        <span role="columnheader" :class="$style.corner" />
        <div
          v-for="day in week.days"
          :key="day.date"
          role="columnheader"
          :class="[$style.dayHeader, { [$style.today]: day.isToday }]"
          :aria-current="day.isToday ? 'date' : undefined"
          data-testid="plan-grid-day"
        >
          <span :class="$style.weekday">{{ day.shortWeekday }}</span>
          <span :class="$style.dayOfMonth">
            {{ day.dayOfMonth }}
            <v-icon
              v-if="day.isCookingDay"
              icon="mdi-pot-steam-outline"
              size="16"
              role="img"
              :aria-label="t('plan.detail.cookTonight')"
              :title="t('plan.detail.cookTonight')"
              :class="$style.cookIcon"
              data-testid="plan-grid-cook"
            />
          </span>
        </div>
      </div>

      <div v-for="row in week.rows" :key="row.mealType" role="row" :class="$style.row">
        <div role="rowheader" :class="$style.mealHeader">
          <span :class="$style.mealName">{{ t(`recipes.mealType.${row.mealType}`) }}</span>
        </div>
        <div v-for="cell in row.cells" :key="cell.day.date" role="cell" :class="$style.cellWrapper">
          <div
            v-if="cell.slot"
            :class="[
              $style.cell,
              cell.tone && $style[cell.tone],
              {
                [$style.joinedToPrevious]: cell.isJoinedToPrevious,
                [$style.joinedToNext]: cell.isJoinedToNext,
              },
            ]"
            data-testid="plan-cell"
          >
            <component
              :is="isReadOnly ? 'div' : 'button'"
              :class="[$style.cellBody, { [$style.interactive]: !isReadOnly }]"
              v-bind="getSlotAttributes(cell.slot, cell.day.weekday)"
            >
              <span v-if="cell.slot.recipeId" :class="$style.recipe" data-testid="plan-cell-recipe">
                {{ getRecipeName(cell.slot.recipeId) }}
              </span>
              <span v-else :class="$style.empty">{{ t("plan.detail.emptySlot") }}</span>
              <span v-if="cell.tone" :class="$style.batch" data-testid="plan-cell-batch">
                {{ getBatchLine(cell.slot.id, { isShort: true }) }}
              </span>
              <span v-if="cell.slot.mealType === 'snack' && !plan.snacksOnList" :class="$style.hint">
                {{ t("plan.detail.notOnListShort") }}
              </span>
              <span v-if="cell.slot.fillNote" :class="$style.note" data-testid="plan-cell-note">
                <v-icon icon="mdi-information-outline" size="12" aria-hidden="true" />
                {{ t(`plan.fillNote.${cell.slot.fillNote}`) }}
              </span>
              <span v-if="isHated(cell.slot.recipeId) || (!cell.slot.recipeId && !isReadOnly)" :class="$style.icons">
                <v-icon
                  v-if="isHated(cell.slot.recipeId)"
                  icon="mdi-alert-outline"
                  color="error"
                  size="16"
                  :aria-label="t('plan.slot.hate.icon')"
                  role="img"
                  data-testid="plan-cell-hate"
                />
                <v-icon v-if="!cell.slot.recipeId && !isReadOnly" icon="mdi-plus" size="16" aria-hidden="true" />
              </span>
            </component>
            <!-- Beside the slot's button, not in it: a button cannot hold another. -->
            <v-btn
              v-if="cell.slot.recipeId && !isReadOnly"
              :icon="cell.slot.isLocked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
              variant="text"
              size="36"
              :color="cell.slot.isLocked ? 'primary' : undefined"
              :class="$style.lock"
              :disabled="disabled"
              :aria-label="getLockLabel(cell.slot, cell.day.weekday)"
              :aria-pressed="cell.slot.isLocked"
              data-testid="plan-cell-lock"
              @click="emit('toggleLock', cell.slot)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style module>
.weeks {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.grid {
  --cell-gap: 6px;

  display: grid;
  grid-template-columns: 24px repeat(var(--column-count), minmax(0, 1fr));
  gap: var(--cell-gap);
}

/* The rows only group cells for screen readers; the grid lays the cells out. */
.row {
  display: contents;
}

.dayHeader {
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-2) var(--space-1);
  border-radius: var(--radius-md);
  line-height: 1.2;
}

.today {
  background: rgba(var(--v-theme-primary), 0.14);
  color: var(--color-primary);
}

.weekday {
  font-size: 12px;
  color: var(--color-muted);
  text-transform: capitalize;
}

.today .weekday {
  color: inherit;
}

.dayOfMonth {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 700;
}

.cookIcon {
  color: var(--color-secondary);
}

.mealHeader {
  display: flex;
  align-items: center;
  justify-content: center;
}

.mealName {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
  white-space: nowrap;
}

.cellWrapper {
  display: flex;
  min-width: 0;
}

.cell {
  --batch-color: var(--color-on-surface);

  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 96px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.primary,
.secondary {
  border-color: rgba(var(--batch-rgb), 0.35);
  background: rgba(var(--batch-rgb), 0.1);
}

.primary {
  --batch-rgb: var(--v-theme-primary);
  --batch-color: var(--color-primary);
}

.secondary {
  --batch-rgb: var(--v-theme-secondary);
  --batch-color: var(--color-secondary);
}

/* The days of a batch touch: the gap between them is covered and the corners between them are square. */
.joinedToNext {
  margin-right: calc(-1 * var(--cell-gap));
  border-right-style: dashed;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.joinedToPrevious {
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.cellBody {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: var(--space-2);
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.interactive {
  cursor: pointer;
}

.interactive:hover,
.interactive:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.interactive:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.interactive:disabled {
  cursor: default;
}

.recipe {
  display: -webkit-box;
  overflow: hidden;
  /* Clear of the lock button in the corner. */
  padding-right: 28px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.primary .recipe,
.secondary .recipe {
  color: var(--batch-color);
}

.empty {
  font-size: 13px;
  font-style: italic;
  color: var(--color-muted);
}

.batch,
.hint,
.note {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}

.batch {
  color: var(--batch-color);
}

.hint {
  color: var(--color-muted);
}

.note {
  align-items: flex-start;
  color: var(--color-warning);
}

.icons {
  display: flex;
  gap: 4px;
  margin-top: auto;
  color: var(--color-muted);
}

.lock {
  position: absolute;
  top: 0;
  right: 0;
  color: var(--color-muted);
}
</style>

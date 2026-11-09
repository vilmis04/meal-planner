<script setup lang="ts">
import type { PlanNutrition } from "#shared/utils/nutrition.types";

// The revealed nutrition view's head (F1, "Nutrition" in the designs): whose view it is, the plan's daily average
// with its macro bar, and the notes about portions, swaps and meals left out of the totals.
const props = defineProps<{
  // Null while the macros load, or when they could not be loaded.
  nutrition: PlanNutrition | null;
  // The plan's participants, for "Showing for"; one name is shown without a menu.
  participants: { userId: string; displayName: string }[];
  isLoadFailed: boolean;
  isSwapLoadFailed: boolean;
}>();

const participantId = defineModel<string | null>("participantId", { required: true });

const { t } = useI18n();
const { setNutritionShown } = useNutritionVisibility();
const { show } = useAppSnackbar();
const { formatNumber, formatGrams } = useNutritionFormat();

const average = computed(() => props.nutrition?.dailyAverage ?? null);
const shares = computed(() => (average.value ? getMacroEnergyShares(average.value) : null));
const macros = computed(() => {
  const current = average.value;
  if (!current || !shares.value) {
    return [];
  }
  return [
    { key: "carbohydrates", grams: current.carbohydrates, share: shares.value.carbohydrates },
    { key: "protein", grams: current.protein, share: shares.value.protein },
    { key: "fat", grams: current.fat, share: shares.value.fat },
  ] as const;
});
const participantName = computed(
  () => props.participants.find((participant) => participant.userId === participantId.value)?.displayName ?? null,
);

async function hide() {
  if (!(await setNutritionShown(false))) {
    show("nutrition.saveFailed", "error");
  }
}
</script>

<template>
  <section :class="$style.summary" :aria-label="t('nutrition.plan.dailyAverage')" data-testid="plan-nutrition">
    <div :class="$style.viewer">
      <template v-if="participants.length > 1">
        <label for="plan-nutrition-participant" :class="$style.muted">{{ t("nutrition.plan.showingFor") }}</label>
        <v-select
          id="plan-nutrition-participant"
          v-model="participantId"
          :items="participants"
          item-title="displayName"
          item-value="userId"
          variant="outlined"
          density="compact"
          hide-details
          rounded="pill"
          :class="$style.participant"
          data-testid="plan-nutrition-participant"
        />
      </template>
      <span v-else-if="participantName" :class="$style.muted">
        {{ t("nutrition.plan.showingFor") }} <strong :class="$style.name">{{ participantName }}</strong>
      </span>
      <v-btn variant="text" color="primary" :class="$style.hide" data-testid="plan-nutrition-hide" @click="hide">
        {{ t("nutrition.hideShort") }}
      </v-btn>
    </div>

    <v-alert v-if="isLoadFailed" type="error" variant="tonal" density="compact" data-testid="plan-nutrition-failed">
      {{ t("nutrition.loadFailed") }}
    </v-alert>
    <v-card v-else-if="nutrition" variant="flat" border :class="$style.card">
      <div :class="$style.cardHead">
        <span :class="$style.cardTitle">{{ t("nutrition.plan.dailyAverage") }}</span>
        <span v-if="average" :class="$style.muted" data-testid="plan-nutrition-days">
          {{ t("nutrition.plan.averageOver", nutrition.averagedDayCount) }}
        </span>
      </div>
      <template v-if="average">
        <p :class="$style.kcal">
          <span :class="$style.kcalValue" data-testid="plan-nutrition-average">{{ formatNumber(average.caloriesKcal) }}</span>
          <span :class="$style.muted">{{ t("nutrition.kcal") }}</span>
        </p>
        <div :class="$style.bar" aria-hidden="true">
          <span
            v-for="macro in macros"
            :key="macro.key"
            :class="[$style.segment, $style[macro.key]]"
            :style="{ flexGrow: macro.share }"
          />
        </div>
        <ul :class="$style.legend">
          <li v-for="macro in macros" :key="macro.key" :class="$style.legendItem">
            <span :class="[$style.swatch, $style[macro.key]]" aria-hidden="true" />
            {{ t(`nutrition.${macro.key}`) }}
            <strong>{{ formatGrams(macro.grams) }}</strong>
          </li>
        </ul>
      </template>
      <p v-else :class="$style.muted" data-testid="plan-nutrition-empty">{{ t("nutrition.plan.noAverage") }}</p>
    </v-card>
    <v-progress-linear v-else indeterminate rounded color="primary" data-testid="plan-nutrition-loading" />

    <p v-if="nutrition && nutrition.excludedMealCount > 0" :class="$style.note" data-testid="plan-nutrition-excluded">
      <v-icon icon="mdi-alert-circle-outline" size="16" aria-hidden="true" />
      <span>{{ t("nutrition.plan.excluded", nutrition.excludedMealCount) }}</span>
    </p>
    <p v-if="isSwapLoadFailed" :class="$style.note" data-testid="plan-nutrition-swaps-failed">
      <v-icon icon="mdi-alert-circle-outline" size="16" aria-hidden="true" />
      <span>{{ t("nutrition.plan.swapsFailed") }}</span>
    </p>
    <p :class="[$style.note, $style.muted]">
      <v-icon icon="mdi-information-outline" size="16" aria-hidden="true" />
      <span>{{ t("nutrition.perPortion") }}</span>
    </p>
  </section>
</template>

<style module>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.viewer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
}

.participant {
  flex: 0 1 220px;
  min-width: 0;
}

.name {
  color: var(--color-on-background);
}

.hide {
  min-height: 44px;
  margin-left: auto;
  text-transform: none;
}

.muted {
  font-size: 13px;
  color: var(--color-muted);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.cardHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.cardTitle {
  font-size: 15px;
  font-weight: 700;
}

.kcal {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}

.kcalValue {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.bar {
  display: flex;
  gap: 2px;
  height: 10px;
  overflow: hidden;
  border-radius: 5px;
}

.segment {
  flex-basis: 0;
}

.carbohydrates {
  background: var(--color-primary);
}

.protein {
  background: var(--color-secondary);
}

.fat {
  background: var(--color-muted);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin: 0;
  padding: 0;
  font-size: 13px;
  list-style: none;
}

.legendItem {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  padding: 0 var(--space-1);
  font-size: 12px;
  line-height: 1.45;
}

.note:not(.muted) {
  color: var(--color-warning);
}

/* Beside the week grid from 960px there is room for the average in one line with its macros. */
@media (min-width: 960px) {
  .card {
    display: grid;
    grid-template-columns: auto auto minmax(160px, 1fr) auto;
    align-items: center;
    column-gap: var(--space-4);
  }

  .cardHead {
    flex-direction: column;
    gap: 2px;
  }
}
</style>

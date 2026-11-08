<script setup lang="ts">
import type { PlanTimeline } from "#shared/utils/mealPlan";
import type { MealPlanSummary } from "~/types/mealPlan.types";

// One plan in the plan list (E6): its dates, whose it is and how long it runs; a current plan says which day it is.
const props = defineProps<{ plan: MealPlanSummary; timeline: PlanTimeline; today: string }>();

const { t, locale } = useI18n();

const hint = computed(() => {
  const parts = [t(`plan.kind.${props.plan.kind}`), t("plan.dayCount", props.plan.dayCount)];
  if (props.timeline === "current") {
    parts.push(
      t("plan.list.progress", { day: getDaysBetween(props.plan.startDate, props.today) + 1, count: props.plan.dayCount }),
    );
  }
  return parts.join(" · ");
});
</script>

<template>
  <v-card
    :to="`/plans/${plan.id}`"
    variant="flat"
    border
    :class="$style.card"
    data-testid="plans-item"
  >
    <v-avatar :color="timeline === 'past' ? undefined : 'primary'" variant="tonal" rounded="lg">
      <v-icon :icon="plan.kind === 'household' ? 'mdi-home-account' : 'mdi-account'" />
    </v-avatar>
    <div :class="$style.text">
      <span :class="$style.range">{{ formatPlanRange(plan.startDate, plan.endDate, locale) }}</span>
      <span :class="$style.hint">{{ hint }}</span>
    </div>
    <v-icon icon="mdi-chevron-right" />
  </v-card>
</template>

<style module>
.card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 64px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.range {
  font-size: 16px;
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--color-muted);
}
</style>

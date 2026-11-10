<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { PlanScheduleSettings } from "#shared/utils/planSchedule.types";

// "Next: Saturday 25 Oct": when the next plan is made and the days it covers, on the viewer's own date.
const props = defineProps<{ kind: PlanKind; settings: DeepReadonly<PlanScheduleSettings>; today: string }>();

const { t, locale } = useI18n();

const run = computed(() => getScheduleRun(props.settings, props.today));
const runDay = computed(() =>
  formatPlanDay(run.value.runDate, locale.value, { weekday: "long", day: "numeric", month: "short" }),
);
const range = computed(() => formatPlanRange(run.value.startDate, run.value.endDate, locale.value));
</script>

<template>
  <div :class="$style.box" role="status" data-testid="plan-schedule-next">
    <v-icon icon="mdi-calendar-arrow-right" size="22" :class="$style.icon" aria-hidden="true" />
    <p :class="$style.text">
      <strong :class="$style.day" data-testid="plan-schedule-next-day">{{ t("plan.schedule.next", { day: runDay }) }}</strong>
      <span data-testid="plan-schedule-next-range">
        {{
          kind === "household"
            ? t("plan.schedule.nextHousehold", { range })
            : t("plan.schedule.nextIndividual", { range })
        }}
      </span>
    </p>
  </div>
</template>

<style module>
.box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.icon {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.day {
  display: block;
}
</style>

<script setup lang="ts">
const workdays = defineModel<number[]>("workdays", { required: true });
const cooldownDays = defineModel<number>("cooldownDays", { required: true });

const { t, locale } = useI18n();

// Any Monday: the chips only need the weekday names, Monday first.
const REFERENCE_MONDAY = "2024-01-01";

const weekdayChips = computed(() =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    label: formatShortWeekday(addDays(REFERENCE_MONDAY, weekday - 1), locale.value),
    name: formatPlanDay(addDays(REFERENCE_MONDAY, weekday - 1), locale.value, { weekday: "long" }),
  })),
);

// The chip group hands back the ticked days in the order they were tapped.
const selectedWorkdays = computed({
  get: () => workdays.value,
  set: (value: number[]) => {
    workdays.value = normalizeWorkdays(value);
  },
});

const cooldownOptions = computed(() =>
  COOLDOWN_DAYS_OPTIONS.map((days) => ({
    value: days,
    title: days === 0 ? t("plan.generation.cooldownOff") : t("plan.generation.cooldownDays", { count: days }, days),
  })),
);
</script>

<template>
  <section :class="$style.section" aria-labelledby="plan-workdays-label" data-testid="plan-generation-settings">
    <h2 id="plan-workdays-label" :class="$style.label">{{ t("plan.generation.workdays") }}</h2>
    <v-chip-group
      v-model="selectedWorkdays"
      multiple
      column
      selected-class="text-primary"
      :class="$style.chips"
      aria-labelledby="plan-workdays-label"
      data-testid="plan-workdays"
    >
      <v-chip
        v-for="chip in weekdayChips"
        :key="chip.weekday"
        :value="chip.weekday"
        :variant="selectedWorkdays.includes(chip.weekday) ? 'tonal' : 'outlined'"
        :class="$style.chip"
        :aria-label="chip.name"
        :data-testid="`plan-workday-${chip.weekday}`"
      >
        {{ chip.label }}
      </v-chip>
    </v-chip-group>

    <v-select
      v-model="cooldownDays"
      :items="cooldownOptions"
      :label="t('plan.generation.cooldown')"
      :hint="t('plan.generation.cooldownHint')"
      persistent-hint
      variant="outlined"
      prepend-inner-icon="mdi-history"
      data-testid="plan-cooldown"
    />
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.chips :global(.v-slide-group__content) {
  justify-content: space-between;
  gap: var(--space-1);
}

/* Seven 44px circles fit one row on a 360px phone. */
.chip {
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target) !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 999px;
  font-size: 13px;
}
</style>

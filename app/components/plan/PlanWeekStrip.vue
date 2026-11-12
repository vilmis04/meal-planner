<script setup lang="ts">
import type { PlanWeekDay } from "~/types/planWeek.types";

// The plan's days as a row of buttons above the day list on phones (E6), as in the week plan design. A tap
// scrolls to that day; today is highlighted.
defineProps<{ days: readonly PlanWeekDay[] }>();

const { t } = useI18n();

const scrollToDay = (date: string) => {
  document.getElementById(`plan-day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
};
</script>

<template>
  <nav :aria-label="t('plan.detail.weekStrip')" :class="$style.strip" data-testid="plan-week-strip">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      :class="[$style.day, { [$style.today]: day.isToday }]"
      :aria-label="t('plan.detail.goToDay', { day: `${day.weekday} ${day.day}` })"
      :aria-current="day.isToday ? 'date' : undefined"
      data-testid="plan-week-strip-day"
      @click="scrollToDay(day.date)"
    >
      <span :class="$style.weekday">{{ day.shortWeekday }}</span>
      <span :class="$style.dayOfMonth">{{ day.dayOfMonth }}</span>
      <span v-if="day.isCookingDay" :class="$style.cook" aria-hidden="true" />
    </button>
  </nav>
</template>

<style module>
.strip {
  display: flex;
  gap: var(--space-2);
  /* Edge to edge on the phone, so a two-week plan scrolls sideways under the page's padding. */
  margin-inline: calc(-1 * var(--space-3));
  padding: var(--space-1) var(--space-3);
  overflow-x: auto;
  scrollbar-width: none;
}

.day {
  position: relative;
  display: flex;
  flex: 1 0 var(--touch-target);
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 56px;
  padding: var(--space-2) 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.day:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.today {
  border-color: transparent;
  background: var(--color-primary);
  color: rgb(var(--v-theme-on-primary));
}

.weekday {
  font-size: 12px;
}

.dayOfMonth {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
}

/* A dot under a day a batch is cooked on ("Cook tonight" in the day list). */
.cook {
  position: absolute;
  bottom: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-secondary);
}

.today .cook {
  background: currentcolor;
}
</style>

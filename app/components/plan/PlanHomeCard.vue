<script setup lang="ts">
const { t, locale } = useI18n();
const { today, request } = useMealPlanOverview();
const { data: result } = await request;

// The plan running today, else the next one, else the latest past one, with the matching hint.
const featured = computed(() => {
  if (result.value?.status !== "loaded") {
    return null;
  }
  const [firstActive] = result.value.activePlans;
  if (firstActive) {
    const isCurrent = getPlanTimeline(firstActive.startDate, firstActive.endDate, today.value) === "current";
    return { plan: firstActive, hintKey: isCurrent ? "plan.homeCard.currentHint" : "plan.homeCard.upcomingHint" };
  }
  const [latestPast] = result.value.pastPlans;
  return latestPast ? { plan: latestPast, hintKey: "plan.homeCard.openHint" } : null;
});
</script>

<template>
  <v-card v-if="featured" to="/plans" variant="flat" border :class="$style.card" data-testid="home-plans">
    <div :class="$style.row">
      <v-avatar color="primary" variant="tonal" rounded="lg">
        <v-icon icon="mdi-calendar-week" />
      </v-avatar>
      <div :class="$style.text">
        <span :class="$style.title">{{ t("plan.homeCard.openTitle") }}</span>
        <span :class="$style.hint">
          {{ t(featured.hintKey, { range: formatPlanRange(featured.plan.startDate, featured.plan.endDate, locale) }) }}
        </span>
      </div>
      <v-icon icon="mdi-chevron-right" />
    </div>
  </v-card>

  <v-card v-else-if="result?.status === 'loaded'" variant="flat" border :class="$style.card" data-testid="home-plan-week">
    <div :class="$style.row">
      <v-avatar color="primary" variant="tonal" rounded="lg">
        <v-icon icon="mdi-calendar-plus" />
      </v-avatar>
      <div :class="$style.text">
        <span :class="$style.title">{{ t("plan.homeCard.title") }}</span>
        <span :class="$style.hint">{{ t("plan.homeCard.hint") }}</span>
      </div>
    </div>
    <v-btn to="/plans/new" color="primary" size="large" block data-testid="home-plan-new">
      {{ t("plan.homeCard.action") }}
    </v-btn>
  </v-card>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--color-muted);
}
</style>

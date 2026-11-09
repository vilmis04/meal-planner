<script setup lang="ts">
const { t, locale } = useI18n();
const { today, request } = useMealPlanOverview();
const user = useSupabaseUser();
const { data: result } = await request;

// The plan running today, else the next one, else the latest past one, with the matching hint. A plan the viewer
// eats from comes first, so their own plan beats a household plan they left for the week (E7).
const featured = computed(() => {
  if (result.value?.status !== "loaded") {
    return null;
  }
  const active = getFeaturedPlan(result.value.activePlans, user.value?.id ?? null, today.value);
  if (active) {
    const isCurrent = getPlanTimeline(active.startDate, active.endDate, today.value) === "current";
    return { plan: active, hintKey: isCurrent ? "plan.homeCard.currentHint" : "plan.homeCard.upcomingHint" };
  }
  const [latestPast] = result.value.pastPlans;
  return latestPast ? { plan: latestPast, hintKey: "plan.homeCard.openHint" } : null;
});
// "Now: 9 – 15 Nov · Just me": which of the plans side by side it is.
const featuredHint = computed(() => {
  if (!featured.value) {
    return "";
  }
  const { plan, hintKey } = featured.value;
  const range = formatPlanRange(plan.startDate, plan.endDate, locale.value);
  return `${t(hintKey, { range })} · ${t(`plan.kind.${plan.kind}`)}`;
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
        <span :class="$style.hint" data-testid="home-plans-hint">{{ featuredHint }}</span>
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

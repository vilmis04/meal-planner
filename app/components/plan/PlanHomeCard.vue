<script setup lang="ts">
const { t, locale } = useI18n();
const { loadList } = useMealPlans();

const { data: result } = await useAsyncData("plans", loadList);

// The list is newest first, so the first plan is the latest one.
const latest = computed(() => (result.value?.status === "loaded" ? (result.value.plans[0] ?? null) : null));
</script>

<template>
  <v-card v-if="latest" to="/plans" variant="flat" border :class="$style.card" data-testid="home-plans">
    <div :class="$style.row">
      <v-avatar color="primary" variant="tonal" rounded="lg">
        <v-icon icon="mdi-calendar-week" />
      </v-avatar>
      <div :class="$style.text">
        <span :class="$style.title">{{ t("plan.homeCard.openTitle") }}</span>
        <span :class="$style.hint">
          {{ t("plan.homeCard.openHint", { range: formatPlanRange(latest.startDate, latest.endDate, locale) }) }}
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

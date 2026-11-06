<script setup lang="ts">
defineOptions({ name: "PlansPage" });

const { t, locale } = useI18n();
const { loadList } = useMealPlans();

useHead({ title: () => t("plan.pageTitle") });

// A plain list until E6 adds the week view and history.
const { data: result } = await useAsyncData("plans", loadList);
</script>

<template>
  <div :class="$style.page">
    <header :class="$style.header">
      <h1 :class="$style.title">{{ t("plan.title") }}</h1>
      <v-btn to="/plans/new" color="primary" prepend-icon="mdi-plus" :class="$style.new" data-testid="plans-new">
        {{ t("plan.list.new") }}
      </v-btn>
    </header>

    <v-alert v-if="result?.status !== 'loaded'" type="error" variant="tonal" data-testid="plans-load-failed">
      {{ t("plan.errors.listLoadFailed") }}
    </v-alert>
    <p v-else-if="result.plans.length === 0" :class="$style.empty" data-testid="plans-empty">
      {{ t("plan.list.empty") }}
    </p>
    <ul v-else :class="$style.list" :aria-label="t('plan.list.label')" data-testid="plans-list">
      <li v-for="plan in result.plans" :key="plan.id">
        <v-card :to="`/plans/${plan.id}`" variant="flat" border :class="$style.card" data-testid="plans-item">
          <v-avatar color="primary" variant="tonal" rounded="lg">
            <v-icon :icon="plan.kind === 'household' ? 'mdi-home-account' : 'mdi-account'" />
          </v-avatar>
          <div :class="$style.text">
            <span :class="$style.range">{{ formatPlanRange(plan.startDate, plan.endDate, locale) }}</span>
            <span :class="$style.hint">
              {{ t(`plan.kind.${plan.kind}`) }} · {{ t("plan.dayCount", plan.dayCount) }}
            </span>
          </div>
          <v-icon icon="mdi-chevron-right" />
        </v-card>
      </li>
    </ul>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.new {
  text-transform: none;
}

.empty {
  margin: 0;
  color: var(--color-muted);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

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

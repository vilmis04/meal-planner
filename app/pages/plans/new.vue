<script setup lang="ts">
defineOptions({ name: "NewPlanPage" });

const { t } = useI18n();
const { load } = useHousehold();

useHead({ title: () => t("plan.new.pageTitle") });

// The form offers a household plan only to someone who is in a household.
await callOnce("household", load, { mode: "navigation" });
</script>

<template>
  <div :class="$style.page">
    <header :class="$style.header">
      <v-btn icon="mdi-close" variant="text" to="/plans" :aria-label="t('plan.new.close')" data-testid="plan-new-close" />
      <h1 :class="$style.title">{{ t("plan.new.title") }}</h1>
    </header>
    <PlanCreateForm />
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: calc(-1 * var(--space-2));
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
</style>

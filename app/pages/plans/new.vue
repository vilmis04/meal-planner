<script setup lang="ts">
defineOptions({ name: "NewPlanPage" });

const { t } = useI18n();
const route = useRoute();
const { load } = useHousehold();
// "Create my own plan" on a household plan opens this screen with that plan's days filled in (E7).
const prefill = parseNewPlanQuery(route.query);

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
    <PlanCreateForm :prefill="prefill" />
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

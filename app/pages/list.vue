<script setup lang="ts">
defineOptions({ name: "ListPage" });

// The navigation's "List" (G2): the shopping list of the plan the home card features (the one running today, else the
// next one, else the latest; a plan the viewer eats from first). Without any plan it says how to get one.
const { t } = useI18n();
const { today, request } = useMealPlanOverview();
const user = useSupabaseUser();
const { data: result } = await request;

useHead({ title: () => t("shoppingList.pageTitle") });

const featuredPlan = computed(() => {
  if (result.value?.status !== "loaded") {
    return null;
  }
  return getFeaturedPlan(result.value.activePlans, user.value?.id ?? null, today.value) ?? result.value.pastPlans[0] ?? null;
});

if (featuredPlan.value) {
  await navigateTo(`/plans/${featuredPlan.value.id}/list`, { replace: true });
}
</script>

<template>
  <LayoutPage width="medium" is-compact :title="t('shoppingList.title')">
    <v-alert v-if="result?.status === 'failed'" type="error" variant="tonal" data-testid="list-load-failed">
      {{ t("shoppingList.loadFailed") }}
    </v-alert>
    <v-card v-else variant="flat" border :class="$style.card" data-testid="list-no-plan">
      <span :class="$style.cardTitle">{{ t("shoppingList.pick.title") }}</span>
      <span :class="$style.hint">{{ t("shoppingList.pick.hint") }}</span>
      <v-btn to="/plans" color="primary" size="large" :class="$style.action">{{ t("shoppingList.pick.action") }}</v-btn>
    </v-card>
  </LayoutPage>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.cardTitle {
  font-weight: 600;
}

.hint {
  color: var(--color-muted);
}

.action {
  align-self: flex-start;
  text-transform: none;
}
</style>

<script setup lang="ts">
defineOptions({ name: "ShoppingListPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan } = useMealPlans();

const id = String(route.params.id);
// The plan names the page; ShoppingListPanel reads it under the same key, so it is read once.
const { data: planResult } = await useAsyncData(`plan-${id}`, () => loadPlan(id));
const plan = computed(() => (planResult.value?.status === "found" ? planResult.value.plan : null));

const range = computed(() => (plan.value ? formatPlanRange(plan.value.startDate, plan.value.endDate, locale.value) : ""));
useHead({ title: () => (range.value ? `${t("shoppingList.pageTitle")} · ${range.value}` : t("shoppingList.pageTitle")) });
</script>

<template>
  <LayoutPage width="medium" is-compact>
    <LayoutBackButton :to="`/plans/${id}`" :label="t('shoppingList.back')" data-testid="shopping-list-back" />
    <ShoppingListPanel :plan-id="id" />
  </LayoutPage>
</template>

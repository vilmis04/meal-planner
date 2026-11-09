<script setup lang="ts">
defineOptions({ name: "ShoppingListPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan } = useMealPlans();
const { refresh, load } = useShoppingList();
const { household, load: loadHousehold } = useHousehold();
const { profile } = useProfile();

const id = String(route.params.id);

// The list is brought up to date with the plan first (the server rebuilds it only when the plan changed), then read.
// The plan gives the header; the household gives names for "Swap for Monika".
const loadList = async () => {
  const isUpToDate = await refresh(id);
  return { isUpToDate, result: await load(id) };
};
const [{ data: planResult }, { data: listResult, refresh: reloadList, status: listStatus }] = await Promise.all([
  useAsyncData(`plan-${id}`, () => loadPlan(id)),
  useAsyncData(`shopping-list-${id}`, loadList),
  callOnce("household", loadHousehold, { mode: "navigation" }),
]);

const plan = computed(() => (planResult.value?.status === "found" ? planResult.value.plan : null));
const list = computed(() => (listResult.value?.result.status === "found" ? listResult.value.result.list : null));
const view = computed(() => (list.value ? getShoppingListView(list.value.items) : null));
const isRefreshFailed = computed(() => listResult.value?.isUpToDate === false);

const range = computed(() => (plan.value ? formatPlanRange(plan.value.startDate, plan.value.endDate, locale.value) : ""));
useHead({ title: () => (range.value ? `${t("shoppingList.pageTitle")} · ${range.value}` : t("shoppingList.pageTitle")) });

// "20 – 26 Oct · 2 people", as in the shopping list design.
const subtitle = computed(() =>
  plan.value ? `${range.value} · ${t("plan.detail.people", getPlanServings(plan.value.participantIds))}` : "",
);
const hasNoParticipants = computed(() => plan.value !== null && getPlanServings(plan.value.participantIds) === 0);
const areSnacksOff = computed(() => plan.value !== null && plan.value.includeSnacks && !plan.value.snacksOnList);

const participantNames = computed(() => {
  const names = new Map((household.value?.members ?? []).map((member) => [member.userId, member.displayName]));
  if (profile.value) {
    names.set(profile.value.id, profile.value.displayName);
  }
  return names;
});
</script>

<template>
  <div :class="$style.page">
    <v-btn
      :to="`/plans/${id}`"
      exact
      variant="text"
      prepend-icon="mdi-arrow-left"
      :class="$style.back"
      data-testid="shopping-list-back"
    >
      {{ t("shoppingList.back") }}
    </v-btn>

    <template v-if="list && view">
      <header :class="$style.header">
        <span v-if="subtitle" :class="$style.subtitle" data-testid="shopping-list-plan">{{ subtitle }}</span>
        <h1 :class="$style.title">{{ t("shoppingList.title") }}</h1>
        <span :class="$style.count" data-testid="shopping-list-count">{{ t("shoppingList.itemCount", view.itemCount) }}</span>
      </header>

      <v-alert v-if="isRefreshFailed" type="warning" variant="tonal" density="compact" data-testid="shopping-list-stale">
        {{ t("shoppingList.refreshFailed") }}
        <template #append>
          <v-btn variant="text" size="small" :loading="listStatus === 'pending'" @click="reloadList()">
            {{ t("shoppingList.retry") }}
          </v-btn>
        </template>
      </v-alert>
      <v-alert v-if="hasNoParticipants" type="warning" variant="tonal" density="compact" data-testid="shopping-list-no-participants">
        {{ t("shoppingList.noParticipants") }}
      </v-alert>
      <v-alert v-if="list.missingSwapCount > 0" type="info" variant="tonal" density="compact" data-testid="shopping-list-missing-swaps">
        {{ t("shoppingList.missingSwaps") }}
      </v-alert>
      <v-alert v-if="areSnacksOff" type="info" variant="tonal" density="compact" data-testid="shopping-list-snacks-off">
        {{ t("shoppingList.snacksOff") }}
      </v-alert>

      <p v-if="view.itemCount === 0 && !hasNoParticipants" :class="$style.empty" data-testid="shopping-list-empty">
        {{ t("shoppingList.empty") }}
      </p>

      <div :class="$style.groups">
        <!-- G3 makes these collapsible, with counts. -->
        <section
          v-for="group in view.groups"
          :key="group.category"
          :class="$style.group"
          :data-testid="`shopping-group-${group.category}`"
        >
          <h2 :class="$style.groupTitle">{{ t(`shoppingList.category.${group.category}`) }}</h2>
          <ShoppingItemList :items="group.items" :participant-names="participantNames" />
        </section>

        <section v-if="view.extras.length > 0" :class="$style.group" data-testid="shopping-group-extras">
          <h2 :class="$style.groupTitle">{{ t("shoppingList.extras.title") }}</h2>
          <p :class="$style.groupHint">{{ t("shoppingList.extras.hint") }}</p>
          <ShoppingItemList :items="view.extras" :participant-names="participantNames" />
        </section>
      </div>
    </template>
    <v-alert
      v-else-if="listResult?.result.status === 'not-found' || planResult?.status === 'not-found'"
      type="warning"
      variant="tonal"
      data-testid="shopping-list-not-found"
    >
      {{ t("shoppingList.notFound") }}
    </v-alert>
    <v-alert v-else type="error" variant="tonal" data-testid="shopping-list-load-failed">
      {{ t("shoppingList.loadFailed") }}
    </v-alert>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 720px;
}

.back {
  align-self: flex-start;
  min-height: 44px;
  margin-left: calc(-1 * var(--space-2));
}

.header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.count {
  font-size: 14px;
  color: var(--color-muted);
}

.empty {
  margin: 0;
  color: var(--color-muted);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.group {
  display: flex;
  flex-direction: column;
}

.groupTitle {
  margin: 0 0 var(--space-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.groupHint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}
</style>

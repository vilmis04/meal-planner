<script setup lang="ts">
import type { MealPlanSummary } from "~/types/mealPlan.types";

defineOptions({ name: "PlansPage" });

const { t } = useI18n();
const { loadPastPlans } = useMealPlans();
const { show } = useAppSnackbar();
const { today, request } = useMealPlanOverview();
const user = useSupabaseUser();
const viewerId = computed(() => user.value?.id ?? null);

useHead({ title: () => t("plan.pageTitle") });

// Current and upcoming plans, then past ones (E6), on the viewer's own date.
const { data: result } = await request;

const overview = computed(() => (result.value?.status === "loaded" ? result.value : null));
// The plans running today, then those starting later; a section with no plan is left out.
const activeSections = computed(() => {
  const plans = overview.value?.activePlans ?? [];
  const timelines = ["current", "upcoming"] as const;
  return timelines
    .map((timeline) => ({
      timeline,
      plans: plans.filter((plan) => getPlanTimeline(plan.startDate, plan.endDate, today.value) === timeline),
    }))
    .filter((section) => section.plans.length > 0);
});

// Older past plans, a page at a time after the first one the overview brings.
const olderPlans = ref<MealPlanSummary[]>([]);
const hasMoreOlder = ref<boolean | null>(null);
const isLoadingOlder = ref(false);
const pastPlans = computed(() => [...(overview.value?.pastPlans ?? []), ...olderPlans.value]);
const hasMorePast = computed(() => hasMoreOlder.value ?? overview.value?.hasMorePast ?? false);
const hasNoPlans = computed(() => activeSections.value.length === 0 && pastPlans.value.length === 0);

// A new overview (another date) starts the past plans from its own first page.
watch(result, () => {
  olderPlans.value = [];
  hasMoreOlder.value = null;
});

async function showOlderPlans() {
  isLoadingOlder.value = true;
  const page = await loadPastPlans(today.value, pastPlans.value.length);
  isLoadingOlder.value = false;

  if (page.status === "failed") {
    show("plan.errors.olderLoadFailed", "error");
    return;
  }
  // A plan created meanwhile can shift a page by one; it is shown once.
  const shownIds = new Set(pastPlans.value.map((plan) => plan.id));
  olderPlans.value = [...olderPlans.value, ...page.plans.filter((plan) => !shownIds.has(plan.id))];
  hasMoreOlder.value = page.hasMore;
}
</script>

<template>
  <div :class="$style.page">
    <header :class="$style.header">
      <h1 :class="$style.title">{{ t("plan.title") }}</h1>
      <v-btn to="/plans/new" color="primary" prepend-icon="mdi-plus" :class="$style.new" data-testid="plans-new">
        {{ t("plan.list.new") }}
      </v-btn>
    </header>

    <v-alert v-if="!overview" type="error" variant="tonal" data-testid="plans-load-failed">
      {{ t("plan.errors.listLoadFailed") }}
    </v-alert>
    <p v-else-if="hasNoPlans" :class="$style.empty" data-testid="plans-empty">
      {{ t("plan.list.empty") }}
    </p>
    <template v-else>
      <p v-if="activeSections.length === 0" :class="$style.empty" data-testid="plans-none-ahead">
        {{ t("plan.list.noneAhead") }}
      </p>

      <section
        v-for="section in activeSections"
        :key="section.timeline"
        :class="$style.section"
        :aria-labelledby="`plans-${section.timeline}`"
        :data-testid="`plans-${section.timeline}`"
      >
        <h2 :id="`plans-${section.timeline}`" :class="$style.sectionTitle">
          {{ t(`plan.list.sections.${section.timeline}`) }}
        </h2>
        <ul :class="$style.list">
          <li v-for="plan in section.plans" :key="plan.id">
            <PlanListItem :plan="plan" :timeline="section.timeline" :today="today" :viewer-id="viewerId" />
          </li>
        </ul>
      </section>

      <section v-if="pastPlans.length" :class="$style.section" aria-labelledby="plans-past" data-testid="plans-past">
        <h2 id="plans-past" :class="$style.sectionTitle">{{ t("plan.list.sections.past") }}</h2>
        <ul :class="$style.list">
          <li v-for="plan in pastPlans" :key="plan.id">
            <PlanListItem :plan="plan" timeline="past" :today="today" :viewer-id="viewerId" />
          </li>
        </ul>
        <v-btn
          v-if="hasMorePast"
          variant="text"
          color="primary"
          prepend-icon="mdi-history"
          :loading="isLoadingOlder"
          :class="$style.older"
          data-testid="plans-show-older"
          @click="showOlderPlans"
        >
          {{ t("plan.list.showOlder") }}
        </v-btn>
      </section>
    </template>
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

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sectionTitle {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.older {
  align-self: flex-start;
  text-transform: none;
}
</style>

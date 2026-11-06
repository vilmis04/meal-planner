<script setup lang="ts">
import type { SnackSettings } from "~/types/mealPlan.types";

defineOptions({ name: "PlanPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan, updateSnackSettings } = useMealPlans();
const { show } = useAppSnackbar();

const id = String(route.params.id);
const { data: result } = await useAsyncData(`plan-${id}`, () => loadPlan(id));

const plan = computed(() => (result.value?.status === "found" ? result.value.plan : null));
const range = computed(() =>
  plan.value ? formatPlanRange(plan.value.startDate, plan.value.endDate, locale.value) : "",
);

useHead({ title: () => range.value || t("plan.pageTitle") });

const isSaving = ref(false);

// The switch follows the tap at once; if nothing was saved, the previous options come back.
async function saveSnacks(change: Partial<SnackSettings>) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  // useAsyncData data is a shallow ref, so the plan is replaced, not changed in place.
  result.value = { status: "found", plan: { ...current, ...change } };
  isSaving.value = true;
  const isSaved = await updateSnackSettings(current.id, change);
  isSaving.value = false;

  if (!isSaved) {
    result.value = { status: "found", plan: current };
    show("plan.snacks.saveFailed", "error");
  }
}

const includeSnacks = computed({
  get: () => plan.value?.includeSnacks ?? true,
  set: (value: boolean) => saveSnacks({ includeSnacks: value }),
});
const snacksOnList = computed({
  get: () => plan.value?.snacksOnList ?? true,
  set: (value: boolean) => saveSnacks({ snacksOnList: value }),
});
</script>

<template>
  <div :class="$style.page">
    <v-btn to="/plans" exact variant="text" prepend-icon="mdi-arrow-left" :class="$style.back" data-testid="plan-back">
      {{ t("plan.detail.back") }}
    </v-btn>

    <template v-if="plan">
      <header :class="$style.header">
        <span :class="$style.kind" data-testid="plan-kind-label">{{ t(`plan.kind.${plan.kind}`) }}</span>
        <h1 :class="$style.title" data-testid="plan-range">{{ range }}</h1>
      </header>

      <div :class="$style.layout">
        <PlanSnackSettings
          v-model:include-snacks="includeSnacks"
          v-model:snacks-on-list="snacksOnList"
          :disabled="isSaving"
          :class="$style.settings"
        />
        <PlanDayList :plan="plan" :class="$style.days" />
      </div>
    </template>
    <v-alert v-else-if="result?.status === 'not-found'" type="warning" variant="tonal" data-testid="plan-not-found">
      {{ t("plan.errors.notFound") }}
    </v-alert>
    <v-alert v-else type="error" variant="tonal" data-testid="plan-load-failed">
      {{ t("plan.errors.loadFailed") }}
    </v-alert>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

.kind {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 960px is --breakpoint-md: the options sit beside the week instead of above it. */
@media (min-width: 960px) {
  .layout {
    flex-direction: row-reverse;
    align-items: flex-start;
  }

  .settings {
    flex: 0 0 320px;
  }

  .days {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>

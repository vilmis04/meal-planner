<script setup lang="ts">
import type { SnackSettings } from "~/types/mealPlan.types";

defineOptions({ name: "PlanPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan, updateSnackSettings, updateParticipants } = useMealPlans();
const { household, load: loadHousehold } = useHousehold();
const { show } = useAppSnackbar();

const id = String(route.params.id);
// The household gives the participant picker its members, with their names and diets.
const [{ data: result, refresh: refreshPlan }] = await Promise.all([
  useAsyncData(`plan-${id}`, () => loadPlan(id)),
  callOnce("household", loadHousehold, { mode: "navigation" }),
]);

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

// Same pattern for the participants: the count follows the tap, and a refused save puts the old set back.
async function saveParticipants(participantIds: string[]) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  result.value = { status: "found", plan: { ...current, participantIds } };
  isSaving.value = true;
  const saved = await updateParticipants(current.id, participantIds);
  isSaving.value = false;

  if (!saved.isSaved) {
    result.value = { status: "found", plan: current };
    show(saved.errorKey, "error");
    // Someone left or was removed meanwhile, which also took them off this plan: show both as they are now.
    if (saved.errorKey === "plan.errors.participantNotMember") {
      await Promise.all([loadHousehold({ isSilent: true }), refreshPlan()]);
    }
  }
}

const participantIds = computed({
  get: () => plan.value?.participantIds ?? [],
  set: (value: string[]) => saveParticipants(value),
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
        <div :class="$style.settings">
          <!-- Individual plans have one participant, their owner, so they show no picker. -->
          <PlanParticipantPicker
            v-if="plan.kind === 'household' && household"
            v-model="participantIds"
            :members="household.members"
            :disabled="isSaving"
          />
          <PlanSnackSettings
            v-model:include-snacks="includeSnacks"
            v-model:snacks-on-list="snacksOnList"
            :disabled="isSaving"
          />
        </div>
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

.settings {
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

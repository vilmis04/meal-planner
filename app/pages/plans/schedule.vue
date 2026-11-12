<script setup lang="ts">
import { z } from "zod";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { PlanScheduleSettings } from "#shared/utils/planSchedule.types";
import type { PlanSchedules } from "~/types/planSchedule.types";

defineOptions({ name: "AutomaticPlansPage" });

// Errors that mean the screen is out of date (the owner changed, or someone left): it reads everything again.
const STALE_STATE_ERRORS = new Set([
  "plan.schedule.errors.notOwner",
  "plan.schedule.errors.notInHousehold",
  "plan.errors.participantNotMember",
]);

const { t } = useI18n();
const route = useRoute();
const { household, isOwner, load: loadHousehold } = useHousehold();
const { load, save } = usePlanSchedules();
const { show } = useAppSnackbar();
const today = useToday();

useHead({ title: () => t("plan.schedule.pageTitle") });

// The household's schedule is offered only to someone in a household.
await callOnce("household", loadHousehold, { mode: "navigation" });
const { data: result, refresh } = await useAsyncData("plan-schedules", load);

// "?for=individual" (or "household") opens that schedule, as the Household page's link does.
const requestedKind = z.enum(PLAN_KINDS).safeParse(route.query.for);
const getInitialKind = (): PlanKind => {
  if (!household.value) {
    return "individual";
  }
  return requestedKind.success ? requestedKind.data : "household";
};
const kind = ref<PlanKind>(getInitialKind());

// What the screen shows, changed at once on every tap, and what the database last confirmed, to go back to.
const schedules = ref<PlanSchedules>({});
const savedSchedules = ref<PlanSchedules>({});
watch(
  result,
  (current) => {
    const loaded = current?.status === "loaded" ? current.schedules : {};
    schedules.value = loaded;
    savedSchedules.value = loaded;
  },
  { immediate: true },
);

watch(household, (current) => {
  if (!current && kind.value === "household") {
    kind.value = "individual";
  }
});

const settings = computed(() => schedules.value[kind.value] ?? DEFAULT_PLAN_SCHEDULE);
const isReadOnly = computed(() => kind.value === "household" && !isOwner.value);
const members = computed(() => household.value?.members ?? []);

// The kinds changed since they were last saved. Saves run one at a time, each sending the latest settings whole, so
// a burst of taps ends with the last state saved.
const unsavedKinds = new Set<PlanKind>();

const saveChanges = createCoalescedRunner(async () => {
  const kinds = [...unsavedKinds];
  unsavedKinds.clear();
  for (const scheduleKind of kinds) {
    const sent = schedules.value[scheduleKind];
    if (!sent) {
      continue;
    }
    const saved = await save(scheduleKind, sent);
    if (saved.isSaved) {
      savedSchedules.value = { ...savedSchedules.value, [scheduleKind]: sent };
      continue;
    }

    schedules.value = { ...schedules.value, [scheduleKind]: savedSchedules.value[scheduleKind] };
    show(saved.errorKey, "error");
    if (STALE_STATE_ERRORS.has(saved.errorKey)) {
      await Promise.all([loadHousehold({ isSilent: true }), refresh()]);
    }
  }
});

function changeSettings(change: Partial<PlanScheduleSettings>) {
  const scheduleKind = kind.value;
  schedules.value = { ...schedules.value, [scheduleKind]: { ...settings.value, ...change } };
  unsavedKinds.add(scheduleKind);
  saveChanges();
}
</script>

<template>
  <LayoutPage width="narrow">
    <header :class="$style.header">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        to="/plans"
        :aria-label="t('plan.schedule.back')"
        data-testid="plan-schedule-back"
      />
      <h1 :class="$style.title">{{ t("plan.schedule.title") }}</h1>
    </header>

    <v-alert v-if="result?.status !== 'loaded'" type="error" variant="tonal" data-testid="plan-schedule-load-failed">
      {{ t("plan.schedule.errors.loadFailed") }}
    </v-alert>
    <template v-else>
      <v-btn-toggle
        v-if="household"
        v-model="kind"
        mandatory
        divided
        variant="outlined"
        color="primary"
        :class="$style.toggle"
        :aria-label="t('plan.new.who')"
        data-testid="plan-schedule-kind"
      >
        <v-btn
          value="household"
          :prepend-icon="kind === 'household' ? 'mdi-check' : undefined"
          :class="$style.toggleButton"
          data-testid="plan-schedule-kind-household"
        >
          {{ t("plan.new.household") }}
        </v-btn>
        <v-btn
          value="individual"
          :prepend-icon="kind === 'individual' ? 'mdi-check' : undefined"
          :class="$style.toggleButton"
          data-testid="plan-schedule-kind-individual"
        >
          {{ t("plan.new.individual") }}
        </v-btn>
      </v-btn-toggle>

      <p v-if="isReadOnly" :class="$style.note" data-testid="plan-schedule-owner-only">
        {{ t("plan.schedule.ownerOnly") }}
      </p>

      <PlanScheduleSettings
        :key="kind"
        :kind="kind"
        :settings="settings"
        :members="members"
        :today="today"
        :disabled="isReadOnly"
        @change="changeSettings"
      />
    </template>
  </LayoutPage>
</template>

<style module>
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

.toggle {
  width: 100%;
  height: 48px !important;
  border-radius: 12px !important;
}

.toggleButton {
  flex: 1 1 0;
  height: 48px !important;
  font-size: 15px;
  text-transform: none;
}

.note {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}
</style>

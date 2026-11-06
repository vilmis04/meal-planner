<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";
import type { PlanKind } from "#shared/utils/mealPlan";

const { t } = useI18n();
const { household, load: loadHousehold } = useHousehold();
const { create } = useMealPlans();
const { show } = useAppSnackbar();

const kind = ref<PlanKind>(household.value ? "household" : "individual");
// Set in the browser: "next Monday" depends on the user's own date, not the server's.
const startDate = ref("");
const dayCount = ref(PLAN_DAY_COUNT_DEFAULT);
const includeSnacks = ref(true);
const snacksOnList = ref(true);
const isSaving = ref(false);
const minDays = PLAN_DAY_COUNT_MIN;
const maxDays = PLAN_DAY_COUNT_MAX;

onMounted(() => {
  if (!startDate.value) {
    startDate.value = getDefaultStartDate(toLocalIsoDate(new Date()));
  }
});

// Someone who leaves their household while this screen is open is moved to "Just me".
watch(household, (current) => {
  if (!current && kind.value === "household") {
    kind.value = "individual";
  }
});

const startDateRules = [(value: string) => isIsoDate(value) || t("plan.errors.invalidStartDate")];

const changeDayCount = (step: number): void => {
  dayCount.value = clampDayCount(dayCount.value + step);
};

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid || isSaving.value) {
    return;
  }

  isSaving.value = true;
  const result = await create({
    kind: kind.value,
    startDate: startDate.value,
    dayCount: dayCount.value,
    includeSnacks: includeSnacks.value,
    snacksOnList: snacksOnList.value,
  });

  if (result.isCreated) {
    show("plan.new.created", "success");
    await navigateTo(`/plans/${result.id}`);
    return;
  }

  isSaving.value = false;
  show(result.errorKey, "error");
  // Removed from the household elsewhere: show what is really there.
  if (result.errorKey === "plan.errors.notInHousehold") {
    await loadHousehold({ isSilent: true });
  }
}
</script>

<template>
  <v-form :class="$style.form" data-testid="plan-create-form" @submit.prevent="handleSubmit">
    <section :class="$style.section" aria-labelledby="plan-who-label">
      <h2 id="plan-who-label" :class="$style.label">{{ t("plan.new.who") }}</h2>
      <v-btn-toggle
        v-model="kind"
        mandatory
        divided
        variant="outlined"
        color="primary"
        :class="$style.toggle"
        data-testid="plan-kind"
      >
        <v-btn
          value="household"
          :disabled="!household"
          :prepend-icon="kind === 'household' ? 'mdi-check' : undefined"
          :class="$style.toggleButton"
          data-testid="plan-kind-household"
        >
          {{ t("plan.new.household") }}
        </v-btn>
        <v-btn
          value="individual"
          :prepend-icon="kind === 'individual' ? 'mdi-check' : undefined"
          :class="$style.toggleButton"
          data-testid="plan-kind-individual"
        >
          {{ t("plan.new.individual") }}
        </v-btn>
      </v-btn-toggle>
      <p v-if="!household" :class="$style.hint" data-testid="plan-no-household">
        {{ t("plan.new.noHousehold") }}
        <NuxtLink to="/household" :class="$style.link">{{ t("plan.new.noHouseholdAction") }}</NuxtLink>
      </p>
    </section>

    <div :class="$style.period">
      <v-text-field
        v-model="startDate"
        type="date"
        variant="outlined"
        hide-details="auto"
        :label="t('plan.new.starts')"
        :rules="startDateRules"
        prepend-inner-icon="mdi-calendar-outline"
        :class="$style.start"
        data-testid="plan-start-date"
      />
      <div :class="$style.stepper" role="group" :aria-label="t('plan.new.days')">
        <span :class="$style.stepperLabel">{{ t("plan.new.days") }}</span>
        <v-btn
          icon="mdi-minus"
          variant="text"
          size="small"
          :disabled="dayCount <= minDays"
          :aria-label="t('plan.new.fewerDays')"
          data-testid="plan-days-decrease"
          @click="changeDayCount(-1)"
        />
        <output :class="$style.count" aria-live="polite" data-testid="plan-day-count">{{ dayCount }}</output>
        <v-btn
          icon="mdi-plus"
          variant="text"
          size="small"
          color="primary"
          :disabled="dayCount >= maxDays"
          :aria-label="t('plan.new.moreDays')"
          data-testid="plan-days-increase"
          @click="changeDayCount(1)"
        />
      </div>
    </div>

    <PlanSnackSettings v-model:include-snacks="includeSnacks" v-model:snacks-on-list="snacksOnList" />

    <div :class="$style.actions">
      <v-btn
        variant="outlined"
        size="large"
        prepend-icon="mdi-auto-fix"
        disabled
        :class="$style.action"
        aria-describedby="plan-generate-soon"
        data-testid="plan-generate"
      >
        {{ t("plan.new.generate") }}
      </v-btn>
      <v-btn
        type="submit"
        color="primary"
        size="large"
        :loading="isSaving"
        :class="$style.action"
        data-testid="plan-create"
      >
        {{ t("plan.new.create") }}
      </v-btn>
    </div>
    <p id="plan-generate-soon" :class="$style.hint">{{ t("plan.new.generateSoon") }}</p>
  </v-form>
</template>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
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

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.link {
  color: var(--color-primary);
  font-weight: 600;
}

.period {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.start {
  flex: 1.3 1 0;
  min-width: 0;
}

.stepper {
  position: relative;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--space-1);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: var(--radius-sm);
}

.stepperLabel {
  position: absolute;
  top: -9px;
  left: 10px;
  padding: 0 4px;
  background-color: var(--color-background);
  font-size: 12px;
  color: var(--color-muted);
}

.count {
  font-size: 17px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.action {
  flex: 1 1 0;
  min-width: 0;
  text-transform: none;
}
</style>

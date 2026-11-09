<script setup lang="ts">
import type { PlanKind } from "#shared/utils/mealPlan";
import type { NewPlanPrefill } from "#shared/utils/planAlongside.types";

// What the screen's address asked to fill in (E7), such as the days of a household plan the user is not eating from.
const props = defineProps<{ prefill: NewPlanPrefill }>();

const { t } = useI18n();
const { household, load: loadHousehold } = useHousehold();
const { create, generate } = useMealPlans();
const { show } = useAppSnackbar();

// A household plan only for someone in a household, whatever the address asked for.
const getInitialKind = (): PlanKind => {
  if (!household.value) {
    return "individual";
  }
  return props.prefill.kind ?? "household";
};
const kind = ref<PlanKind>(getInitialKind());
// Set in the browser unless the address names it: "next Monday" depends on the user's own date, not the server's.
const startDate = ref(props.prefill.startDate ?? "");
const dayCount = ref(props.prefill.dayCount ?? PLAN_DAY_COUNT_DEFAULT);
const includeSnacks = ref(true);
const snacksOnList = ref(true);
const workdays = ref<number[]>([...DEFAULT_WORKDAYS]);
const cooldownDays = ref(COOLDOWN_DAYS_DEFAULT);
// Which button is at work: "Create empty" or "Generate plan" (E4).
const savingAction = ref<"empty" | "generate" | null>(null);
const form = useTemplateRef("form");
// Everyone takes part by default; the picker lets the user untick people for this plan.
const allMemberIds = (): string[] => household.value?.members.map((member) => member.userId) ?? [];
const participantIds = ref<string[]>(allMemberIds());
const minDays = PLAN_DAY_COUNT_MIN;
const maxDays = PLAN_DAY_COUNT_MAX;

onMounted(() => {
  if (!startDate.value) {
    startDate.value = getDefaultStartDate(toLocalIsoDate(new Date()));
  }
});

// Someone who leaves their household while this screen is open is moved to "Just me". When the household
// is reloaded (someone joined or left), everyone in it is ticked again, so no one who left stays chosen.
watch(household, (current) => {
  participantIds.value = allMemberIds();
  if (!current && kind.value === "household") {
    kind.value = "individual";
  }
});

const startDateRules = [(value: string) => isIsoDate(value) || t("plan.errors.invalidStartDate")];

const changeDayCount = (step: number): void => {
  dayCount.value = clampDayCount(dayCount.value + step);
};

// "Generate plan" creates the plan and fills it at once; "Create empty" leaves it to be filled by hand.
async function savePlan(shouldGenerate: boolean) {
  const validation = await form.value?.validate();
  if (!validation?.valid || savingAction.value) {
    return;
  }

  savingAction.value = shouldGenerate ? "generate" : "empty";
  const result = await create({
    kind: kind.value,
    startDate: startDate.value,
    dayCount: dayCount.value,
    includeSnacks: includeSnacks.value,
    snacksOnList: snacksOnList.value,
    participantIds: kind.value === "household" ? participantIds.value : undefined,
    workdays: workdays.value,
    cooldownDays: cooldownDays.value,
  });

  if (result.isCreated && shouldGenerate) {
    // The plan exists either way, so the user goes to it; a failed fill can be retried there.
    const generated = await generate(result.id);
    if (generated.isGenerated) {
      show(getGenerationDoneKey(generated.summary), "success");
    } else {
      show("plan.generate.errors.createdNotFilled", "error");
    }
    await navigateTo(`/plans/${result.id}`);
    return;
  }
  if (result.isCreated) {
    show("plan.new.created", "success");
    await navigateTo(`/plans/${result.id}`);
    return;
  }

  savingAction.value = null;
  show(result.errorKey, "error");
  // The household changed elsewhere: show what is really there.
  if (result.errorKey === "plan.errors.notInHousehold" || result.errorKey === "plan.errors.participantNotMember") {
    await loadHousehold({ isSilent: true });
  }
}
</script>

<template>
  <v-form ref="form" :class="$style.form" data-testid="plan-create-form" @submit.prevent="savePlan(true)">
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

    <PlanParticipantPicker
      v-if="kind === 'household' && household"
      v-model="participantIds"
      :members="household.members"
    />

    <PlanSnackSettings v-model:include-snacks="includeSnacks" v-model:snacks-on-list="snacksOnList" />

    <PlanGenerationSettings v-model:workdays="workdays" v-model:cooldown-days="cooldownDays" />

    <div :class="$style.actions">
      <v-btn
        variant="outlined"
        size="large"
        :loading="savingAction === 'empty'"
        :disabled="savingAction === 'generate'"
        :class="[$style.action, $style.secondary]"
        data-testid="plan-create"
        @click="savePlan(false)"
      >
        {{ t("plan.new.create") }}
      </v-btn>
      <v-btn
        type="submit"
        color="primary"
        size="large"
        prepend-icon="mdi-auto-fix"
        :loading="savingAction === 'generate'"
        :disabled="savingAction === 'empty'"
        :class="$style.action"
        data-testid="plan-generate"
      >
        {{ t("plan.new.generate") }}
      </v-btn>
    </div>
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
  flex: 1.4 1 0;
  min-width: 0;
  text-transform: none;
}

.secondary {
  flex-grow: 1;
}
</style>

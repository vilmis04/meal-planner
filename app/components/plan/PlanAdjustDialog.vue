<script setup lang="ts">
import type { MealType } from "#shared/utils/mealFilter";
import type { PlanAdjustment, PlanConstraints } from "#shared/utils/planAdjustment.types";
import type { PlanConstraintRule } from "~/types/planAdjustment.types";

/*
 * Adjusting a plan by text (I3): the request goes to the AI, which answers rules; they are listed here for the user
 * to check (and take out any they do not want) before the generator applies them to the unlocked meals. The AI never
 * changes a slot itself.
 */
const props = defineProps<{
  planId: string;
  // The plan's dates, by day index.
  planDays: readonly string[];
  // Filled slots that are locked, so they stay as they are.
  lockedCount: number;
  isApplying: boolean;
}>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ apply: [constraints: PlanConstraints] }>();

const { t, locale } = useI18n();
const { interpret } = usePlanAdjustment();

const text = ref("");
const adjustment = ref<PlanAdjustment | null>(null);
const isInterpreting = ref(false);
const errorKey = ref<string | null>(null);
const isBusy = computed(() => isInterpreting.value || props.isApplying);
const canInterpret = computed(() => normalizeAdjustmentText(text.value).length > 0 && !isBusy.value);

// Each opening starts at the request, with the last text kept so it can be changed.
watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    adjustment.value = null;
    errorKey.value = null;
  }
});

async function interpretText() {
  if (!canInterpret.value) {
    return;
  }
  isInterpreting.value = true;
  errorKey.value = null;
  const result = await interpret(props.planId, normalizeAdjustmentText(text.value));
  isInterpreting.value = false;
  if (result.isInterpreted) {
    adjustment.value = result.adjustment;
  } else {
    errorKey.value = result.errorKey;
  }
}

function removeRule(rule: PlanConstraintRule) {
  const current = adjustment.value;
  if (current) {
    adjustment.value = { ...current, constraints: withoutConstraintRule(current.constraints, rule) };
  }
}

function apply() {
  if (adjustment.value && hasPlanConstraints(adjustment.value.constraints)) {
    emit("apply", adjustment.value.constraints);
  }
}

// "Mon, 16 Nov; Wed, 18 Nov · Dinner", or "Whole plan".
const formatDays = (dayIndexes: readonly number[]): string =>
  dayIndexes
    .flatMap((dayIndex) => props.planDays[dayIndex] ?? [])
    .map((date) => formatPlanDay(date, locale.value, { weekday: "short", day: "numeric", month: "short" }))
    .join("; ");
const formatMealTypes = (mealTypes: readonly MealType[]): string =>
  mealTypes.map((mealType) => t(`recipes.mealType.${mealType}`)).join(", ");

const getRuleLabel = (rule: PlanConstraintRule): string => {
  switch (rule.kind) {
    case "excluded_protein":
      return t("plan.adjust.rule.excludedProtein", { protein: t(`plan.adjust.protein.${rule.protein}`) });
    case "excluded_ingredient":
      return t("plan.adjust.rule.excludedIngredient", { ingredient: rule.ingredientName });
    case "quick_meals":
      return t("plan.adjust.rule.quickMeals");
  }
};

const getRuleScope = (rule: PlanConstraintRule): string => {
  // A quick meal is a lunch or a dinner, so "every meal" would say too much.
  const mealTypes = rule.kind === "quick_meals" ? (rule.mealTypes ?? BATCH_MEAL_TYPES) : rule.mealTypes;
  if (rule.dayIndexes === null && mealTypes === null) {
    return t("plan.adjust.scope.wholePlan");
  }
  const days = rule.dayIndexes === null ? t("plan.adjust.scope.everyDay") : formatDays(rule.dayIndexes);
  const meals = mealTypes === null ? t("plan.adjust.scope.everyMeal") : formatMealTypes(mealTypes);
  return `${days} · ${meals}`;
};

const rules = computed(() =>
  adjustment.value
    ? getConstraintRules(adjustment.value.constraints).map((rule) => ({
        rule,
        key: `${rule.kind}-${rule.index}`,
        label: getRuleLabel(rule),
        scope: getRuleScope(rule),
        icon: rule.kind === "quick_meals" ? "mdi-lightning-bolt-outline" : "mdi-close-circle-outline",
      }))
    : [],
);
</script>

<template>
  <v-dialog v-model="isOpen" max-width="520" :persistent="isBusy">
    <v-card :class="$style.card" data-testid="plan-adjust-dialog">
      <h2 :class="$style.title">{{ t("plan.adjust.title") }}</h2>

      <form v-if="!adjustment" :class="$style.form" @submit.prevent="interpretText">
        <p :class="$style.text">{{ t("plan.adjust.intro") }}</p>
        <v-textarea
          v-model="text"
          :label="t('plan.adjust.label')"
          :placeholder="t('plan.adjust.placeholder')"
          :counter="PLAN_ADJUSTMENT_TEXT_MAX_LENGTH"
          :maxlength="PLAN_ADJUSTMENT_TEXT_MAX_LENGTH"
          :disabled="isInterpreting"
          rows="3"
          auto-grow
          autofocus
          data-testid="plan-adjust-text"
        />
        <p :class="$style.hint">{{ t("plan.adjust.privacy") }}</p>
        <v-alert v-if="errorKey" type="error" variant="tonal" density="compact" data-testid="plan-adjust-error">
          {{ t(errorKey) }}
        </v-alert>
        <div :class="$style.actions">
          <v-btn variant="text" color="primary" size="large" :disabled="isInterpreting" @click="isOpen = false">
            {{ t("plan.adjust.cancel") }}
          </v-btn>
          <v-btn
            type="submit"
            variant="flat"
            color="primary"
            size="large"
            prepend-icon="mdi-creation"
            :loading="isInterpreting"
            :disabled="!canInterpret"
            data-testid="plan-adjust-interpret"
          >
            {{ t("plan.adjust.interpret") }}
          </v-btn>
        </div>
      </form>

      <template v-else>
        <p :class="$style.text">{{ t(rules.length ? "plan.adjust.confirmIntro" : "plan.adjust.nothingToApply") }}</p>
        <ul v-if="rules.length" :class="$style.rules" data-testid="plan-adjust-rules">
          <li v-for="item in rules" :key="item.key" :class="$style.rule" data-testid="plan-adjust-rule">
            <v-icon :icon="item.icon" size="20" color="primary" :class="$style.ruleIcon" />
            <div :class="$style.ruleText">
              <span :class="$style.ruleLabel">{{ item.label }}</span>
              <span :class="$style.ruleScope">{{ item.scope }}</span>
            </div>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              :aria-label="t('plan.adjust.removeRule', { rule: item.label })"
              :disabled="isApplying"
              data-testid="plan-adjust-rule-remove"
              @click="removeRule(item.rule)"
            />
          </li>
        </ul>
        <v-alert
          v-if="adjustment.unsupported.length"
          type="warning"
          variant="tonal"
          density="compact"
          data-testid="plan-adjust-unsupported"
        >
          <p :class="$style.unsupportedTitle">{{ t("plan.adjust.unsupportedTitle") }}</p>
          <ul :class="$style.unsupported">
            <li v-for="part in adjustment.unsupported" :key="part">{{ t("plan.adjust.unsupportedPart", { part }) }}</li>
          </ul>
        </v-alert>
        <p v-if="rules.length" :class="$style.hint">
          {{ t("plan.adjust.lockedNote", { count: lockedCount }, lockedCount) }}
        </p>
        <div :class="$style.actions">
          <v-btn
            variant="text"
            color="primary"
            size="large"
            :disabled="isApplying"
            data-testid="plan-adjust-back"
            @click="adjustment = null"
          >
            {{ t("plan.adjust.back") }}
          </v-btn>
          <v-btn
            variant="flat"
            color="primary"
            size="large"
            prepend-icon="mdi-auto-fix"
            :loading="isApplying"
            :disabled="!rules.length"
            data-testid="plan-adjust-apply"
            @click="apply"
          >
            {{ t("plan.adjust.apply") }}
          </v-btn>
        </div>
      </template>
    </v-card>
  </v-dialog>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 24px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.text {
  margin: 0;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 48px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.ruleIcon {
  flex: 0 0 auto;
}

.ruleText {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ruleLabel {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.ruleScope {
  font-size: 13px;
  color: var(--color-muted);
}

.unsupportedTitle {
  margin: 0;
  font-weight: 600;
}

.unsupported {
  margin: 0;
  padding-left: var(--space-4);
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

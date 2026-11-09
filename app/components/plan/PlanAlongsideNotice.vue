<script setup lang="ts">
import type { PlanAlongside } from "#shared/utils/planAlongside.types";

// The viewer's other plan for the same days (E7): on a household plan they do not eat from, the way to their own plan
// (or to make one for those days); on their own plan, the household plan beside it.
const props = defineProps<{ alongside: PlanAlongside }>();

const { t, locale } = useI18n();

const notice = computed(() => {
  const alongside = props.alongside;
  if (alongside.type === "create_own") {
    return {
      type: "info" as const,
      textKey: "plan.alongside.createOwn",
      range: "",
      actionKey: "plan.alongside.createOwnAction",
      icon: "mdi-plus",
      to: { path: "/plans/new", query: getOwnPlanQuery(alongside) },
      testId: "plan-alongside-create",
    };
  }
  const range = formatPlanRange(alongside.plan.startDate, alongside.plan.endDate, locale.value);
  const to = `/plans/${alongside.plan.id}`;
  if (alongside.type === "own_plan") {
    return {
      type: "info" as const,
      textKey: "plan.alongside.ownPlan",
      range,
      actionKey: "plan.alongside.ownPlanAction",
      icon: "mdi-account",
      to,
      testId: "plan-alongside-own",
    };
  }
  // Eating from both is allowed (someone may join the household for some meals), but usually means they forgot to
  // untick themselves there, so it is a warning.
  return {
    type: alongside.isViewerParticipant ? ("warning" as const) : ("info" as const),
    textKey: alongside.isViewerParticipant ? "plan.alongside.householdEating" : "plan.alongside.householdPlan",
    range,
    actionKey: "plan.alongside.householdAction",
    icon: "mdi-home-account",
    to,
    testId: "plan-alongside-household",
  };
});
</script>

<template>
  <v-alert :type="notice.type" variant="tonal" :class="$style.notice" :data-testid="notice.testId">
    <p :class="$style.text">{{ t(notice.textKey, { range: notice.range }) }}</p>
    <v-btn
      :to="notice.to"
      variant="outlined"
      color="primary"
      :prepend-icon="notice.icon"
      :class="$style.action"
      :data-testid="`${notice.testId}-action`"
    >
      {{ t(notice.actionKey) }}
    </v-btn>
  </v-alert>
</template>

<style module>
.notice :global(.v-alert__content) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.text {
  margin: 0;
}

.action {
  min-height: 44px;
  text-transform: none;
}
</style>

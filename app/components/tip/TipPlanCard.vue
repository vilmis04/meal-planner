<script setup lang="ts">
import { getTipStartIndex } from "#shared/utils/tips";

// The plan page's tip (X3): one planning tip at a time (swapping meals, meal times, family portions, weighing), with
// "Next tip" to read the others. Each plan starts at its own tip, so they take turns from plan to plan. Hiding folds
// the card into a small "Show tips" button, remembered for every plan in this browser.
const { planId, participantCount } = defineProps<{ planId: string; participantCount: number }>();

const { t } = useI18n();
const { getPlanTipList } = useTips();
const { isCollapsed, setCollapsed } = useTipsCollapsed("plan");

const tips = computed(() => getPlanTipList(participantCount));
// How many times "Next tip" was tapped on this plan.
const step = ref(0);
watch(
  () => planId,
  () => {
    step.value = 0;
  },
);
const index = computed(() =>
  tips.value.length === 0 ? 0 : (getTipStartIndex(planId, tips.value.length) + step.value) % tips.value.length,
);
const tip = computed(() => tips.value[index.value]);
</script>

<template>
  <template v-if="tip">
    <button
      v-if="isCollapsed"
      type="button"
      :class="$style.show"
      data-testid="plan-tips-show"
      @click="setCollapsed(false)"
    >
      <v-icon icon="mdi-lightbulb-on-outline" size="18" :class="$style.icon" aria-hidden="true" />
      {{ t("tips.show") }}
    </button>
    <aside v-else :class="$style.card" :aria-label="t('tips.planTitle')" data-testid="plan-tips">
      <div :class="$style.header">
        <v-icon icon="mdi-lightbulb-on-outline" size="20" :class="$style.icon" aria-hidden="true" />
        <span :class="$style.title">{{ t("tips.planTitle") }}</span>
        <span v-if="tips.length > 1" :class="$style.position" data-testid="plan-tips-position">
          {{ t("tips.position", { current: index + 1, total: tips.length }) }}
        </span>
        <v-btn
          v-if="tips.length > 1"
          icon="mdi-chevron-right"
          variant="text"
          size="small"
          :class="$style.action"
          :aria-label="t('tips.next')"
          data-testid="plan-tips-next"
          @click="step++"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :class="$style.action"
          :aria-label="t('tips.hide')"
          data-testid="plan-tips-hide"
          @click="setCollapsed(true)"
        />
      </div>
      <p :class="$style.text" aria-live="polite" data-testid="plan-tips-text" :data-tip-id="tip.id">{{ tip.text }}</p>
    </aside>
  </template>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-1) var(--space-1) var(--space-3) var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon {
  flex: 0 0 auto;
  color: var(--color-secondary);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
}

.position {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.action {
  flex: 0 0 auto;
  width: var(--touch-target);
  height: var(--touch-target);
}

.text {
  margin: 0;
  padding-right: var(--space-3);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.show {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.show:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

<script setup lang="ts">
// The two snack options of a plan (E1). Used on the New plan screen and on the plan page, where each change saves.
defineProps<{ disabled?: boolean }>();

const includeSnacks = defineModel<boolean>("includeSnacks", { required: true });
const snacksOnList = defineModel<boolean>("snacksOnList", { required: true });

const { t } = useI18n();

// The switch reads "leave snacks off the list", the stored flag is "snacks on the list".
const leaveOffList = computed({
  get: () => !snacksOnList.value,
  set: (value: boolean) => {
    snacksOnList.value = !value;
  },
});
</script>

<template>
  <section :class="$style.section" aria-labelledby="plan-snacks-title">
    <h2 id="plan-snacks-title" :class="$style.label">{{ t("plan.snacks.title") }}</h2>
    <v-card variant="flat" border :class="$style.card">
      <div :class="$style.row">
        <label for="plan-include-snacks" :class="$style.text">{{ t("plan.snacks.include") }}</label>
        <v-switch
          id="plan-include-snacks"
          v-model="includeSnacks"
          color="primary"
          thumb-color="on-primary"
          inset
          hide-details
          density="compact"
          :disabled="disabled"
          data-testid="plan-include-snacks"
        />
      </div>
      <v-divider />
      <div :class="$style.row">
        <label for="plan-snacks-off-list" :class="$style.text">
          <span>{{ t("plan.snacks.offList") }}</span>
          <span :class="$style.hint">
            {{ includeSnacks ? t("plan.snacks.offListHint") : t("plan.snacks.offListNeedsSlots") }}
          </span>
        </label>
        <v-switch
          id="plan-snacks-off-list"
          v-model="leaveOffList"
          color="primary"
          thumb-color="on-primary"
          inset
          hide-details
          density="compact"
          :disabled="disabled || !includeSnacks"
          data-testid="plan-snacks-off-list"
        />
      </div>
    </v-card>
  </section>
</template>

<style module>
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

.card {
  border-radius: var(--radius-lg);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 15px;
  cursor: pointer;
}

.hint {
  font-size: 12px;
  color: var(--color-muted);
}
</style>

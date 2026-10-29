<script setup lang="ts">
const { t, te } = useI18n();
const { profile } = useProfile();
const { changeDiet } = useProfileSettings();
const { show } = useAppSnackbar();

// The row follows the tap at once; a failed save puts the saved diet back.
const selected = ref<Diet>(profile.value?.diet ?? "full");
watch(() => profile.value?.diet, (saved) => {
  if (saved) {
    selected.value = saved;
  }
});

const selectedIndex = computed(() => DIETS.indexOf(selected.value));

const options = computed(() =>
  DIETS.map((diet, index) => ({
    diet,
    label: t(`profile.diet.options.${diet}.label`),
    hint: te(`profile.diet.options.${diet}.hint`) ? t(`profile.diet.options.${diet}.hint`) : null,
    isSelected: index === selectedIndex.value,
    // Steps above the chosen one are the ones it includes; steps below it are not part of the diet.
    isIncluded: index < selectedIndex.value,
    icon: index === selectedIndex.value
      ? "mdi-radiobox-marked"
      : index < selectedIndex.value
        ? "mdi-circle-medium"
        : "mdi-radiobox-blank",
  })),
);

async function handleUpdate(next: Diet | null) {
  if (next === null || next === selected.value) {
    return;
  }

  selected.value = next;
  const isSaved = await changeDiet(next);
  if (!isSaved) {
    if (selected.value === next) {
      selected.value = profile.value?.diet ?? "full";
    }
    show("profile.errors.saveFailed", "error");
  }
}
</script>

<template>
  <section :class="$style.section">
    <div :class="$style.heading">
      <h2 :class="$style.title">{{ t("profile.diet.title") }}</h2>
      <p :class="$style.hint">{{ t("profile.diet.hint") }}</p>
    </div>

    <v-card variant="flat" border :class="$style.card">
      <v-radio-group
        :model-value="selected"
        :aria-label="t('profile.diet.title')"
        hide-details
        @update:model-value="handleUpdate"
      >
        <v-radio
          v-for="option in options"
          :key="option.diet"
          :value="option.diet"
          :true-icon="option.icon"
          :false-icon="option.icon"
          :class="[$style.option, option.isSelected && $style.selected, option.isIncluded && $style.included]"
          color="primary"
          :data-testid="`diet-${option.diet}`"
        >
          <template #label>
            <span :class="$style.content">
              <span :class="$style.label">{{ option.label }}</span>
              <span v-if="option.isSelected" :class="$style.tag">{{ t("profile.diet.selected") }}</span>
              <span v-else-if="option.hint" :class="$style.optionHint">{{ option.hint }}</span>
            </span>
          </template>
        </v-radio>
      </v-radio-group>
    </v-card>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.heading {
  padding-inline: var(--space-1);
}

.title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.hint {
  margin: var(--space-1) 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.4;
}

.card {
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-lg);
}

/* Rows are 48px tall so every one is a comfortable touch target. */
.option {
  width: 100%;
  min-height: 48px;
  padding-inline: var(--space-2);
  border-radius: var(--radius-lg);
  color: var(--color-muted);
}

/* The top padding moves the text down 2px so lowercase letters sit level with the radio mark. */
.option :global(.v-label) {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: var(--space-1);
  color: inherit;
  opacity: 1;
}

.included {
  color: var(--color-on-surface);
}

.included :global(.v-icon) {
  color: var(--color-primary);
  opacity: 1;
}

.selected {
  background-color: rgb(var(--v-theme-primary), 0.12);
  color: var(--color-primary);
  font-weight: 700;
}

/* The label and its tag or hint share a baseline even though they differ in size. */
.content {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.label {
  flex: 1 1 auto;
  font-size: 15px;
}

.tag,
.optionHint {
  flex: none;
  font-size: 12px;
}

.optionHint {
  color: var(--color-muted);
}

.tag {
  font-weight: 600;
}
</style>

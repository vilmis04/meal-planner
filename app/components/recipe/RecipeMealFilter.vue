<script setup lang="ts">
defineProps<{ modelValue: MealFilter }>();
const emit = defineEmits<{ "update:modelValue": [filter: MealFilter] }>();

const { t } = useI18n();

const options = computed(() =>
  MEAL_FILTERS.map((filter) => ({
    filter,
    label: filter === "all" ? t("recipes.filter.all") : t(`recipes.mealType.${filter}`),
  })),
);

function handleUpdate(next: MealFilter | null) {
  // The group is mandatory, but a tap on the chosen chip would still report null.
  if (next !== null) {
    emit("update:modelValue", next);
  }
}
</script>

<template>
  <v-chip-group
    :model-value="modelValue"
    :aria-label="t('recipes.filter.label')"
    mandatory
    color="primary"
    @update:model-value="handleUpdate"
  >
    <v-chip
      v-for="option in options"
      :key="option.filter"
      :value="option.filter"
      variant="outlined"
      filter
      :class="$style.chip"
      :data-testid="`meal-filter-${option.filter}`"
    >
      {{ option.label }}
    </v-chip>
  </v-chip-group>
</template>

<style module>
/* Chips are 44px tall so each is a comfortable touch target; the group scrolls sideways when they do not fit. */
.chip {
  min-height: 44px;
  padding-inline: var(--space-3);
  font-size: 14px;
}
</style>

<script setup lang="ts">
import type { ShopInsightRange } from "~/types/shopInsights.types";

// The range an insight sums up (I1): one of SHOP_INSIGHT_RANGES, always one picked.
const range = defineModel<ShopInsightRange>({ required: true });

const { t } = useI18n();

const handleUpdate = (picked: unknown): void => {
  range.value = parseShopInsightRange(picked);
};
</script>

<template>
  <v-chip-group
    :model-value="range"
    mandatory
    column
    selected-class="text-primary"
    :aria-label="t('insights.range.label')"
    data-testid="insights-range"
    @update:model-value="handleUpdate"
  >
    <v-chip
      v-for="option in SHOP_INSIGHT_RANGES"
      :key="option"
      :value="option"
      :variant="option === range ? 'tonal' : 'outlined'"
      :class="$style.chip"
      :data-testid="`insights-range-${option}`"
    >
      {{ t(`insights.range.options.${option}`) }}
    </v-chip>
  </v-chip-group>
</template>

<style module>
/* At least 44px tall to tap. */
.chip {
  min-height: 44px;
}
</style>

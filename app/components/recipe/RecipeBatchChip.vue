<script setup lang="ts">
const props = defineProps<{ portionDays: number }>();

const { t } = useI18n();

// One cooked batch covers portionDays days: 1 means cook and eat the same day.
const isBatch = computed(() => props.portionDays > 1);
</script>

<template>
  <v-chip size="small" label variant="tonal" :color="isBatch ? 'primary' : undefined">
    {{ isBatch ? t("recipes.batch.multi", { count: portionDays }) : t("recipes.batch.single") }}
  </v-chip>
</template>

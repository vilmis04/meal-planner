<script setup lang="ts">
defineOptions({ name: "HouseholdPage" });

const { t } = useI18n();
const { household, loadFailed, load } = useHousehold();

useHead({ title: () => t("household.pageTitle") });

await callOnce("household", load, { mode: "navigation" });
</script>

<template>
  <div :class="$style.page">
    <h1 :class="$style.title">{{ t("household.title") }}</h1>

    <v-alert v-if="loadFailed" type="error" variant="tonal">
      {{ t("household.errors.loadFailed") }}
    </v-alert>
    <HouseholdOverview v-else-if="household" :household="household" />
    <HouseholdCreateForm v-else />
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
</style>

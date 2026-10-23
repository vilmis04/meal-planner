<script setup lang="ts">
defineOptions({ name: "HomePage" });

const { t } = useI18n();
const { profile } = useProfile();
const { load } = useHousehold();

await callOnce("household", load, { mode: "navigation" });
</script>

<template>
  <div :class="$style.page">
    <h1 :class="$style.title">
      {{ profile ? t("home.greeting", { name: profile.displayName }) : t("home.title") }}
    </h1>
    <HouseholdHomeCard />
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

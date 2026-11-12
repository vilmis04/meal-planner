<script setup lang="ts">
defineOptions({ name: "HomePage" });

const { t } = useI18n();
const { profile } = useProfile();
const { load } = useHousehold();

await callOnce("household", load, { mode: "navigation" });
</script>

<template>
  <LayoutPage width="medium" :title="profile ? t('home.greeting', { name: profile.displayName }) : t('home.title')">
    <!-- One column on phones; from 960px the cards sit side by side. -->
    <div :class="$style.cards">
      <PlanHomeCard />
      <PlanDraftNotice />
      <HouseholdHomeCard />
    </div>
  </LayoutPage>
</template>

<style module>
.cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 960px) {
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    align-items: start;
  }
}
</style>

<script setup lang="ts">
defineOptions({ name: "HouseholdPage" });

const { t } = useI18n();
const { household, loadFailed, load, clear } = useHousehold();
const { load: loadInvite } = useHouseholdInvite();

useHead({ title: () => t("household.pageTitle") });

await callOnce("household", load, { mode: "navigation" });
// Whoever is in a household can see its live invite.
await callOnce("household-invite", () => (household.value ? loadInvite() : undefined), { mode: "navigation" });

// Someone may have removed this user, or changed the owner, while the tab was in the background:
// show what is really there when they come back to it.
async function refreshOnFocus() {
  if (document.visibilityState !== "visible" || !household.value) {
    return;
  }

  await load({ isSilent: true });
  if (household.value) {
    await loadInvite();
  } else {
    clear();
  }
}

onMounted(() => document.addEventListener("visibilitychange", refreshOnFocus));
onBeforeUnmount(() => document.removeEventListener("visibilitychange", refreshOnFocus));
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

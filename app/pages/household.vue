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
  <LayoutPage width="medium" :title="t('household.title')">
    <v-alert v-if="loadFailed" type="error" variant="tonal">
      {{ t("household.errors.loadFailed") }}
    </v-alert>
    <HouseholdOverview v-else-if="household" :household="household" />
    <HouseholdCreateForm v-else />
  </LayoutPage>
</template>

<script setup lang="ts">
import type { InviteErrorStatus } from "~/types/household-invite.types";

defineOptions({ name: "JoinPage" });

const ERROR_ICON_BY_STATUS: Record<InviteErrorStatus, string> = {
  expired: "mdi-timer-sand",
  revoked: "mdi-link-off",
  used: "mdi-link-variant-off",
  not_found: "mdi-help-circle-outline",
};

const { t } = useI18n();
const route = useRoute();
const { preview, accept } = useJoinInvite();
const { household, loadFailed: isHouseholdLoadFailed, load: loadHousehold } = useHousehold();
const { show } = useAppSnackbar();

const token = String(route.params.token);
const previewKey = `invite-preview-${token}`;

// The link is a secret: keep it out of search results and out of the Referer header of links on this page.
useHead({
  title: () => t("household.join.pageTitle"),
  meta: [
    { name: "robots", content: "noindex" },
    { name: "referrer", content: "no-referrer" },
  ],
});

await callOnce("household", loadHousehold, { mode: "navigation" });
const { data: result, refresh } = await useAsyncData(previewKey, () => preview(token));

const isJoining = ref(false);
// Set when accepting finds the link unusable after all, for example someone else used it a moment ago.
const failedStatus = ref<InviteErrorStatus | null>(null);

const invite = computed(() => (result.value?.isLoaded ? result.value.preview : null));

const errorStatus = computed<InviteErrorStatus | null>(() => {
  if (failedStatus.value) {
    return failedStatus.value;
  }
  return invite.value && invite.value.status !== "valid" && !invite.value.isMember ? invite.value.status : null;
});

type JoinView = "failed" | "error" | "member" | "switch" | "accept";

const view = computed<JoinView>(() => {
  if (!invite.value || isHouseholdLoadFailed.value) {
    return "failed";
  }
  if (errorStatus.value) {
    return "error";
  }
  if (invite.value.isMember) {
    return "member";
  }
  return household.value ? "switch" : "accept";
});

async function handleAccept(isLeavingCurrent: boolean) {
  if (isJoining.value) {
    return;
  }

  isJoining.value = true;
  const outcome = await accept(token, isLeavingCurrent);
  isJoining.value = false;

  if (outcome.isJoined) {
    clearNuxtData(previewKey);
    show("household.join.joined", "success");
    await navigateTo("/household");
    return;
  }

  if (outcome.status) {
    failedStatus.value = outcome.status;
    return;
  }

  // Joined another household in the meantime: reload it, and the page switches to the choice.
  if (outcome.isInOtherHousehold) {
    await loadHousehold();
  }
  show(outcome.errorKey, "error");
}
</script>

<template>
  <div :class="$style.page">
    <v-alert v-if="view === 'failed'" type="error" variant="tonal">
      {{ t("household.join.errors.loadFailed") }}
      <template #append>
        <v-btn variant="text" size="small" @click="() => refresh()">{{ t("household.join.retry") }}</v-btn>
      </template>
    </v-alert>

    <HouseholdJoinNotice
      v-else-if="view === 'error' && errorStatus"
      :icon="ERROR_ICON_BY_STATUS[errorStatus]"
      tone="error"
      :title="t(`household.join.errors.${errorStatus}.title`)"
      :hint="t(`household.join.errors.${errorStatus}.hint`)"
      :action-label="t('household.join.errors.action')"
      action-to="/household"
    />

    <HouseholdJoinNotice
      v-else-if="view === 'member' && invite"
      icon="mdi-home-account"
      tone="info"
      :title="t('household.join.member.title', { name: invite.householdName })"
      :hint="t('household.join.member.hint')"
      :action-label="t('household.join.member.action')"
      action-to="/household"
    />

    <HouseholdJoinSwitch
      v-else-if="view === 'switch' && invite && household"
      :preview="invite"
      :current="household"
      :is-joining="isJoining"
      @leave="handleAccept(true)"
    />

    <HouseholdJoinAccept
      v-else-if="view === 'accept' && invite"
      :preview="invite"
      :is-joining="isJoining"
      @accept="handleAccept(false)"
    />
  </div>
</template>

<style module>
.page {
  max-width: var(--auth-max-width);
  margin-inline: auto;
}
</style>

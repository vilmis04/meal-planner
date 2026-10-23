<script setup lang="ts">
const MS_PER_DAY = 86_400_000;

const { t } = useI18n();
const { invite, inviteLink, loadFailed, create, revoke } = useHouseholdInvite();
const { show } = useAppSnackbar();

const isBusy = ref(false);

// Rounded up, so a link made a moment ago says 7 days and the last day says 1.
const daysLeft = computed(() =>
  invite.value ? Math.max(1, Math.ceil((Date.parse(invite.value.expiresAt) - Date.now()) / MS_PER_DAY)) : 0,
);

async function handleCreate() {
  if (isBusy.value) {
    return;
  }

  isBusy.value = true;
  const result = await create();
  isBusy.value = false;

  show(result.isDone ? "household.invite.created" : result.errorKey, result.isDone ? "success" : "error");
}

async function handleRevoke() {
  if (isBusy.value) {
    return;
  }

  isBusy.value = true;
  const result = await revoke();
  isBusy.value = false;

  show(result.isDone ? "household.invite.revoked" : result.errorKey, result.isDone ? "success" : "error");
}

async function handleCopy() {
  if (!inviteLink.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteLink.value);
    show("household.invite.copied", "success");
  } catch (error) {
    console.error("Copying the invite link failed", error);
    show("household.invite.errors.copyFailed", "error");
  }
}
</script>

<template>
  <section :class="$style.invite">
    <h3 :class="$style.sectionTitle">{{ t("household.invite.title") }}</h3>
    <v-card variant="flat" border :class="$style.card">
      <v-alert v-if="loadFailed" type="error" variant="tonal" density="compact">
        {{ t("household.invite.errors.loadFailed") }}
      </v-alert>

      <template v-else-if="invite">
        <div v-if="inviteLink" :class="$style.linkRow">
          <span :class="$style.link" data-testid="invite-link">{{ inviteLink }}</span>
          <v-btn color="primary" size="small" prepend-icon="mdi-content-copy" @click="handleCopy">
            {{ t("household.invite.copy") }}
          </v-btn>
        </div>
        <p v-else :class="$style.hint">{{ t("household.invite.activeHint") }}</p>

        <div :class="$style.footer">
          <span :class="$style.expires">{{ t("household.invite.expiresIn", daysLeft) }}</span>
          <div :class="$style.actions">
            <v-btn v-if="!inviteLink" variant="text" size="small" :disabled="isBusy" @click="handleCreate">
              {{ t("household.invite.replace") }}
            </v-btn>
            <v-btn variant="text" size="small" color="error" :disabled="isBusy" @click="handleRevoke">
              {{ t("household.invite.revoke") }}
            </v-btn>
          </div>
        </div>
      </template>

      <template v-else>
        <p :class="$style.hint">{{ t("household.invite.hint") }}</p>
        <v-btn color="primary" size="large" block :loading="isBusy" @click="handleCreate">
          {{ t("household.invite.create") }}
        </v-btn>
      </template>
    </v-card>
  </section>
</template>

<style module>
.invite {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sectionTitle {
  margin: 0;
  padding-inline: var(--space-1);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 600;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.5;
}

.linkRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  background-color: var(--color-background);
}

.link {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.expires {
  color: var(--color-muted);
  font-size: 13px;
}

.actions {
  display: flex;
  gap: var(--space-1);
}
</style>

<script setup lang="ts">
const SNACKBAR_TIMEOUT_MS = 4000;

const { t } = useI18n();
const { message, hide } = useAppSnackbar();

function handleVisibilityChange(isVisible: boolean) {
  if (!isVisible) {
    hide();
  }
}
</script>

<template>
  <v-snackbar
    :model-value="message !== null"
    :color="message?.color"
    :timeout="SNACKBAR_TIMEOUT_MS"
    location="bottom"
    :class="$style.snackbar"
    @update:model-value="handleVisibilityChange"
  >
    <template v-if="message">{{ t(message.textKey) }}</template>
  </v-snackbar>
</template>

<style module>
/* On phones the navigation bar sits along the bottom edge: keep the message above it. */
@media (max-width: 959.98px) {
  .snackbar {
    margin-bottom: var(--nav-height);
  }
}
</style>

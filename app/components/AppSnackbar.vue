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
    @update:model-value="handleVisibilityChange"
  >
    <template v-if="message">{{ t(message.textKey) }}</template>
  </v-snackbar>
</template>

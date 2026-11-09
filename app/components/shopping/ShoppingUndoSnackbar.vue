<script setup lang="ts">
// "Onion removed · Undo" after a line is removed or moved home (G4). Long enough to reach the button while shopping.
const UNDO_TIMEOUT_MS = 6000;

defineProps<{ text: string }>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ undo: [] }>();

const { t } = useI18n();

function undo() {
  isOpen.value = false;
  emit("undo");
}
</script>

<template>
  <v-snackbar v-model="isOpen" :timeout="UNDO_TIMEOUT_MS" location="bottom" :class="$style.snackbar" data-testid="shopping-undo">
    <span data-testid="shopping-undo-text">{{ text }}</span>
    <template #actions>
      <v-btn variant="text" :class="$style.action" data-testid="shopping-undo-action" @click="undo">
        {{ t("shoppingList.undo.action") }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style module>
.action {
  min-height: 44px;
  font-weight: 700;
}

/* On phones the navigation bar and the add button sit along the bottom edge: keep the message above both. */
@media (max-width: 959.98px) {
  .snackbar {
    margin-bottom: calc(var(--nav-height) + 88px);
  }
}
</style>

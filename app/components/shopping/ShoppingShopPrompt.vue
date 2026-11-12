<script setup lang="ts">
// "Onion bought · Add shop" after a line is ticked bought with no shop the viewer is shopping at (G7). It asks without
// stopping the shopping: ignoring it records no shop, which is allowed.
const PROMPT_TIMEOUT_MS = 5000;

defineProps<{ text: string }>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ choose: [] }>();

const { t } = useI18n();

function choose() {
  isOpen.value = false;
  emit("choose");
}
</script>

<template>
  <v-snackbar
    v-model="isOpen"
    :timeout="PROMPT_TIMEOUT_MS"
    location="bottom"
    :class="$style.snackbar"
    data-testid="shopping-shop-prompt"
  >
    <span data-testid="shopping-shop-prompt-text">{{ text }}</span>
    <template #actions>
      <v-btn variant="text" :class="$style.action" data-testid="shopping-shop-prompt-action" @click="choose">
        {{ t("shoppingList.shop.promptAction") }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style module>
.action {
  min-height: var(--touch-target);
  font-weight: 700;
}

/* On phones the navigation bar and the add button sit along the bottom edge: keep the message above both. */
@media (max-width: 959.98px) {
  .snackbar {
    margin-bottom: calc(var(--nav-height) + 88px);
  }
}
</style>

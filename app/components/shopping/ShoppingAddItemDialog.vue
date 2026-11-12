<script setup lang="ts">
import type { NewShoppingItem } from "#shared/utils/shoppingItemEdit.types";

// "Add item" on phones (G4): ShoppingAddItemForm in a dialog, which closes once the line is saved. Each opening
// starts empty: the form is made anew (the dialog keeps its content between openings).
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [item: NewShoppingItem] }>();

const openCount = ref(0);
watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    openCount.value += 1;
  }
});

function save(item: NewShoppingItem) {
  emit("save", item);
  isOpen.value = false;
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="440">
    <v-card :class="$style.card" data-testid="shopping-add-dialog">
      <ShoppingAddItemForm :key="openCount" @save="save" @cancel="isOpen = false" />
    </v-card>
  </v-dialog>
</template>

<style module>
.card {
  padding: var(--space-4);
  border-radius: 24px;
}
</style>

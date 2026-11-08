<script setup lang="ts">
import { useDisplay } from "vuetify";

// The frame for choosing a recipe for a slot (E3): a bottom sheet on phones, a dialog from 960px
// (--breakpoint-md). The page puts PlanSlotPickerPanel inside it.
const isOpen = defineModel<boolean>({ required: true });
const props = defineProps<{ busy?: boolean }>();

const { mdAndUp } = useDisplay();
</script>

<template>
  <v-dialog v-if="mdAndUp" v-model="isOpen" max-width="560" height="min(720px, 85vh)" :persistent="props.busy">
    <v-card :class="$style.card" rounded="lg">
      <slot />
    </v-card>
  </v-dialog>
  <!-- A fixed height, so the sheet does not jump while the search narrows the list. -->
  <v-bottom-sheet v-else v-model="isOpen" height="88dvh" :persistent="props.busy">
    <v-card :class="[$style.card, $style.sheet]">
      <span :class="$style.handle" aria-hidden="true" />
      <slot />
    </v-card>
  </v-bottom-sheet>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sheet {
  border-radius: 24px 24px 0 0 !important;
}

.handle {
  align-self: center;
  flex: 0 0 auto;
  width: 36px;
  height: 4px;
  margin-top: var(--space-2);
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.2);
}
</style>

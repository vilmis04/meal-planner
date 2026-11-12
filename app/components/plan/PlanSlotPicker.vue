<script setup lang="ts">
// The frame for choosing a recipe for a slot (E3): a bottom sheet on phones, and from 960px (md) a wide dialog with
// the list beside the selected recipe (X4). The page puts PlanSlotPickerPanel inside it, wide from the same width.
const isOpen = defineModel<boolean>({ required: true });
const props = defineProps<{ busy?: boolean }>();

const mdAndUp = useBreakpointUp("md");
</script>

<template>
  <v-dialog v-if="mdAndUp" v-model="isOpen" max-width="1200" height="min(820px, 90vh)" :persistent="props.busy">
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

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

// "← Plans": back to the page this one belongs to, as a full touch target aligned with the page's text.
defineProps<{ to: RouteLocationRaw; label: string }>();
</script>

<template>
  <v-btn :to="to" exact variant="text" prepend-icon="mdi-arrow-left" :class="$style.back">
    {{ label }}
  </v-btn>
</template>

<style module>
.back {
  align-self: flex-start;
  min-height: var(--touch-target);
  margin-left: calc(-1 * var(--space-2));
  text-transform: none;
}
</style>

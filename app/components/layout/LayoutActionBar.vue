<script setup lang="ts">
import type { ActionBarVariant } from "~/types/layout.types";

// A page's primary actions within reach of the thumb (X4).
// - "float": on phones the buttons float at the bottom, above the navigation bar, and the LayoutPage around them keeps
//   room below its last section. From 960px they stay where they are placed (a header, a toolbar) as an ordinary part
//   of the page, or are left out (isHiddenFromMd) when the page offers the action another way there.
// - "sticky": a bar at the end of a form that sticks to the bottom of the window while the form scrolls, above the
//   navigation bar on phones, so "Save" is always in reach.
const { variant = "float", isHiddenFromMd = false } = defineProps<{
  variant?: ActionBarVariant;
  isHiddenFromMd?: boolean;
}>();
</script>

<template>
  <div
    :class="[$style.bar, variant === 'sticky' ? $style.sticky : $style.float, isHiddenFromMd && $style.hiddenFromMd]"
    :data-layout-action-bar="variant"
  >
    <slot />
  </div>
</template>

<style module>
.sticky {
  position: sticky;
  bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-inline: calc(-1 * var(--page-gutter));
  padding: var(--space-2) var(--page-gutter);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-background);
}

@media (max-width: 959.98px) {
  .float {
    position: fixed;
    right: var(--page-gutter);
    bottom: calc(var(--nav-height) + var(--space-3) + env(safe-area-inset-bottom, 0px));
    left: var(--page-gutter);
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
    /* Taps between the buttons reach the page below. */
    pointer-events: none;
  }

  .float > * {
    pointer-events: auto;
  }
}

@media (min-width: 960px) {
  .float {
    display: contents;
  }

  .sticky {
    bottom: 0;
    margin-inline: 0;
    padding-inline: 0;
  }

  .hiddenFromMd {
    display: none;
  }
}
</style>

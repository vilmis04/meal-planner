<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { PageWidth } from "~/types/layout.types";

// Every page's container (X4): one column on phones, centred at a width that suits the page from tablets up.
// "narrow" for forms and settings, "medium" for lists to read, "wide" for two panes, "full" for the plan's week.
// The optional back button and title come first; a LayoutActionBar inside reserves room for itself on phones.
const {
  width = "wide",
  title = "",
  backTo = undefined,
  backLabel = "",
  isCompact = false,
} = defineProps<{
  width?: PageWidth;
  title?: string;
  backTo?: RouteLocationRaw;
  backLabel?: string;
  // The smaller gap between sections, for pages with many small ones.
  isCompact?: boolean;
}>();
</script>

<template>
  <div :class="[$style.page, $style[width], isCompact && $style.compact]">
    <LayoutBackButton v-if="backTo && backLabel" :to="backTo" :label="backLabel" />
    <h1 v-if="title" :class="$style.title">{{ title }}</h1>
    <slot />
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  min-width: 0;
  margin-inline: auto;
}

.compact {
  gap: var(--space-3);
}

.narrow {
  max-width: var(--page-narrow-width);
}

.medium {
  max-width: var(--page-medium-width);
}

.wide {
  max-width: var(--page-wide-width);
}

.full {
  max-width: var(--page-full-width);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

/* Room below the last section for a LayoutActionBar, which floats above the bottom navigation on phones. */
@media (max-width: 959.98px) {
  .page:has([data-layout-action-bar="float"]) {
    padding-bottom: calc(var(--touch-target) + var(--space-5));
  }
}
</style>

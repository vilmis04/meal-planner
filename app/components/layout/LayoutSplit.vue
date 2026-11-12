<script setup lang="ts">
import type { SplitAside, SplitAsideWidth, SplitBreakpoint, SplitPhonePane } from "~/types/layout.types";

// Two panes (X4): one column on phones, side by side from a breakpoint. The side pane ("aside") has a fixed width
// and, when sticky, keeps its place and scrolls on its own while the main pane scrolls with the page. Below the
// breakpoint a phone shows the main pane, the side pane or both, one above the other.
const {
  aside = "end",
  asideWidth = "list",
  from = "md",
  phonePane = "both",
  isAsideSticky = false,
  asideLabel = undefined,
} = defineProps<{
  aside?: SplitAside;
  asideWidth?: SplitAsideWidth;
  from?: SplitBreakpoint;
  phonePane?: SplitPhonePane;
  isAsideSticky?: boolean;
  // Names the side pane for screen readers when it is its own region.
  asideLabel?: string;
}>();
</script>

<template>
  <div
    :class="[
      $style.split,
      from === 'lg' ? $style.fromLg : $style.fromMd,
      aside === 'start' ? $style.asideStart : $style.asideEnd,
      asideWidth === 'picker' ? $style.picker : $style.list,
      phonePane === 'main' && $style.phoneMain,
      phonePane === 'aside' && $style.phoneAside,
      isAsideSticky && $style.sticky,
    ]"
  >
    <div :class="$style.main">
      <slot />
    </div>
    <section v-if="$slots.aside" :class="$style.aside" :aria-label="asideLabel">
      <slot name="aside" />
    </section>
  </div>
</template>

<style module>
.split {
  --split-aside-width: var(--pane-list-width);

  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.picker {
  --split-aside-width: var(--pane-picker-width);
}

.main,
.aside {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

/* A pane that scrolls on its own must not squeeze its sections (the chip rows, a scroll container of their own). */
.aside > * {
  flex: none;
}

/* The side pane of a start split comes first on phones too, as the list a recipe is opened from does. */
.asideStart .aside {
  order: -1;
}

@media (max-width: 959.98px) {
  .phoneMain .aside,
  .phoneAside .main {
    display: none;
  }
}

@media (min-width: 960px) {
  .fromMd {
    display: grid;
    align-items: start;
  }

  .fromMd.asideStart {
    grid-template-columns: var(--split-aside-width) minmax(0, 1fr);
  }

  .fromMd.asideEnd {
    grid-template-columns: minmax(0, 1fr) var(--split-aside-width);
  }

  .fromMd.sticky .aside {
    position: sticky;
    top: var(--space-3);
    max-height: calc(100dvh - 2 * var(--space-3));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

/* Between md and lg a split from lg is still one column, showing what a phone shows. */
@media (min-width: 960px) and (max-width: 1279.98px) {
  .fromLg.phoneMain .aside,
  .fromLg.phoneAside .main {
    display: none;
  }
}

@media (min-width: 1280px) {
  .fromLg {
    display: grid;
    align-items: start;
  }

  .fromLg.asideStart {
    grid-template-columns: var(--split-aside-width) minmax(0, 1fr);
  }

  .fromLg.asideEnd {
    grid-template-columns: minmax(0, 1fr) var(--split-aside-width);
  }

  .fromLg.sticky .aside {
    position: sticky;
    top: var(--space-3);
    max-height: calc(100dvh - 2 * var(--space-3));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}
</style>

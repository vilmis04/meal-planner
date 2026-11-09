<script setup lang="ts">
// One collapsible group of the shopping list (G3): a header button with the group's name and count, and its lines.
// The count is given as text, so G5 can show "3 of 7" in the same place; countDescription is what a screen reader
// hears for it ("7 items").
defineProps<{
  title: string;
  countLabel: string;
  countDescription: string;
  hint?: string;
}>();

const isExpanded = defineModel<boolean>("expanded", { required: true });

const contentId = useId();
</script>

<template>
  <section :class="$style.group">
    <h2 :class="$style.heading">
      <button
        type="button"
        :class="$style.header"
        :aria-expanded="isExpanded"
        :aria-controls="contentId"
        data-testid="shopping-group-toggle"
        @click="isExpanded = !isExpanded"
      >
        <span :class="$style.title">{{ title }}</span>
        <span :class="$style.count" aria-hidden="true" data-testid="shopping-group-count">{{ countLabel }}</span>
        <span :class="$style.visuallyHidden">{{ countDescription }}</span>
        <v-icon
          icon="mdi-chevron-down"
          size="20"
          :class="[$style.chevron, { [$style.chevronExpanded]: isExpanded }]"
          aria-hidden="true"
        />
      </button>
    </h2>
    <div v-show="isExpanded" :id="contentId" data-testid="shopping-group-items">
      <p v-if="hint" :class="$style.hint">{{ hint }}</p>
      <slot />
    </div>
  </section>
</template>

<style module>
.group {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.heading {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.header:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: var(--radius-lg);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.count {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.chevron {
  flex: 0 0 auto;
  color: var(--color-muted);
  transition: transform 0.15s ease;
}

.chevronExpanded {
  transform: rotate(180deg);
}

.hint {
  margin: 0;
  padding: 0 14px 8px;
  font-size: 13px;
  color: var(--color-muted);
}

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>

<script setup lang="ts">
import type { ShownTip } from "~/types/tip.types";

// One tip (X3): a lightbulb and the text, with what it is about on a recipe ("About avocado"). A soft amber band, so
// it reads as an aside and not as part of the recipe or the list.
const { tip, isIconShown = true } = defineProps<{ tip: ShownTip; isIconShown?: boolean }>();

const { t } = useI18n();
</script>

<template>
  <div :class="$style.note" data-testid="tip-note" :data-tip-id="tip.id">
    <v-icon v-if="isIconShown" icon="mdi-lightbulb-on-outline" size="18" :class="$style.icon" aria-hidden="true" />
    <p :class="$style.body">
      <span v-if="tip.about.length > 0" :class="$style.about" data-testid="tip-about">
        {{ t("tips.about", { names: tip.about.join(", ") }) }}
      </span>
      <span data-testid="tip-text">{{ tip.text }}</span>
    </p>
  </div>
</template>

<style module>
.note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
  color: var(--color-on-surface);
}

.icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--color-secondary);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.about {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-muted);
}
</style>

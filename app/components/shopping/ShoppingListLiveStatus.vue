<script setup lang="ts">
import type { ShoppingListLiveStatus } from "~/types/shoppingList.types";

// Whether other members' changes show on this list as they happen (G6). Nothing shows until the first subscription,
// so a page without Realtime does not claim to be live; "Reconnecting…" means changes show once it is back.
const props = defineProps<{ status: ShoppingListLiveStatus }>();

const { t } = useI18n();
const label = computed(() => (props.status === "live" ? t("shoppingList.live.on") : t("shoppingList.live.paused")));
const description = computed(() =>
  props.status === "live" ? t("shoppingList.live.onDescription") : t("shoppingList.live.pausedDescription"),
);
</script>

<template>
  <span role="status" :class="$style.status" data-testid="shopping-list-live">
    <template v-if="status !== 'connecting'">
      <span :class="[$style.dot, status === 'live' ? $style.live : $style.paused]" aria-hidden="true" />
      <span :title="description" :data-status="status" data-testid="shopping-list-live-label">{{ label }}</span>
      <span :class="$style.hidden">{{ description }}</span>
    </template>
  </span>
</template>

<style module>
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.live {
  background: var(--color-primary);
}

.paused {
  border: 2px solid var(--color-muted);
}

.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

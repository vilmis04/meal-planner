<script setup lang="ts">
import type { ShoppingItem } from "#shared/utils/shoppingList.types";

const props = defineProps<{
  items: readonly ShoppingItem[];
  // User id → name, for "Swap for Monika".
  participantNames: ReadonlyMap<string, string>;
}>();

const { t, locale } = useI18n();

// Amounts are stored in base units (g, ml) and read in the larger one from 1000 (1.5 kg); units are free text from the
// recipes (vnt., skardinė) and shown as stored. Extras have no amount.
const amountLabel = (item: ShoppingItem): string | null => {
  if (item.amount === null || item.unit === null) {
    return null;
  }
  const quantity = toDisplayQuantity({ amount: item.amount, unit: item.unit });
  return `${formatAmount(quantity.amount, locale.value)} ${quantity.unit}`;
};

const swapLabel = (item: ShoppingItem): string | null => {
  const names = item.swappedFor.flatMap((userId) => {
    const name = props.participantNames.get(userId);
    return name === undefined ? [] : [name];
  });
  return names.length === 0 ? null : t("shoppingList.swapFor", { names: names.join(", ") });
};
</script>

<template>
  <ul :class="$style.list">
    <li v-for="item in items" :key="item.id" :class="$style.row" data-testid="shopping-item">
      <span :class="$style.text">
        <span :class="$style.name">{{ item.name }}</span>
        <span v-if="swapLabel(item)" :class="$style.note" data-testid="shopping-item-swap">{{ swapLabel(item) }}</span>
      </span>
      <span v-if="amountLabel(item)" :class="$style.amount" data-testid="shopping-item-amount">{{ amountLabel(item) }}</span>
    </li>
  </ul>
</template>

<style module>
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 48px;
  padding: 10px var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: none;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  overflow-wrap: anywhere;
}

.note {
  font-size: 13px;
  color: var(--color-muted);
}

.amount {
  flex: 0 0 auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>

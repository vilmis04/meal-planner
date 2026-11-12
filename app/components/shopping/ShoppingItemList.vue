<script setup lang="ts">
import type { ShoppingItem } from "#shared/utils/shoppingList.types";
import type { ShoppingItemShopHint } from "~/types/shoppingList.types";

const props = defineProps<{
  items: readonly ShoppingItem[];
  // User id → name, for "Swap for Monika" and "Added by Monika".
  participantNames: ReadonlyMap<string, string>;
  currentUserId: string | null;
  // Shop id → name, for "Bought at Lidl" (G7).
  shopNames: ReadonlyMap<string, string>;
  // Line id → where its item is usually or was last bought (I1a); empty while the viewer hides the hints.
  shopHints: ReadonlyMap<string, ShoppingItemShopHint>;
}>();

// Tapping a line ticks it bought or back (G5); the rest are in the line's actions menu (G4). Lines at home are not
// ticked: they are not being bought.
const emit = defineEmits<{
  toggleBought: [item: ShoppingItem];
  toggleAtHome: [item: ShoppingItem];
  editAmount: [item: ShoppingItem];
  chooseShop: [item: ShoppingItem];
  remove: [item: ShoppingItem];
}>();

const { t } = useI18n();
const { formatQuantity } = useAmountFormat();

// Extras have no amount; a changed amount reads instead of the plan's.
const amountLabel = (item: ShoppingItem): string | null => {
  const amount = getShoppingItemAmount(item);
  if (amount === null || item.unit === null) {
    return null;
  }
  return formatQuantity(amount, item.unit);
};

const planAmountLabel = (item: ShoppingItem): string | null => {
  const planAmount = getPlanAmount(item);
  if (planAmount === null || item.unit === null) {
    return null;
  }
  return t("shoppingList.item.planAmount", { amount: formatQuantity(planAmount, item.unit) });
};

const swapLabel = (item: ShoppingItem): string | null => {
  const names = item.swappedFor.flatMap((userId) => {
    const name = props.participantNames.get(userId);
    return name === undefined ? [] : [name];
  });
  return names.length === 0 ? null : t("shoppingList.swapFor", { names: names.join(", ") });
};

// A line to buy is a checkbox the size of the line, so the whole line is the tap target and a screen reader hears
// "checked" for a bought line, not only the strike-through.
const getLineAttributes = (item: ShoppingItem) =>
  item.state === "have_at_home"
    ? {}
    : { type: "button", role: "checkbox", "aria-checked": String(item.state === "bought"), "data-testid": "shopping-item-toggle" };

const handleLineClick = (item: ShoppingItem): void => {
  if (item.state !== "have_at_home") {
    emit("toggleBought", item);
  }
};

// "Bought at Lidl" on a bought line (G7); nothing when no shop was recorded or its name is not known here.
const shopLabel = (item: ShoppingItem): string | null => {
  const shopName = item.state === "bought" && item.shopId !== null ? props.shopNames.get(item.shopId) : undefined;
  return shopName === undefined ? null : t("shoppingList.shop.boughtAt", { shop: shopName });
};

// "Usually bought at Lidl" or "Last bought at Lidl" on a line still to buy (I1a). Only a note: tapping the line ticks it
// as always. Bought lines say where they were bought instead.
const shopHintLabel = (item: ShoppingItem): string | null => {
  const hint = item.state === "to_buy" ? props.shopHints.get(item.id) : undefined;
  if (hint === undefined) {
    return null;
  }
  return hint.kind === "usually"
    ? t("shoppingList.shopHints.usually", { shop: hint.shopName })
    : t("shoppingList.shopHints.last", { shop: hint.shopName });
};

// "Needs 200 g more" on a bought line whose amount went up after it was ticked (G7).
const shortfallLabel = (item: ShoppingItem): string | null => {
  const shortfall = getBoughtShortfall(item);
  if (shortfall === null || item.unit === null) {
    return null;
  }
  return t("shoppingList.shop.shortfall", { amount: formatQuantity(shortfall, item.unit) });
};

// "Added by Monika" on manual lines; nothing when that person is no longer known here.
const addedByLabel = (item: ShoppingItem): string | null => {
  if (item.source !== "manual" || item.addedBy === null) {
    return null;
  }
  if (item.addedBy === props.currentUserId) {
    return t("shoppingList.item.addedByYou");
  }
  const name = props.participantNames.get(item.addedBy);
  return name === undefined ? null : t("shoppingList.item.addedBy", { name });
};
</script>

<template>
  <ul :class="$style.list">
    <li
      v-for="item in items"
      :key="item.id"
      :class="[$style.row, { [$style.atHome]: item.state === 'have_at_home' }]"
      data-testid="shopping-item"
      :data-item-id="item.id"
      :data-state="item.state"
    >
      <component
        :is="item.state === 'have_at_home' ? 'div' : 'button'"
        v-bind="getLineAttributes(item)"
        :class="[$style.line, { [$style.bought]: item.state === 'bought' }]"
        @click="handleLineClick(item)"
      >
        <span v-if="item.state !== 'have_at_home'" :class="$style.box" aria-hidden="true">
          <v-icon v-if="item.state === 'bought'" icon="mdi-check-bold" size="18" />
        </span>
        <span :class="$style.text">
          <span :class="$style.name" data-testid="shopping-item-name">{{ item.name }}</span>
          <span v-if="swapLabel(item)" :class="$style.swap" data-testid="shopping-item-swap">{{ swapLabel(item) }}</span>
          <span v-if="addedByLabel(item)" :class="$style.note" data-testid="shopping-item-added-by">
            {{ addedByLabel(item) }}
          </span>
          <span v-if="planAmountLabel(item)" :class="$style.note" data-testid="shopping-item-plan-amount">
            {{ planAmountLabel(item) }}
          </span>
          <span v-if="shopHintLabel(item)" :class="$style.note" data-testid="shopping-item-shop-hint">
            {{ shopHintLabel(item) }}
          </span>
          <span v-if="shopLabel(item)" :class="$style.note" data-testid="shopping-item-shop">
            <v-icon icon="mdi-storefront-outline" size="14" aria-hidden="true" />
            {{ shopLabel(item) }}
          </span>
          <span v-if="shortfallLabel(item)" :class="$style.shortfall" data-testid="shopping-item-shortfall">
            <v-icon icon="mdi-alert-circle-outline" size="14" aria-hidden="true" />
            {{ shortfallLabel(item) }}
          </span>
        </span>
        <span v-if="amountLabel(item)" :class="$style.amount" data-testid="shopping-item-amount">
          {{ amountLabel(item) }}
        </span>
      </component>
      <v-menu location="bottom end">
        <template #activator="{ props: activatorProps }">
          <v-btn
            v-bind="activatorProps"
            icon="mdi-dots-vertical"
            variant="text"
            color="muted"
            size="small"
            :class="$style.trigger"
            :aria-label="t('shoppingList.item.actions', { name: item.name })"
            data-testid="shopping-item-actions"
          />
        </template>
        <v-list density="comfortable">
          <v-list-item
            v-if="item.state === 'have_at_home'"
            prepend-icon="mdi-cart-arrow-down"
            :title="t('shoppingList.item.backToList')"
            data-testid="shopping-item-back-to-list"
            @click="$emit('toggleAtHome', item)"
          />
          <v-list-item
            v-else
            prepend-icon="mdi-home-outline"
            :title="t('shoppingList.item.haveAtHome')"
            data-testid="shopping-item-have-at-home"
            @click="$emit('toggleAtHome', item)"
          />
          <v-list-item
            v-if="item.state === 'bought'"
            prepend-icon="mdi-storefront-outline"
            :title="item.shopId === null ? t('shoppingList.shop.add') : t('shoppingList.shop.change')"
            data-testid="shopping-item-choose-shop"
            @click="$emit('chooseShop', item)"
          />
          <v-list-item
            v-if="isAmountEditable(item)"
            prepend-icon="mdi-pencil-outline"
            :title="t('shoppingList.item.changeAmount')"
            data-testid="shopping-item-change-amount"
            @click="$emit('editAmount', item)"
          />
          <v-list-item
            prepend-icon="mdi-delete-outline"
            base-color="error"
            :title="t('shoppingList.item.remove')"
            data-testid="shopping-item-remove"
            @click="$emit('remove', item)"
          />
        </v-list>
      </v-menu>
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
  gap: var(--space-1);
  min-height: 48px;
  padding: 2px 4px 2px 0;
  border-top: 1px solid var(--color-border);
}

.atHome {
  color: var(--color-muted);
}

/* The line itself: a checkbox button for lines to buy, at least 44 px tall and as wide as the line. */
.line {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 44px;
  padding: 0 4px 0 14px;
  border: none;
  border-radius: var(--radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.line {
  cursor: pointer;
}

button.line:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* The tick box, as in the shopping list design: an outlined square, filled with a check once bought. */
.box {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-muted);
  border-radius: 6px;
}

.bought {
  color: var(--color-muted);
}

.bought .box {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: rgb(var(--v-theme-on-primary));
}

.bought .name,
.bought .amount {
  text-decoration: line-through;
}

.bought .amount {
  font-weight: 400;
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 0;
}

.name {
  overflow-wrap: anywhere;
}

.swap,
.note {
  font-size: 13px;
  color: var(--color-muted);
}

/* Not struck through or muted like the rest of a bought line: it says what is still to buy. */
.shortfall {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-warning);
}

.amount {
  flex: 0 0 auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* A touch target of at least 44 px. */
.trigger {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}
</style>

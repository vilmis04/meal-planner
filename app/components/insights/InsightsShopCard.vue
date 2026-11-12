<script setup lang="ts">
import type { ShopInsightsView } from "~/types/shopInsights.types";

// One shop on the shop insights page (I1): its share of the lines bought at a shop, how many lines and different items
// were bought there, and the items bought there most often.
const props = defineProps<{ shop: ShopInsightsView["shops"][number] }>();

const { t } = useI18n();
// An item is named as its ingredient's Lithuanian name (or a manual line's own); shown in the viewer's language (X1b).
const { getIngredientNameBySourceName } = useIngredientNames();

const headingId = computed(() => `insights-shop-${props.shop.id}`);
</script>

<template>
  <v-card variant="flat" border :class="$style.card" :aria-labelledby="headingId" tag="section" data-testid="insights-shop">
    <div :class="$style.header">
      <v-icon icon="mdi-storefront-outline" size="22" :class="$style.icon" aria-hidden="true" />
      <h2 :id="headingId" :class="$style.name" data-testid="insights-shop-name">{{ shop.name }}</h2>
      <span :class="$style.share" data-testid="insights-shop-share">{{ t("insights.shops.share", { percent: shop.sharePercent }) }}</span>
    </div>
    <v-progress-linear
      :model-value="shop.sharePercent"
      color="primary"
      bg-color="border"
      bg-opacity="1"
      height="6"
      rounded
      :aria-label="t('insights.shops.shareLabel', { shop: shop.name, percent: shop.sharePercent })"
    />
    <p :class="$style.counts" data-testid="insights-shop-counts">
      {{ t("insights.shops.purchaseCount", { count: shop.purchaseCount }, shop.purchaseCount) }} ·
      {{ t("insights.shops.itemCount", { count: shop.itemCount }, shop.itemCount) }}
    </p>
    <h3 :class="$style.listTitle">{{ t("insights.shops.topItems") }}</h3>
    <ol :class="$style.list" data-testid="insights-shop-items">
      <li v-for="item in shop.topItems" :key="item.name" :class="$style.item">
        <span :class="$style.itemName">{{ getIngredientNameBySourceName(item.name) }}</span>
        <span :class="$style.itemCount">{{ t("insights.shops.timesBought", { count: item.purchaseCount }, item.purchaseCount) }}</span>
      </li>
    </ol>
  </v-card>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 17px;
  font-weight: 700;
}

.share {
  flex: 0 0 auto;
  font-weight: 600;
}

.counts {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.listTitle {
  margin: var(--space-1) 0 0;
  font-size: 14px;
  font-weight: 600;
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: 6px;
  border-bottom: 1px solid var(--color-border);
}

.item:last-child {
  border-bottom: 0;
}

.itemName {
  min-width: 0;
  overflow-wrap: anywhere;
}

.itemCount {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: 14px;
}
</style>

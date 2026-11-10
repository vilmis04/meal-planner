<script setup lang="ts">
import type { ShopInsightRange } from "~/types/shopInsights.types";

defineOptions({ name: "ShopInsightsPage" });

// Shop insights (I1): where the viewer's household bought things over a range, from the shops recorded when lines
// were ticked bought (G7). Purchases without a shop are left out and only counted.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { load } = useShopInsights();
const { household, load: loadHousehold } = useHousehold();

useHead({ title: () => t("insights.shops.pageTitle") });

// The range lives in the address (?range=all_time), so reload and the back button keep it.
const range = computed<ShopInsightRange>({
  get: () => parseShopInsightRange(route.query.range),
  set: (picked) => {
    router.replace({ query: picked === DEFAULT_SHOP_INSIGHT_RANGE ? {} : { range: picked } });
  },
});

const [{ data: result, status }] = await Promise.all([
  useAsyncData("shop-insights", () => load(range.value), { watch: [range] }),
  callOnce("household", loadHousehold, { mode: "navigation" }),
]);

const view = computed(() => (result.value?.status === "loaded" ? getShopInsightsView(result.value.insights) : null));
</script>

<template>
  <div :class="$style.page">
    <header :class="$style.header">
      <h1 :class="$style.title">{{ t("insights.shops.title") }}</h1>
      <p :class="$style.intro">{{ household ? t("insights.shops.intro.household") : t("insights.shops.intro.individual") }}</p>
    </header>

    <InsightsRangePicker v-model="range" />

    <v-alert v-if="result?.status === 'failed'" type="error" variant="tonal" data-testid="insights-load-failed">
      {{ t("insights.shops.loadFailed") }}
    </v-alert>
    <div v-else-if="view" :class="[$style.results, status === 'pending' && $style.pending]" :aria-busy="status === 'pending'">
      <p v-if="view.shops.length > 0" :class="$style.summary" data-testid="insights-summary">
        {{
          t(
            "insights.shops.summary",
            {
              purchases: t("insights.shops.purchaseCount", { count: view.purchaseCount }, view.purchaseCount),
              shops: t("insights.shops.shopCount", { count: view.shops.length }, view.shops.length),
            },
          )
        }}
      </p>
      <v-card v-else variant="flat" border :class="$style.empty" data-testid="insights-empty">
        <span :class="$style.emptyTitle">{{ t("insights.shops.empty.title") }}</span>
        <span :class="$style.hint">{{ t("insights.shops.empty.hint") }}</span>
        <v-btn to="/list" variant="tonal" color="primary" size="large" :class="$style.action">
          {{ t("insights.shops.empty.action") }}
        </v-btn>
      </v-card>

      <InsightsShopCard v-for="shop in view.shops" :key="shop.id" :shop="shop" />

      <p v-if="view.withoutShopCount > 0" :class="$style.hint" data-testid="insights-without-shop">
        {{ t("insights.shops.withoutShop", { count: view.withoutShopCount }, view.withoutShopCount) }}
      </p>
    </div>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.intro {
  margin: 0;
  color: var(--color-muted);
}

.results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: opacity 0.2s;
}

/* The previous range stays on screen, dimmed, while the next one loads. */
.pending {
  opacity: 0.6;
}

.summary {
  margin: 0;
  font-weight: 600;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.emptyTitle {
  font-weight: 600;
}

.hint {
  margin: 0;
  color: var(--color-muted);
}

.action {
  align-self: flex-start;
  text-transform: none;
}
</style>

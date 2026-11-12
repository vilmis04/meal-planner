<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { recipes, loadFailed: recipesLoadFailed } = useRecipes();
const { ratings, isLoaded, loadFailed: ratingsLoadFailed } = useRecipeRatings();

const tabsBox = ref<HTMLElement | null>(null);

// The tab lives in the address (?rating=hate), so reload and the back button keep it.
const tab = computed(() => parseRatingTab(route.query.rating));

// Both lists must be known: otherwise "nothing rated" would be shown for ratings that did not load.
const isReady = computed(() => isLoaded.value && recipes.value !== null);
const hasFailed = computed(() => ratingsLoadFailed.value || recipesLoadFailed.value);

// The recipes arrive sorted by name, and each group keeps that order.
const groups = computed(() => groupRecipesByRating(recipes.value ?? [], ratings.value ?? {}));
const total = computed(() => RECIPE_RATINGS.reduce((sum, rating) => sum + groups.value[rating].length, 0));
const visibleRecipes = computed(() => groups.value[tab.value]);

const tabItems = computed(() =>
  RECIPE_RATINGS.map((rating) => ({
    rating,
    label: t(`recipes.rating.options.${rating}`),
    count: groups.value[rating].length,
  })),
);

function changeTab(next: unknown) {
  const rating = parseRatingTab(next);
  return router.replace({ query: rating === DEFAULT_RATING_TAB ? {} : { rating } });
}

// A rating picked in a row moves the row to another tab, or removes it. The menu goes with it, so keyboard focus
// would fall to the page; it is put on the selected tab instead.
async function handleRowChange() {
  await nextTick();
  // The closing menu hands focus back to its button, which is gone by now; wait for that so it does not win.
  setTimeout(() => tabsBox.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(), 0);
}
</script>

<template>
  <section :class="$style.section" data-testid="meal-ratings">
    <h2 :class="$style.title">{{ t("profile.preferences.ratings.title") }}</h2>

    <v-alert v-if="hasFailed" type="warning" variant="tonal" density="compact" data-testid="meal-ratings-load-failed">
      {{ t("profile.preferences.ratings.loadFailed") }}
    </v-alert>
    <template v-else-if="isReady">
      <div v-if="total === 0" :class="$style.none" data-testid="meal-ratings-none">
        <p :class="$style.message">{{ t("profile.preferences.ratings.none") }}</p>
        <v-btn to="/recipes" variant="tonal" color="primary" size="large">
          {{ t("profile.preferences.ratings.browse") }}
        </v-btn>
      </div>
      <template v-else>
        <div ref="tabsBox">
          <v-tabs
            :model-value="tab"
            :aria-label="t('profile.preferences.ratings.tabs')"
            color="primary"
            align-tabs="center"
            grow
            :class="$style.tabs"
            @update:model-value="changeTab"
          >
            <v-tab
              v-for="item in tabItems"
              :key="item.rating"
              :value="item.rating"
              :class="$style.tab"
              :data-testid="`meal-ratings-tab-${item.rating}`"
            >
              {{ item.label }} · {{ item.count }}
            </v-tab>
          </v-tabs>
        </div>

        <p v-if="visibleRecipes.length === 0" :class="$style.message" data-testid="meal-ratings-empty">
          {{ t("profile.preferences.ratings.empty") }}
        </p>
        <ul v-else :class="$style.list" :aria-label="t('profile.preferences.ratings.list')" data-testid="meal-ratings-list">
          <li v-for="recipe in visibleRecipes" :key="recipe.id" :class="$style.row" data-testid="meal-ratings-row">
            <v-icon
              :icon="RECIPE_RATING_DISPLAY[tab].icon"
              :color="RECIPE_RATING_DISPLAY[tab].color"
              size="20"
              aria-hidden="true"
            />
            <div :class="$style.body">
              <NuxtLink :to="`/recipes/${recipe.id}`" :class="$style.name">{{ recipe.name }}</NuxtLink>
              <span :class="$style.meta">{{ t(`recipes.mealType.${recipe.mealType}`) }}</span>
            </div>
            <RecipeRatingMenu
              :recipe-id="recipe.id"
              :recipe-name="recipe.name"
              trigger="more"
              @change="handleRowChange"
            />
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: 17px;
  font-weight: 700;
}

.tabs {
  border-bottom: 1px solid var(--color-border);
}

.tab {
  min-width: 0;
  height: var(--touch-target);
  padding-inline: var(--space-1);
  font-size: 14px;
  letter-spacing: normal;
  text-transform: none;
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 56px;
  padding: var(--space-1) var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: none;
}

.body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.name {
  color: inherit;
  font-size: 15px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
}

.name:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.meta {
  color: var(--color-muted);
  font-size: 12px;
}

.message {
  margin: 0;
  padding: var(--space-3) var(--space-2);
  color: var(--color-muted);
  text-align: center;
}

.none {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
</style>

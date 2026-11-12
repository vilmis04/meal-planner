<script setup lang="ts">
import type { InsightRange } from "~/types/insightRange.types";
import type { InsightMealRow } from "~/types/preferenceInsights.types";

defineOptions({ name: "PreferenceInsightsPage" });

// Preference insights (I2): the viewer's enjoy-rated recipes by how often they are on the plans they eat from, and the
// meals most often skipped (swapped, replaced or cleared) on those plans, over a range.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { load } = usePreferenceInsights();
const { ratings, isLoaded: isRatingLoaded, load: loadRatings } = useRecipeRatings();
// The insights name each meal as stored (Lithuanian); the library names it in the viewer's language (X1b).
const { recipes, loadList: loadRecipes } = useRecipes();

useHead({ title: () => t("insights.meals.pageTitle") });

// The range lives in the address (?range=all_time), so reload and the back button keep it.
const range = computed<InsightRange>({
  get: () => parseInsightRange(route.query.range),
  set: (picked) => {
    router.replace({ query: picked === DEFAULT_INSIGHT_RANGE ? {} : { range: picked } });
  },
});

// The ratings are loaded once and kept, as on Food preferences; without them the rows have no rating menu.
const [{ data: result, status }] = await Promise.all([
  useAsyncData("preference-insights", () => load(range.value), { watch: [range] }),
  isRatingLoaded.value ? undefined : loadRatings(),
  recipes.value ? undefined : loadRecipes(),
]);

const recipeNames = computed(() => new Map((recipes.value ?? []).map((recipe) => [recipe.id, recipe.name])));
const getMealName = (meal: { id: string; name: string }): string => recipeNames.value.get(meal.id) ?? meal.name;

const insights = computed(() => (result.value?.status === "loaded" ? result.value.insights : null));

const likedRows = computed((): InsightMealRow[] =>
  getStillLikedMeals(insights.value?.liked ?? [], ratings.value).map((meal) => ({
    ...meal,
    name: getMealName(meal),
    countText:
      meal.plannedCount === 0
        ? t("insights.meals.liked.notPlanned")
        : t("insights.meals.liked.planned", { count: meal.plannedCount }, meal.plannedCount),
  })),
);

const skippedRows = computed((): InsightMealRow[] =>
  (insights.value?.skipped ?? []).map((meal) => ({
    ...meal,
    name: getMealName(meal),
    countText: t("insights.meals.skipped.times", { count: meal.skipCount }, meal.skipCount),
  })),
);

// More enjoy ratings than the list shows: the link says how many there are.
const hiddenLikedCount = computed(() => (insights.value ? insights.value.likedCount - insights.value.liked.length : 0));
</script>

<template>
  <LayoutPage width="medium" is-compact>
    <header :class="$style.header">
      <h1 :class="$style.title">{{ t("insights.meals.title") }}</h1>
      <p :class="$style.intro">{{ t("insights.meals.intro") }}</p>
    </header>

    <InsightsRangePicker v-model="range" />

    <v-alert v-if="result?.status === 'failed'" type="error" variant="tonal" data-testid="insights-load-failed">
      {{ t("insights.meals.loadFailed") }}
    </v-alert>
    <div v-else-if="insights" :class="[$style.results, status === 'pending' && $style.pending]" :aria-busy="status === 'pending'">
      <InsightsMealCard
        kind="liked"
        icon="mdi-heart-outline"
        :heading="t('insights.meals.liked.title')"
        :description="t('insights.meals.liked.description')"
        :meals="likedRows"
        :empty-text="t('insights.meals.liked.empty')"
        :is-ratable="isRatingLoaded"
      >
        <template #footer>
          <v-btn
            v-if="insights.likedCount === 0"
            to="/recipes"
            variant="tonal"
            color="primary"
            size="large"
            :class="$style.action"
          >
            {{ t("insights.meals.liked.browse") }}
          </v-btn>
          <NuxtLink v-else to="/me/preferences" :class="$style.link" data-testid="insights-meals-all-ratings">
            {{
              hiddenLikedCount > 0
                ? t("insights.meals.liked.allEnjoyed", { count: insights.likedCount }, insights.likedCount)
                : t("insights.meals.liked.allRatings")
            }}
          </NuxtLink>
        </template>
      </InsightsMealCard>

      <InsightsMealCard
        kind="skipped"
        icon="mdi-swap-horizontal"
        :heading="t('insights.meals.skipped.title')"
        :description="t('insights.meals.skipped.description')"
        :meals="skippedRows"
        :empty-text="t('insights.meals.skipped.empty')"
        :is-ratable="isRatingLoaded"
      >
        <template #footer>
          <p v-if="insights.skipCount > 0" :class="$style.hint" data-testid="insights-meals-skip-count">
            {{ t("insights.meals.skipped.total", { count: insights.skipCount }, insights.skipCount) }}
          </p>
        </template>
      </InsightsMealCard>
    </div>
  </LayoutPage>
</template>

<style module>
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

/* Side by side from 960px, where there is room. */
@media (min-width: 960px) {
  .results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    align-items: start;
  }
}

/* The previous range stays on screen, dimmed, while the next one loads. */
.pending {
  opacity: 0.6;
}

.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--touch-target);
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.action {
  align-self: flex-start;
  text-transform: none;
}
</style>

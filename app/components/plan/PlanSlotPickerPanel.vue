<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HatedRecipes, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";
import type { Diet } from "#shared/utils/diet";
import type { BatchTarget, PlanMemberRef } from "#shared/utils/slotPicker";
import type { RecipeFilter } from "#shared/utils/slotPicker.types";

const props = defineProps<{
  // The slot being chosen for. Not called "slot": that is a reserved attribute in Vue templates.
  target: MealPlanSlot;
  slots: readonly MealPlanSlot[];
  // The plan's dates, by day index ("YYYY-MM-DD").
  planDays: readonly string[];
  // Who eats from the plan, for the header ("for Ana, Monika"); empty hides it.
  participantNames: readonly string[];
  recipes: DeepReadonly<RecipeSummary[]> | null;
  recipesFailed: boolean;
  // Null while loading or after a failed load (hatedFailed tells them apart).
  hated: HatedRecipes | null;
  hatedFailed: boolean;
  members: readonly PlanMemberRef[];
  viewerId: string | null;
  disabled?: boolean;
  // A swap (E5) is on its way.
  isSwapping?: boolean;
  // What the filters (E6) compare with. Null while unknown, which hides that filter.
  enjoyedRecipeIds: ReadonlySet<string> | null;
  participantDiets: readonly Diet[] | null;
  // Recipe id → the day it was last planned shortly before this plan.
  recentRecipes: ReadonlyMap<string, string> | null;
  // From 960px (X4): a tap selects a recipe and shows it in full beside the list, where it is then chosen.
  isWide?: boolean;
}>();

const emit = defineEmits<{
  choose: [recipeId: string, fillDays: number];
  clear: [];
  swap: [];
  close: [];
  retry: [];
}>();

const { t, locale } = useI18n();

const query = ref("");
// A batch recipe waiting for "only today" or "today and the next day".
const pendingRecipeId = ref<string | null>(null);

const weekday = (dayIndex: number): string => {
  const date = props.planDays[dayIndex];
  return date ? formatShortWeekday(date, locale.value) : "";
};

const header = computed(() => {
  const date = props.planDays[props.target.dayIndex] ?? "";
  const day = formatPlanDay(date, locale.value, { weekday: "short", day: "numeric", month: "short" });
  return props.participantNames.length
    ? t("plan.slot.headerFor", { day, names: formatNames(props.participantNames) })
    : day;
});

const formatNames = (items: readonly string[]): string => formatList(items, locale.value);

const total = computed(() => countSlotRecipes(props.recipes ?? [], props.target.mealType));

// Filter chips (E6). A filter whose data is unknown is not offered, and stops filtering if it was on.
const selectedFilters = ref<RecipeFilter[]>([]);
const availableFilters = computed(() =>
  RECIPE_FILTERS.filter((filter) => {
    if (filter === "enjoyed") {
      return props.enjoyedRecipeIds !== null;
    }
    if (filter === "fits_all_diets") {
      return Boolean(props.participantDiets?.length);
    }
    if (filter === "not_recent") {
      return props.recentRecipes !== null;
    }
    return true;
  }),
);
const activeFilters = computed(() => selectedFilters.value.filter((filter) => availableFilters.value.includes(filter)));
const filterContext = computed(() => ({
  enjoyedRecipeIds: props.enjoyedRecipeIds ?? new Set<string>(),
  participantDiets: props.participantDiets ?? [],
  recentRecipeIds: new Set(props.recentRecipes?.keys() ?? []),
}));

// The current choice stays on top whatever the filters say, so the user always sees what the slot holds.
const visibleRecipes = computed(() =>
  filterSlotRecipes(props.recipes ?? [], props.target.mealType, query.value, {
    currentRecipeId: props.target.recipeId,
    locale: locale.value,
  }).filter(
    (recipe) =>
      recipe.id === props.target.recipeId || matchesRecipeFilters(recipe, activeFilters.value, filterContext.value),
  ),
);

// "Planned 2 Nov · cooldown" on a recipe resting after a recent plan.
const getRecentLine = (recipeId: string): string | null => {
  const plannedOn = props.recentRecipes?.get(recipeId);
  return plannedOn
    ? t("plan.slot.recent", { date: formatPlanDay(plannedOn, locale.value, { day: "numeric", month: "short" }) })
    : null;
};

const batchTargetOf = (recipe: DeepReadonly<RecipeSummary>) => getBatchTarget(props.slots, props.target, recipe);

// "2 days · fills Wed" when the next day is in the plan, otherwise the plain batch chip.
const batchLabel = (recipe: DeepReadonly<RecipeSummary>): string | null => {
  if (recipe.portionDays < 2) {
    return null;
  }
  const target = batchTargetOf(recipe);
  const last = target.slots.at(-1);
  return last
    ? t("plan.slot.batchFills", { count: recipe.portionDays, day: weekday(last.dayIndex) })
    : t("recipes.batch.multi", { count: recipe.portionDays });
};

// "someone" only for exactly one person: Lithuanian also uses its "one" form for 21, 31 and so on.
const unnamedPeople = (count: number): string =>
  count === 1 ? t("plan.slot.hate.someone") : t("plan.slot.hate.people", { count }, count);

const hateLine = (recipeId: string): string | null => {
  if (!props.hated) {
    return null;
  }
  const warning = getHateWarning(recipeId, props.hated, props.members, props.viewerId);
  if (!warning) {
    return null;
  }
  const who = [
    ...(warning.includesViewer ? [t("plan.slot.hate.you")] : []),
    ...warning.names,
    ...(warning.unnamedCount ? [unnamedPeople(warning.unnamedCount)] : []),
  ];
  return t("plan.slot.hate.line", { who: formatNames(who) });
};

const emptyMessage = computed(() => {
  if (query.value) {
    return t("plan.slot.noMatch");
  }
  return activeFilters.value.length ? t("plan.slot.noFilterMatch") : t("plan.slot.noRecipes");
});

const pendingRecipe = computed(() => props.recipes?.find((recipe) => recipe.id === pendingRecipeId.value) ?? null);
const pendingTarget = computed(() => (pendingRecipe.value ? batchTargetOf(pendingRecipe.value) : null));
const recipeName = (recipeId: string | null): string =>
  props.recipes?.find((recipe) => recipe.id === recipeId)?.name ?? t("plan.slot.unknownRecipe");

// "Tue + Wed" for one more day, "Tue – Thu" for more.
const getSpanLabel = (target: BatchTarget<MealPlanSlot>): string => {
  const last = target.slots.at(-1);
  if (!last) {
    return "";
  }
  const first = weekday(props.target.dayIndex);
  return target.slots.length === 1
    ? t("plan.slot.offer.both", { first, last: weekday(last.dayIndex) })
    : t("plan.slot.offer.range", { first, last: weekday(last.dayIndex) });
};
const spanLabel = computed(() => (pendingTarget.value ? getSpanLabel(pendingTarget.value) : ""));

// The wide picker's selected recipe, shown beside the list: the slot's own recipe until another is tapped.
const previewRecipeId = ref<string | null>(props.target.recipeId);
const previewRecipe = computed(() => props.recipes?.find((recipe) => recipe.id === previewRecipeId.value) ?? null);
const previewTarget = computed(() => (previewRecipe.value ? batchTargetOf(previewRecipe.value) : null));
const getReplacesLine = (target: BatchTarget<MealPlanSlot>): string =>
  t("plan.slot.offer.replaces", {
    names: formatNames(target.replaced.map((replaced) => `${weekday(replaced.dayIndex)}: ${recipeName(replaced.recipeId)}`)),
  });
// "Use for Tue", or "Use for Tue + Wed" when the same batch already fills the next days and stays whole.
const previewUseLabel = computed(() => {
  const target = previewTarget.value;
  if (!target || target.fillDays <= 1) {
    return t("plan.slot.preview.use", { day: weekday(props.target.dayIndex) });
  }
  return t("plan.slot.preview.use", { day: getSpanLabel(target) });
});

function choosePreview(fillAll: boolean) {
  const recipe = previewRecipe.value;
  const target = previewTarget.value;
  if (!recipe || !target || props.disabled) {
    return;
  }
  emit("choose", recipe.id, fillAll ? target.fillDays : 1);
}

function select(recipe: DeepReadonly<RecipeSummary>) {
  if (props.isWide) {
    previewRecipeId.value = recipe.id;
    pendingRecipeId.value = null;
    return;
  }
  pick(recipe);
}

function pick(recipe: DeepReadonly<RecipeSummary>) {
  if (props.disabled) {
    return;
  }
  const target = batchTargetOf(recipe);
  if (target.isOffered) {
    pendingRecipeId.value = recipe.id;
    return;
  }
  // The same recipe already fills the next days: keep the batch whole.
  emit("choose", recipe.id, target.fillDays);
}

function confirmPending(fillAll: boolean) {
  const recipe = pendingRecipe.value;
  if (!recipe || !pendingTarget.value) {
    return;
  }
  emit("choose", recipe.id, fillAll ? pendingTarget.value.fillDays : 1);
}

const list = useTemplateRef<HTMLElement>("list");

// A new slot starts with an empty search and no pending batch. So does a swapped one, scrolled to the top, where
// its new recipe is shown as the current choice.
watch(
  () => [props.target.id, props.target.recipeId],
  () => {
    query.value = "";
    selectedFilters.value = [];
    pendingRecipeId.value = null;
    previewRecipeId.value = props.target.recipeId;
    list.value?.scrollTo({ top: 0 });
  },
);
</script>

<template>
  <div :class="[$style.panel, isWide && $style.wide]" data-testid="slot-picker">
    <div :class="$style.chooser">
    <header :class="$style.header">
      <div :class="$style.heading">
        <span :class="$style.context" data-testid="slot-picker-context">{{ header }}</span>
        <h2 :class="$style.title">{{ t(`plan.slot.title.${target.mealType}`) }}</h2>
      </div>
      <v-btn
        icon="mdi-close"
        variant="text"
        :aria-label="t('plan.slot.close')"
        data-testid="slot-picker-close"
        @click="emit('close')"
      />
    </header>

    <v-alert v-if="recipesFailed" type="error" variant="tonal" :class="$style.notice" data-testid="slot-picker-recipes-failed">
      {{ t("plan.slot.recipesFailed") }}
      <template #append>
        <v-btn variant="text" size="small" @click="emit('retry')">{{ t("plan.slot.retry") }}</v-btn>
      </template>
    </v-alert>

    <template v-else>
      <div :class="$style.search">
        <v-text-field
          id="slot-picker-search"
          v-model="query"
          :placeholder="t(`plan.slot.search.${target.mealType}`, { count: total }, total)"
          :aria-label="t(`plan.slot.search.${target.mealType}`, { count: total }, total)"
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat
          rounded="pill"
          density="comfortable"
          hide-details
          clearable
          autocomplete="off"
          data-testid="slot-picker-search"
        />
      </div>

      <v-chip-group
        v-model="selectedFilters"
        multiple
        column
        :aria-label="t('plan.slot.filters.label')"
        :class="$style.filters"
        data-testid="slot-picker-filters"
      >
        <v-chip
          v-for="filter in availableFilters"
          :key="filter"
          :value="filter"
          filter
          variant="outlined"
          size="small"
          :class="$style.filterChip"
          :data-testid="`slot-picker-filter-${filter}`"
        >
          {{ t(`plan.slot.filters.${filter}`) }}
        </v-chip>
      </v-chip-group>

      <p v-if="hatedFailed" :class="$style.hatedFailed" role="status" data-testid="slot-picker-hated-failed">
        <v-icon icon="mdi-information-outline" size="16" />
        {{ t("plan.slot.hate.loadFailed") }}
      </p>

      <ul v-if="visibleRecipes.length" ref="list" :class="$style.list" data-testid="slot-picker-list">
        <li v-for="recipe in visibleRecipes" :key="recipe.id">
          <button
            type="button"
            :class="[
              $style.row,
              {
                [$style.current]: recipe.id === target.recipeId,
                [$style.pending]: recipe.id === pendingRecipeId,
                [$style.previewed]: isWide && recipe.id === previewRecipeId,
              },
            ]"
            :disabled="disabled"
            :aria-pressed="isWide ? undefined : recipe.id === target.recipeId"
            :aria-current="isWide && recipe.id === previewRecipeId ? 'true' : undefined"
            :aria-controls="isWide ? 'slot-picker-preview' : undefined"
            data-testid="slot-picker-recipe"
            @click="select(recipe)"
          >
            <span :class="$style.tile" aria-hidden="true">
              <v-icon icon="mdi-silverware-fork-knife" size="20" />
            </span>
            <span :class="$style.body">
              <span :class="$style.name">{{ recipe.name }}</span>
              <span v-if="batchLabel(recipe)" :class="$style.tags">
                <v-chip size="x-small" label variant="tonal" color="primary" data-testid="slot-picker-batch">
                  {{ batchLabel(recipe) }}
                </v-chip>
              </span>
              <span v-if="hateLine(recipe.id)" :class="$style.hate" data-testid="slot-picker-hate">
                <v-icon icon="mdi-alert-outline" size="14" />
                {{ hateLine(recipe.id) }}
              </span>
              <span v-if="getRecentLine(recipe.id)" :class="$style.recent" data-testid="slot-picker-recent">
                <v-icon icon="mdi-history" size="14" />
                {{ getRecentLine(recipe.id) }}
              </span>
              <span v-if="recipe.id === target.recipeId" :class="$style.currentLabel">{{ t("plan.slot.current") }}</span>
            </span>
            <v-icon
              v-if="recipe.id === target.recipeId"
              icon="mdi-check-circle"
              color="primary"
              :class="$style.check"
              aria-hidden="true"
            />
            <v-icon
              v-else-if="isWide && recipe.id === previewRecipeId"
              icon="mdi-chevron-right"
              color="primary"
              :class="$style.check"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
      <p v-else-if="recipes" :class="$style.empty" data-testid="slot-picker-empty">
        {{ emptyMessage }}
      </p>
      <div v-else :class="$style.loading">
        <v-progress-circular indeterminate color="primary" size="28" />
      </div>
    </template>

    <footer
      v-if="pendingRecipe && pendingTarget"
      :class="$style.offer"
      role="group"
      :aria-label="t('plan.slot.offer.title', { count: pendingRecipe.portionDays })"
      data-testid="slot-picker-offer"
    >
      <div :class="$style.offerText">
        <strong>{{ t("plan.slot.offer.title", { count: pendingRecipe.portionDays }) }}</strong>
        <span>
          {{
            t("plan.slot.offer.text", {
              name: pendingRecipe.name,
              count: pendingRecipe.portionDays,
            })
          }}
        </span>
        <span v-if="pendingTarget.replaced.length" :class="$style.replaces" data-testid="slot-picker-offer-replaces">
          {{ getReplacesLine(pendingTarget) }}
        </span>
      </div>
      <div :class="$style.offerActions">
        <v-btn variant="outlined" size="large" :disabled="disabled" data-testid="slot-picker-offer-one" @click="confirmPending(false)">
          {{ t("plan.slot.offer.only", { day: weekday(target.dayIndex) }) }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-calendar-range"
          :disabled="disabled"
          :loading="disabled"
          data-testid="slot-picker-offer-all"
          @click="confirmPending(true)"
        >
          {{ spanLabel }}
        </v-btn>
      </div>
    </footer>
    <footer v-else-if="!recipesFailed" :class="$style.footer">
      <v-btn
        v-if="target.recipeId"
        variant="text"
        color="error"
        prepend-icon="mdi-close-circle-outline"
        size="large"
        :disabled="disabled"
        data-testid="slot-picker-clear"
        @click="emit('clear')"
      >
        {{ t("plan.slot.clear") }}
      </v-btn>
      <!-- A locked slot keeps its recipe; choosing one by hand above still works. -->
      <p v-if="target.isLocked" :class="$style.lockedHint" data-testid="slot-picker-locked">
        <v-icon icon="mdi-lock" size="16" aria-hidden="true" />
        {{ t("plan.swap.lockedHint") }}
      </p>
      <v-btn
        v-else
        variant="tonal"
        color="primary"
        prepend-icon="mdi-shuffle-variant"
        size="large"
        :disabled="disabled"
        :loading="isSwapping"
        :class="$style.swap"
        data-testid="slot-picker-swap"
        @click="emit('swap')"
      >
        {{ target.recipeId ? t("plan.swap.action") : t("plan.swap.suggest") }}
      </v-btn>
    </footer>
  </div>

    <PlanSlotRecipePreview v-if="isWide" :recipe-id="previewRecipeId">
      <template #actions>
        <span v-if="previewRecipeId === target.recipeId" :class="$style.previewCurrent" data-testid="slot-picker-preview-current">
          <v-icon icon="mdi-check-circle" color="primary" size="18" aria-hidden="true" />
          {{ t("plan.slot.current") }}
        </span>
        <template v-else-if="previewRecipe && previewTarget">
          <span v-if="previewTarget.isOffered && previewTarget.replaced.length" :class="$style.replaces" data-testid="slot-picker-preview-replaces">
            {{ getReplacesLine(previewTarget) }}
          </span>
          <template v-if="previewTarget.isOffered">
            <v-btn variant="outlined" size="large" :disabled="disabled" data-testid="slot-picker-preview-one" @click="choosePreview(false)">
              {{ t("plan.slot.offer.only", { day: weekday(target.dayIndex) }) }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="large"
              prepend-icon="mdi-calendar-range"
              :disabled="disabled"
              :loading="disabled"
              data-testid="slot-picker-preview-all"
              @click="choosePreview(true)"
            >
              {{ t("plan.slot.preview.use", { day: getSpanLabel(previewTarget) }) }}
            </v-btn>
          </template>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            size="large"
            prepend-icon="mdi-calendar-check"
            :disabled="disabled"
            :loading="disabled"
            data-testid="slot-picker-preview-use"
            @click="choosePreview(true)"
          >
            {{ previewUseLabel }}
          </v-btn>
        </template>
      </template>
    </PlanSlotRecipePreview>
  </div>
</template>

<style module>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  background: rgb(var(--v-theme-surface));
}

.chooser {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* Wide: the list on the left, the selected recipe beside it, as in the desktop design. */
.wide {
  display: grid;
  grid-template-columns: var(--pane-picker-width) minmax(0, 1fr);
  height: 100%;
}

.previewed {
  box-shadow: inset 0 0 0 2px rgba(var(--v-theme-primary), 0.5);
}

.previewCurrent {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch-target);
  margin-right: auto;
  color: var(--color-muted);
  font-size: 14px;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-2) var(--space-2) var(--space-3);
}

.heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.context {
  font-size: 13px;
  color: var(--color-muted);
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.notice {
  margin: 0 var(--space-3) var(--space-3);
}

.search {
  padding: 0 var(--space-3) var(--space-2);
}

/* Small chips, as tall as a touch target. */
.filterChip {
  min-height: var(--touch-target);
}

/* Kept whole above the scrolling list. */
.filters {
  flex: 0 0 auto;
  padding: 0 var(--space-3) var(--space-1);
}

.recent {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-muted);
}

.hatedFailed {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0 var(--space-3) var(--space-2);
  font-size: 12px;
  color: var(--color-muted);
}

.list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0 var(--space-2) var(--space-2);
  overflow-y: auto;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 64px;
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.row:hover,
.row:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.row:disabled {
  cursor: default;
  opacity: 0.6;
}

.current,
.pending {
  background: rgba(var(--v-theme-primary), 0.1);
}

.current:hover,
.pending:hover {
  background: rgba(var(--v-theme-primary), 0.14);
}

.tile {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: var(--color-muted);
}

.body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.hate {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-error));
}

.currentLabel {
  font-size: 12px;
  color: var(--color-muted);
}

.check {
  flex: 0 0 auto;
}

.empty {
  margin: 0;
  padding: var(--space-4) var(--space-3);
  color: var(--color-muted);
  text-align: center;
}

.loading {
  display: grid;
  place-items: center;
  padding: var(--space-5);
}

.offer,
.footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgb(var(--v-theme-border));
}

.footer {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-2);
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
}

.swap {
  margin-left: auto;
  text-transform: none;
}

.lockedHint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0 0 0 auto;
  font-size: 13px;
  color: var(--color-muted);
}

.offerText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}

.replaces {
  font-size: 13px;
  color: rgb(var(--v-theme-warning));
}

.offerActions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

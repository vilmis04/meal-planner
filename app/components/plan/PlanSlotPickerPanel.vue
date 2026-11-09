<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HatedRecipes, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";
import type { PlanMemberRef } from "#shared/utils/slotPicker";

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
}>();

const emit = defineEmits<{
  choose: [recipeId: string, fillDays: number];
  clear: [];
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
    ? t("plan.slot.headerFor", { day, names: formatList(props.participantNames) })
    : day;
});

const formatList = (items: readonly string[]): string =>
  new Intl.ListFormat(locale.value, { style: "long", type: "conjunction" }).format(items);

const total = computed(() => countSlotRecipes(props.recipes ?? [], props.target.mealType));
const visibleRecipes = computed(() =>
  filterSlotRecipes(props.recipes ?? [], props.target.mealType, query.value, {
    currentRecipeId: props.target.recipeId,
    locale: locale.value,
  }),
);

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
    ...(warning.unnamedCount ? [t("plan.slot.hate.someone", warning.unnamedCount)] : []),
  ];
  return t("plan.slot.hate.line", { who: formatList(who) });
};

const pendingRecipe = computed(() => props.recipes?.find((recipe) => recipe.id === pendingRecipeId.value) ?? null);
const pendingTarget = computed(() => (pendingRecipe.value ? batchTargetOf(pendingRecipe.value) : null));
const recipeName = (recipeId: string | null): string =>
  props.recipes?.find((recipe) => recipe.id === recipeId)?.name ?? t("plan.slot.unknownRecipe");

const spanLabel = computed(() => {
  const target = pendingTarget.value;
  const last = target?.slots.at(-1);
  if (!target || !last) {
    return "";
  }
  const first = weekday(props.target.dayIndex);
  return target.slots.length === 1
    ? t("plan.slot.offer.both", { first, last: weekday(last.dayIndex) })
    : t("plan.slot.offer.range", { first, last: weekday(last.dayIndex) });
});

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

// A new slot starts with an empty search and no pending batch.
watch(
  () => props.target.id,
  () => {
    query.value = "";
    pendingRecipeId.value = null;
  },
);
</script>

<template>
  <div :class="$style.panel" data-testid="slot-picker">
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

      <p v-if="hatedFailed" :class="$style.hatedFailed" role="status" data-testid="slot-picker-hated-failed">
        <v-icon icon="mdi-information-outline" size="16" />
        {{ t("plan.slot.hate.loadFailed") }}
      </p>

      <ul v-if="visibleRecipes.length" :class="$style.list" data-testid="slot-picker-list">
        <li v-for="recipe in visibleRecipes" :key="recipe.id">
          <button
            type="button"
            :class="[
              $style.row,
              { [$style.current]: recipe.id === target.recipeId, [$style.pending]: recipe.id === pendingRecipeId },
            ]"
            :disabled="disabled"
            :aria-pressed="recipe.id === target.recipeId"
            data-testid="slot-picker-recipe"
            @click="pick(recipe)"
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
              <span v-if="recipe.id === target.recipeId" :class="$style.currentLabel">{{ t("plan.slot.current") }}</span>
            </span>
            <v-icon
              v-if="recipe.id === target.recipeId"
              icon="mdi-check-circle"
              color="primary"
              :class="$style.check"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
      <p v-else-if="recipes" :class="$style.empty" data-testid="slot-picker-empty">
        {{ query ? t("plan.slot.noMatch") : t("plan.slot.noRecipes") }}
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
          {{
            t("plan.slot.offer.replaces", {
              names: formatList(pendingTarget.replaced.map((replaced) => `${weekday(replaced.dayIndex)}: ${recipeName(replaced.recipeId)}`)),
            })
          }}
        </span>
      </div>
      <div :class="$style.offerActions">
        <v-btn variant="outlined" :disabled="disabled" data-testid="slot-picker-offer-one" @click="confirmPending(false)">
          {{ t("plan.slot.offer.only", { day: weekday(target.dayIndex) }) }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
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
    <footer v-else-if="target.recipeId && !recipesFailed" :class="$style.footer">
      <v-btn
        variant="text"
        color="error"
        prepend-icon="mdi-close-circle-outline"
        :disabled="disabled"
        data-testid="slot-picker-clear"
        @click="emit('clear')"
      >
        {{ t("plan.slot.clear") }}
      </v-btn>
    </footer>
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
  align-items: flex-start;
  padding-top: var(--space-2);
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
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

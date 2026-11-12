<script setup lang="ts">
import type { Diet } from "#shared/utils/diet";
import type { RecipeSwapState } from "~/types/recipe.types";

const props = defineProps<{ diet: Diet; state: RecipeSwapState }>();
const showOriginal = defineModel<boolean>("showOriginal", { required: true });

const { t, locale } = useI18n();

// "Swapped for your diet (fish)": the diet's own label, lowercased to read as part of the sentence.
const dietLabel = computed(() => t(`profile.diet.options.${props.diet}.label`).toLocaleLowerCase(locale.value));
</script>

<template>
  <section
    v-if="state.status === 'ready'"
    :class="$style.card"
    :aria-label="t('recipes.swap.title', { diet: dietLabel })"
    data-testid="recipe-swap"
  >
    <div :class="$style.header">
      <v-icon icon="mdi-swap-horizontal-circle" :class="$style.icon" size="24" />
      <h3 :class="$style.title">{{ t("recipes.swap.title", { diet: dietLabel }) }}</h3>
      <v-btn
        :class="$style.toggle"
        variant="text"
        color="primary"
        size="small"
        data-testid="recipe-swap-toggle"
        @click="showOriginal = !showOriginal"
      >
        {{ showOriginal ? t("recipes.swap.showSwap") : t("recipes.swap.showOriginal") }}
      </v-btn>
    </div>

    <ul :class="$style.changes">
      <li v-for="item in state.swap.items" :key="item.position" :class="$style.change" data-testid="recipe-swap-item">
        <s :class="$style.original">{{ item.original.item }}</s>
        <v-icon icon="mdi-arrow-right" size="16" :class="$style.arrow" aria-hidden="true" />
        <span :class="$style.replacement">
          {{ keepsAmount(item) ? t("recipes.swap.sameAmount", { item: item.item }) : item.item }}
        </span>
      </li>
    </ul>

    <p v-if="state.swap.note" :class="$style.note" data-testid="recipe-swap-note">{{ state.swap.note }}</p>
  </section>

  <section v-else-if="state.status === 'loading'" :class="$style.card" aria-busy="true" data-testid="recipe-swap-loading">
    <div :class="$style.header">
      <v-icon icon="mdi-swap-horizontal-circle" :class="$style.icon" size="24" />
      <p :class="$style.message">{{ t("recipes.swap.loading", { diet: dietLabel }) }}</p>
    </div>
    <v-progress-linear indeterminate rounded color="primary" :class="$style.progress" />
  </section>

  <section v-else-if="state.status === 'unavailable'" :class="$style.card" data-testid="recipe-swap-unavailable">
    <div :class="$style.header">
      <v-icon icon="mdi-information-outline" :class="$style.mutedIcon" size="24" />
      <p :class="[$style.message, $style.muted]">{{ t("recipes.swap.unavailable", { diet: dietLabel }) }}</p>
    </div>
  </section>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  flex: none;
  color: var(--color-primary);
}

.mutedIcon {
  flex: none;
  color: var(--color-muted);
}

.title,
.message {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.muted {
  color: var(--color-muted);
  font-weight: 400;
}

/* A text link in the design, with a full 44px tap target that doesn't push the card taller. */
.toggle {
  flex: none;
  height: 44px !important;
  margin-block: -10px;
  margin-inline-end: -8px;
  padding-inline: var(--space-2) !important;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
}

.changes {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0 0 0 34px;
  list-style: none;
}

.change {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--space-2);
  font-size: 14px;
}

.original {
  color: var(--color-muted);
}

.arrow {
  color: var(--color-muted);
}

.replacement {
  font-weight: 600;
}

.note {
  margin: 0;
  padding-inline-start: 34px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.45;
}

.progress {
  margin-inline-start: 34px;
  width: auto !important;
}
</style>

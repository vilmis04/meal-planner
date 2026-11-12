<script setup lang="ts">
import type { RecipeLoadResult } from "~/types/recipe.types";

// The recipe a wide slot picker has selected, in full beside its list (X4, "recipe detail beside the slot picker"):
// its ingredients, method, protein swap and nutrition as on its own page, with the picker's choice at the foot.
const { recipeId } = defineProps<{ recipeId: string | null }>();

const { t, locale } = useI18n();
const { loadRecipe } = useRecipes();

// Recipes already read are kept while the picker is open, so going back and forth between two is instant.
const results = shallowRef(new Map<string, RecipeLoadResult>());
const isLoading = ref(false);

watch(
  () => recipeId,
  async (id) => {
    if (id === null || results.value.has(id)) {
      return;
    }
    isLoading.value = true;
    const result = await loadRecipe(id);
    results.value = new Map(results.value).set(id, result);
    isLoading.value = false;
  },
  { immediate: true },
);

const result = computed(() => (recipeId === null ? null : (results.value.get(recipeId) ?? null)));
const recipe = computed(() =>
  result.value?.status === "found" ? localizeRecipe(result.value.recipe, locale.value) : null,
);
</script>

<template>
  <section id="slot-picker-preview" :class="$style.preview" :aria-label="t('plan.slot.preview.label')" data-testid="slot-picker-preview">
    <div :class="$style.body">
      <p v-if="recipeId === null" :class="$style.hint" data-testid="slot-picker-preview-hint">
        {{ t("plan.slot.preview.choose") }}
      </p>
      <RecipeDetail v-else-if="recipe" :key="recipe.id" :recipe="recipe" />
      <v-alert v-else-if="result && result.status !== 'found'" type="error" variant="tonal" data-testid="slot-picker-preview-failed">
        {{ t("recipes.errors.detailLoadFailed") }}
      </v-alert>
      <div v-else-if="isLoading" :class="$style.loading">
        <v-progress-circular indeterminate color="primary" size="28" />
      </div>
    </div>
    <footer v-if="$slots.actions && recipeId !== null" :class="$style.actions">
      <slot name="actions" />
    </footer>
  </section>
</template>

<style module>
.preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid rgb(var(--v-theme-border));
  background: var(--color-background);
}

.body {
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--space-4) var(--space-5);
  overflow-y: auto;
}

.hint {
  margin: 0;
  padding: var(--space-6) var(--space-3);
  color: var(--color-muted);
  text-align: center;
}

.loading {
  display: grid;
  place-items: center;
  padding: var(--space-6);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid rgb(var(--v-theme-border));
  background: var(--color-surface);
}
</style>

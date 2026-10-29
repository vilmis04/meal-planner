<script setup lang="ts">
defineOptions({ name: "RecipePage" });

const { t } = useI18n();
const route = useRoute();
const { loadRecipe } = useRecipes();

const id = String(route.params.id);
const { data: result } = await useAsyncData(`recipe-${id}`, () => loadRecipe(id));

useHead({
  title: () => (result.value?.status === "found" ? result.value.recipe.name : t("recipes.pageTitle")),
});

// The back link keeps the meal filter the list was showing.
const listLocation = computed(() => ({ path: "/recipes", query: route.query }));
</script>

<template>
  <div :class="$style.page">
    <v-btn
      :to="listLocation"
      :class="$style.back"
      variant="text"
      prepend-icon="mdi-arrow-left"
      data-testid="recipe-back"
    >
      {{ t("recipes.detail.back") }}
    </v-btn>

    <RecipeDetail v-if="result?.status === 'found'" :recipe="result.recipe" />
    <v-alert v-else-if="result?.status === 'not-found'" type="warning" variant="tonal" data-testid="recipe-not-found">
      {{ t("recipes.errors.notFound") }}
      <template #append>
        <v-btn :to="listLocation" variant="text" size="small">{{ t("recipes.errors.backToList") }}</v-btn>
      </template>
    </v-alert>
    <v-alert v-else type="error" variant="tonal" data-testid="recipe-load-failed">
      {{ t("recipes.errors.detailLoadFailed") }}
    </v-alert>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.back {
  align-self: flex-start;
  min-height: 44px;
}

/* Two panes show the list beside the recipe, so there is nothing to go back to. */
@media (min-width: 960px) {
  .back {
    display: none;
  }
}
</style>

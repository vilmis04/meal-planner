<script setup lang="ts">
defineOptions({ name: "RecipesIndexPage" });

const { t } = useI18n();
</script>

<template>
  <p :class="$style.hint" data-testid="recipe-choose-hint">{{ t("recipes.list.choose") }}</p>
</template>

<style module>
/* Only the two-pane layout has an empty right pane to explain. */
.hint {
  display: none;
  margin: 0;
  padding: var(--space-5) var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-muted);
  text-align: center;
}

/* 960px is --breakpoint-md; custom properties cannot be used in media queries. */
@media (min-width: 960px) {
  .hint {
    display: block;
  }
}
</style>

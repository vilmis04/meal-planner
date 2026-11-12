<script setup lang="ts">
// A recipe's tips (X3): the tips about its ingredients, after the ingredient list, on the recipe page and in the slot
// picker's preview. The heading folds them away; that choice is remembered for every recipe in this browser.
const { items } = defineProps<{
  // The Lithuanian items of the recipe's lines, which the ingredient aliases match.
  items: readonly string[];
}>();

const { t } = useI18n();
const { getRecipeTipList } = useTips();
const { isCollapsed, setCollapsed } = useTipsCollapsed("recipe");

const tips = computed(() => getRecipeTipList(items));
const contentId = useId();
</script>

<template>
  <section v-if="tips.length > 0" :class="$style.section" data-testid="recipe-tips">
    <h3 :class="$style.heading">
      <button
        type="button"
        :class="$style.toggle"
        :aria-expanded="!isCollapsed"
        :aria-controls="contentId"
        data-testid="recipe-tips-toggle"
        @click="setCollapsed(!isCollapsed)"
      >
        <v-icon icon="mdi-lightbulb-on-outline" size="20" :class="$style.icon" aria-hidden="true" />
        <span :class="$style.title">{{ t("tips.recipeTitle", { count: tips.length }) }}</span>
        <v-icon
          icon="mdi-chevron-down"
          size="20"
          :class="[$style.chevron, !isCollapsed && $style.chevronExpanded]"
          aria-hidden="true"
        />
      </button>
    </h3>
    <ul v-show="!isCollapsed" :id="contentId" :class="$style.list">
      <li v-for="tip in tips" :key="tip.id">
        <TipNote :tip="tip" :is-icon-shown="false" />
      </li>
    </ul>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.heading {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch-target);
  padding: 0 var(--space-1);
  border: none;
  border-radius: var(--radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.icon {
  flex: 0 0 auto;
  color: var(--color-secondary);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
}

.chevron {
  flex: 0 0 auto;
  color: var(--color-muted);
  transition: transform 0.15s ease;
}

.chevronExpanded {
  transform: rotate(180deg);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>

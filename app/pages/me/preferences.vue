<script setup lang="ts">
defineOptions({ name: "FoodPreferencesPage" });

const { t } = useI18n();
const { profile } = useProfile();
const { recipes, loadList } = useRecipes();
const { isLoaded: isRatingLoaded, load: loadRatings } = useRecipeRatings();

useHead({ title: () => t("profile.preferences.pageTitle") });

// Loaded once and kept, as on the recipes page. Each fails on its own: ProfileMealRatings shows the warning, and
// the diet picker above it keeps working.
await Promise.all([recipes.value ? undefined : loadList(), isRatingLoaded.value ? undefined : loadRatings()]);
</script>

<template>
  <div :class="$style.page">
    <h1 :class="$style.title">{{ t("profile.preferences.title") }}</h1>

    <v-alert v-if="!profile" type="error" variant="tonal">
      {{ t("profile.errors.loadFailed") }}
    </v-alert>
    <template v-else>
      <ProfileDietSetting />
      <ProfileMealRatings />
    </template>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
</style>

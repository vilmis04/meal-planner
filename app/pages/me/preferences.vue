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
  <LayoutPage width="narrow" :title="t('profile.preferences.title')">

    <v-alert v-if="!profile" type="error" variant="tonal">
      {{ t("profile.errors.loadFailed") }}
    </v-alert>
    <template v-else>
      <ProfileDietSetting />
      <ProfileMealRatings />
    </template>
  </LayoutPage>
</template>

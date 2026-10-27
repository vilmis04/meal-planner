<script setup lang="ts">
defineOptions({ name: "FoodPreferencesPage" });

const { t } = useI18n();
const { profile } = useProfile();

useHead({ title: () => t("profile.preferences.pageTitle") });
</script>

<template>
  <div :class="$style.page">
    <h1 :class="$style.title">{{ t("profile.preferences.title") }}</h1>

    <v-alert v-if="!profile" type="error" variant="tonal">
      {{ t("profile.errors.loadFailed") }}
    </v-alert>
    <ProfileDietSetting v-else />
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

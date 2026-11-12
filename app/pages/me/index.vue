<script setup lang="ts">
defineOptions({ name: "ProfilePage" });

const { t } = useI18n();
const supabase = useSupabaseClient();
const { profile } = useProfile();

useHead({ title: () => t("profile.pageTitle") });

async function handleSignOut() {
  await supabase.auth.signOut();
  await navigateTo("/login");
}
</script>

<template>
  <LayoutPage width="narrow" :title="t('profile.title')">

    <v-alert v-if="!profile" type="error" variant="tonal">
      {{ t("profile.errors.loadFailed") }}
    </v-alert>
    <template v-else>
      <ProfileNameForm />
      <ProfileLanguageSetting />
      <ProfileThemeSetting />
      <v-card to="/me/preferences" variant="flat" border :class="$style.row">
        <v-list-item
          :title="t('profile.preferences.title')"
          :subtitle="t('profile.preferences.summary', { diet: t(`profile.diet.options.${profile.diet}.label`) })"
          prepend-icon="mdi-silverware-fork-knife"
          append-icon="mdi-chevron-right"
        />
      </v-card>
      <v-card to="/me/shops" variant="flat" border :class="$style.row" data-testid="profile-shop-insights">
        <v-list-item
          :title="t('profile.shops.title')"
          :subtitle="t('profile.shops.hint')"
          prepend-icon="mdi-storefront-outline"
          append-icon="mdi-chevron-right"
        />
      </v-card>
      <v-card to="/me/meals" variant="flat" border :class="$style.row" data-testid="profile-preference-insights">
        <v-list-item
          :title="t('profile.meals.title')"
          :subtitle="t('profile.meals.hint')"
          prepend-icon="mdi-heart-outline"
          append-icon="mdi-chevron-right"
        />
      </v-card>
      <v-card to="/household" variant="flat" border :class="$style.row">
        <v-list-item
          :title="t('profile.household.title')"
          :subtitle="t('profile.household.hint')"
          prepend-icon="mdi-home-account"
          append-icon="mdi-chevron-right"
        />
      </v-card>
    </template>

    <v-btn variant="outlined" size="large" block @click="handleSignOut">
      {{ t("profile.signOut") }}
    </v-btn>
  </LayoutPage>
</template>

<style module>
.row {
  border-radius: var(--radius-lg);
}
</style>

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
  <div :class="$style.page">
    <h1 :class="$style.title">{{ t("profile.title") }}</h1>

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

.row {
  border-radius: var(--radius-lg);
}
</style>

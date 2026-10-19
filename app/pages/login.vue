<template>
  <v-card :class="$style.card" variant="flat" border>
    <v-tabs v-model="activeTab" :class="$style.tabs" color="primary">
      <v-tab value="signIn">{{ t("auth.signIn.tab") }}</v-tab>
      <v-tab value="signUp">{{ t("auth.signUp.tab") }}</v-tab>
    </v-tabs>

    <div :class="$style.body">
      <v-alert v-if="isOAuthFailed" type="error" variant="tonal" density="compact">
        {{ t("auth.errors.oauth") }}
      </v-alert>
      <AuthSignInForm v-if="activeTab === 'signIn'" />
      <AuthSignUpForm v-else />
      <AuthGoogleButton />
    </div>
  </v-card>
</template>

<script setup lang="ts">
defineOptions({ name: "LoginPage" });
definePageMeta({ layout: "auth" });

type AuthTab = "signIn" | "signUp";

const { t } = useI18n();
const route = useRoute();

const activeTab = ref<AuthTab>("signIn");
const isOAuthFailed = computed(() => route.query.error === "oauth");

useHead({ title: () => t("auth.pageTitle") });
</script>

<style module>
.card {
  border-radius: 20px;
}

/* Equal-width tabs as in the mock-up; Vuetify's `grow` sizes them by label length. */
.tabs :global(.v-tab) {
  flex: 1 1 0;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-4);
}
</style>

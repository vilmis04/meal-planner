<script setup lang="ts">
defineOptions({ name: "ForgotPasswordPage" });
definePageMeta({ layout: "auth" });

const { t } = useI18n();
const route = useRoute();

const initialEmail = typeof route.query.email === "string" ? route.query.email : "";
// Set by /auth/callback when a reset link was expired, already used or opened in another browser.
const isLinkInvalid = computed(() => route.query.error === "link");

useHead({ title: () => t("auth.forgotPassword.pageTitle") });
</script>

<template>
  <v-card :class="$style.card" variant="flat" border>
    <div :class="$style.body">
      <h2 :class="$style.title">{{ t("auth.forgotPassword.title") }}</h2>
      <p :class="$style.hint">{{ t("auth.forgotPassword.hint") }}</p>
      <v-alert v-if="isLinkInvalid" type="error" variant="tonal" density="compact">
        {{ t("auth.errors.resetLinkInvalid") }}
      </v-alert>
      <AuthForgotPasswordForm :initial-email="initialEmail" />
      <NuxtLink to="/login" :class="$style.backLink">
        <v-icon icon="mdi-arrow-left" size="18" />
        {{ t("auth.forgotPassword.backToSignIn") }}
      </NuxtLink>
    </div>
  </v-card>
</template>

<style module>
.card {
  border-radius: 20px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 15px;
  line-height: 1.45;
}

.backLink {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: var(--space-1);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.backLink:hover {
  text-decoration: underline;
}
</style>

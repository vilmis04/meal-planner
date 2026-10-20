<script setup lang="ts">
defineOptions({ name: "ResetPasswordPage" });
definePageMeta({ layout: "auth" });

const { t } = useI18n();

useHead({ title: () => t("auth.resetPassword.pageTitle") });
</script>

<template>
  <v-card :class="$style.card" variant="flat" border>
    <div :class="$style.body">
      <h2 :class="$style.title">{{ t("auth.resetPassword.title") }}</h2>
      <p :class="$style.hint">{{ t("auth.resetPassword.hint") }}</p>
      <AuthResetPasswordForm />
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
</style>

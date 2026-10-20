<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const { t } = useI18n();
const supabase = useSupabaseClient();
const rules = useAuthFieldRules();
const { isSubmitting, errorKey, submit } = useAuthForm();

const password = ref("");
const confirmPassword = ref("");

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid) {
    return;
  }

  // The recovery session from the reset link stays signed in, so the user lands home.
  const response = await submit(() => supabase.auth.updateUser({ password: password.value }));

  if (response) {
    await navigateTo("/");
  }
}
</script>

<template>
  <v-form :class="$style.form" @submit.prevent="handleSubmit">
    <AuthPasswordField
      v-model="password"
      :label="t('auth.fields.newPassword')"
      :rules="[rules.required, rules.minPasswordLength]"
      autocomplete="new-password"
    />
    <AuthPasswordField
      v-model="confirmPassword"
      :label="t('auth.fields.confirmPassword')"
      :rules="[rules.required, rules.matches(() => password)]"
      autocomplete="new-password"
    />
    <v-alert v-if="errorKey" type="error" variant="tonal" density="compact">
      {{ t(errorKey) }}
    </v-alert>
    <v-btn type="submit" color="primary" size="large" block :loading="isSubmitting">
      {{ t("auth.resetPassword.submit") }}
    </v-btn>
  </v-form>
</template>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>

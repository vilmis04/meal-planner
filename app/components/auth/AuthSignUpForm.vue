<template>
  <v-form :class="$style.form" @submit.prevent="handleSubmit">
    <AuthEmailField v-model="email" />
    <AuthPasswordField
      v-model="password"
      :label="t('auth.fields.password')"
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
    <v-alert v-if="isSignInNeeded" type="info" variant="tonal" density="compact">
      {{ t("auth.signUp.signInToContinue") }}
    </v-alert>
    <v-btn type="submit" color="primary" size="large" block :loading="isSubmitting">
      {{ t("auth.signUp.submit") }}
    </v-btn>
  </v-form>
</template>

<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const { t } = useI18n();
const supabase = useSupabaseClient();
const rules = useAuthFieldRules();
const { isSubmitting, errorKey, submit } = useAuthForm();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
// Only true if the Supabase project requires email confirmation, which this app expects to be off.
const isSignInNeeded = ref(false);

async function handleSubmit(event: SubmitEventPromise) {
  isSignInNeeded.value = false;

  const { valid } = await event;
  if (!valid) {
    return;
  }

  const response = await submit(() =>
    supabase.auth.signUp({ email: email.value, password: password.value }),
  );

  if (!response) {
    return;
  }

  if (response.data.session) {
    await navigateTo("/");
    return;
  }

  isSignInNeeded.value = true;
}
</script>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>

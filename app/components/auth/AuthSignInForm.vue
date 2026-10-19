<template>
  <v-form :class="$style.form" @submit.prevent="handleSubmit">
    <AuthEmailField v-model="email" />
    <AuthPasswordField
      v-model="password"
      :label="t('auth.fields.password')"
      :rules="[rules.required]"
      autocomplete="current-password"
    />
    <v-alert v-if="errorKey" type="error" variant="tonal" density="compact">
      {{ t(errorKey) }}
    </v-alert>
    <v-btn type="submit" color="primary" size="large" block :loading="isSubmitting">
      {{ t("auth.signIn.submit") }}
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

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid) {
    return;
  }

  const response = await submit(() =>
    supabase.auth.signInWithPassword({ email: email.value, password: password.value }),
  );

  if (response) {
    await navigateTo("/");
  }
}
</script>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>

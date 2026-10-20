<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const props = defineProps<{
  initialEmail?: string;
}>();

const { t } = useI18n();
const supabase = useSupabaseClient();
const { isSubmitting, errorKey, submit } = useAuthForm();

const email = ref(props.initialEmail ?? "");
// Shown for every valid address, so the form does not reveal which emails have accounts.
const isSent = ref(false);

async function handleSubmit(event: SubmitEventPromise) {
  isSent.value = false;

  const { valid } = await event;
  if (!valid) {
    return;
  }

  // The link comes back to /auth/callback, which exchanges the PKCE code for a
  // recovery session and then forwards to the new-password page.
  const response = await submit(() =>
    supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    }),
  );

  if (response) {
    isSent.value = true;
  }
}
</script>

<template>
  <v-form :class="$style.form" @submit.prevent="handleSubmit">
    <AuthEmailField v-model="email" />
    <v-alert v-if="errorKey" type="error" variant="tonal" density="compact">
      {{ t(errorKey) }}
    </v-alert>
    <v-alert v-if="isSent" type="success" variant="tonal" density="compact">
      {{ t("auth.forgotPassword.sent", { email }) }}
    </v-alert>
    <v-btn type="submit" color="primary" size="large" block :loading="isSubmitting">
      {{ t(isSent ? "auth.forgotPassword.resend" : "auth.forgotPassword.submit") }}
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

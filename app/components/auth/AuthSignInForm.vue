<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const { t } = useI18n();
const supabase = useSupabaseClient();
const rules = useAuthFieldRules();
const { isSubmitting, errorKey, submit } = useAuthForm();
const nextPath = useAuthNextPath();

const email = ref("");
const password = ref("");

// Carries the typed email over so the user does not have to type it again.
const forgotPasswordLink = computed(() => ({
  path: "/forgot-password",
  query: email.value ? { email: email.value } : {},
}));

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid) {
    return;
  }

  const response = await submit(() =>
    supabase.auth.signInWithPassword({ email: email.value, password: password.value }),
  );

  if (response) {
    await navigateTo(nextPath.value);
  }
}
</script>

<template>
  <v-form :class="$style.form" @submit.prevent="handleSubmit">
    <AuthEmailField v-model="email" />
    <AuthPasswordField
      v-model="password"
      :label="t('auth.fields.password')"
      :rules="[rules.required]"
      autocomplete="current-password"
    />
    <div :class="$style.forgotPassword">
      <NuxtLink :to="forgotPasswordLink" :class="$style.link">
        {{ t("auth.signIn.forgotPassword") }}
      </NuxtLink>
    </div>
    <v-alert v-if="errorKey" type="error" variant="tonal" density="compact">
      {{ t(errorKey) }}
    </v-alert>
    <v-btn type="submit" color="primary" size="large" block :loading="isSubmitting">
      {{ t("auth.signIn.submit") }}
    </v-btn>
  </v-form>
</template>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Pulled up against the password field's hint area, as in the mock-up. */
.forgotPassword {
  display: flex;
  justify-content: flex-end;
  margin-top: calc(-1 * var(--space-3));
}

.link {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>

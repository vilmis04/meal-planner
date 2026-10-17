<template>
  <div :class="$style.wrapper">
    <v-card :class="$style.card" :title="t('auth.signUp.title')" :subtitle="t('auth.signUp.subtitle')">
      <v-card-text>
        <v-form @submit.prevent="handleSignUp">
          <v-text-field
            v-model="email"
            :label="t('auth.fields.email')"
            type="email"
            autocomplete="email"
            required
          />
          <v-text-field
            v-model="password"
            :label="t('auth.fields.password')"
            type="password"
            autocomplete="new-password"
            required
          />
          <v-text-field
            v-model="confirmPassword"
            :label="t('auth.fields.confirmPassword')"
            type="password"
            autocomplete="new-password"
            required
          />
          <v-alert v-if="errorKey" type="error" density="compact" :class="$style.alert">
            {{ t(errorKey) }}
          </v-alert>
          <v-alert v-if="infoKey" type="success" density="compact" :class="$style.alert">
            {{ t(infoKey) }}
          </v-alert>
          <div :class="$style.actions">
            <v-btn type="submit" color="primary" :loading="isSubmitting">{{ t("auth.signUp.submit") }}</v-btn>
            <v-btn variant="text" to="/login">{{ t("auth.signUp.toSignIn") }}</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const supabase = useSupabaseClient();
const router = useRouter();
const toErrorKey = useAuthErrorKey();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const errorKey = ref("");
const infoKey = ref("");
const isSubmitting = ref(false);

async function handleSignUp() {
  errorKey.value = "";
  infoKey.value = "";

  if (!email.value || !password.value) {
    errorKey.value = "auth.errors.required";
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorKey.value = "auth.errors.passwordMismatch";
    return;
  }

  isSubmitting.value = true;

  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  });

  isSubmitting.value = false;

  if (error) {
    errorKey.value = toErrorKey(error);
    return;
  }

  // With email confirmation enabled Supabase returns no session yet.
  if (!data.session) {
    infoKey.value = "auth.confirmEmailSent";
    return;
  }

  await router.push("/");
}
</script>

<style module>
.wrapper {
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 420px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.alert {
  margin-top: var(--space-2);
}
</style>

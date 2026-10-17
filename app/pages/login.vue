<template>
  <div :class="$style.wrapper">
    <v-card :class="$style.card" :title="t('auth.signIn.title')" :subtitle="t('auth.signIn.subtitle')">
      <v-card-text>
        <v-form @submit.prevent="handleSignIn">
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
            autocomplete="current-password"
            required
          />
          <v-alert v-if="errorKey" type="error" density="compact" :class="$style.alert">
            {{ t(errorKey) }}
          </v-alert>
          <div :class="$style.actions">
            <v-btn type="submit" color="primary" :loading="isSubmitting">{{ t("auth.signIn.submit") }}</v-btn>
            <v-btn variant="text" to="/signup">{{ t("auth.signIn.toSignUp") }}</v-btn>
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
const errorKey = ref("");
const isSubmitting = ref(false);

async function handleSignIn() {
  errorKey.value = "";
  isSubmitting.value = true;

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  isSubmitting.value = false;

  if (error) {
    errorKey.value = toErrorKey(error);
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

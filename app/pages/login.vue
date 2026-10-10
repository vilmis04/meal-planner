<template>
  <div :class="$style.wrapper">
    <v-card :class="$style.card" title="Sign in" subtitle="Access your meal planner">
      <v-card-text>
        <v-form @submit.prevent="handleSignIn">
          <v-text-field v-model="email" label="Email" type="email" autocomplete="email" required />
          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            autocomplete="current-password"
            required
          />
          <v-alert v-if="errorMessage" type="error" density="compact" :class="$style.alert">
            {{ errorMessage }}
          </v-alert>
          <div :class="$style.actions">
            <v-btn type="submit" color="primary" :loading="isSubmitting">Sign in</v-btn>
            <v-btn variant="text" :loading="isSubmitting" @click="handleSignUp">Create account</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient();
const router = useRouter();

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

async function handleSignIn() {
  errorMessage.value = "";
  isSubmitting.value = true;

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  await router.push("/");
}

async function handleSignUp() {
  errorMessage.value = "";
  isSubmitting.value = true;

  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  });

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
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

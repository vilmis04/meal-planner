<script setup lang="ts">
const { t } = useI18n();
const supabase = useSupabaseClient();
const nextPath = useAuthNextPath();
const isRedirecting = ref(false);

// Brings the user back to the page they came for, such as an invite link.
const redirectTo = computed(() => {
  const callback = `${window.location.origin}/auth/callback`;
  return nextPath.value === "/" ? callback : `${callback}?next=${encodeURIComponent(nextPath.value)}`;
});

// In the browser this only builds the Supabase authorize URL and navigates to it;
// failures come back later through /auth/callback, so there is no error to show here.
async function handleClick() {
  isRedirecting.value = true;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.value },
  });
}
</script>

<template>
  <div :class="$style.wrapper">
    <div :class="$style.divider">
      <v-divider />
      <span>{{ t("auth.or") }}</span>
      <v-divider />
    </div>
    <v-btn
      variant="outlined"
      size="large"
      block
      prepend-icon="mdi-google"
      :loading="isRedirecting"
      @click="handleClick"
    >
      {{ t("auth.continueWithGoogle") }}
    </v-btn>
  </div>
</template>

<style module>
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-muted);
  font-size: 14px;
}
</style>

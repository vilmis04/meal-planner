<template>
  <div :class="$style.wrapper">
    <h1>{{ t("home.welcome") }}</h1>
    <p v-if="user">{{ t("home.signedInAs", { email: user.email }) }}</p>
    <v-btn color="primary" variant="tonal" @click="handleSignOut">{{ t("auth.signOut") }}</v-btn>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const user = useSupabaseUser();
const supabase = useSupabaseClient();
const router = useRouter();

async function handleSignOut() {
  await supabase.auth.signOut();
  await router.push("/login");
}
</script>

<style module>
.wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
</style>

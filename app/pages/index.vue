<template>
  <div :class="$style.wrapper">
    <h1>Welcome back</h1>
    <p v-if="user">Signed in as {{ user.email }}</p>
    <v-btn color="primary" variant="tonal" @click="handleSignOut">Sign out</v-btn>
  </div>
</template>

<script setup lang="ts">
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

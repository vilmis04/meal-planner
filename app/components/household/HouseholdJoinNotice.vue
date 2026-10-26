<script setup lang="ts">
defineProps<{
  icon: string;
  tone: "info" | "error";
  title: string;
  hint: string;
  actionLabel: string;
  actionTo: string;
}>();
</script>

<template>
  <v-card variant="flat" border :class="$style.card">
    <v-avatar :color="tone" variant="tonal" size="56">
      <v-icon :icon="icon" size="28" />
    </v-avatar>
    <h2 :class="$style.title">{{ title }}</h2>
    <p :class="$style.hint">{{ hint }}</p>
    <v-btn :to="actionTo" color="primary" size="large" block>{{ actionLabel }}</v-btn>
  </v-card>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-lg);
  text-align: center;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>

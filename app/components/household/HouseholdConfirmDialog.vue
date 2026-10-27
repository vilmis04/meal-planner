<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string;
    title: string;
    text: string;
    confirmLabel: string;
    cancelLabel: string;
    isBusy?: boolean;
  }>(),
  { isBusy: false },
);

// Closing is ignored while the action runs, so a second tap cannot start it twice.
const isOpen = defineModel<boolean>({ required: true });
defineEmits<{ confirm: [] }>();
</script>

<template>
  <v-dialog v-model="isOpen" max-width="400" :persistent="isBusy">
    <v-card :class="$style.card">
      <span :class="$style.icon">
        <v-icon :icon="icon" size="24" />
      </span>
      <h2 :class="$style.title">{{ title }}</h2>
      <p :class="$style.text">{{ text }}</p>
      <div :class="$style.actions">
        <v-btn variant="text" color="primary" size="large" :disabled="isBusy" @click="isOpen = false">
          {{ cancelLabel }}
        </v-btn>
        <v-btn variant="flat" color="error" size="large" :loading="isBusy" @click="$emit('confirm')">
          {{ confirmLabel }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 24px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--color-error) 14%, transparent);
  color: var(--color-error);
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.text {
  margin: 0;
  color: var(--color-muted);
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

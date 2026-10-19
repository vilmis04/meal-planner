<script setup lang="ts">
type ValidationRule = (value: string) => true | string;

defineProps<{
  label: string;
  autocomplete: "current-password" | "new-password";
  rules: ValidationRule[];
}>();

const password = defineModel<string>({ required: true });
const isVisible = ref(false);
</script>

<template>
  <v-text-field
    v-model="password"
    :label="label"
    :type="isVisible ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :rules="rules"
    prepend-inner-icon="mdi-lock-outline"
    :append-inner-icon="isVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
    variant="outlined"
    @click:append-inner="isVisible = !isVisible"
  />
</template>

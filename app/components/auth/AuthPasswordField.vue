<script setup lang="ts">
type ValidationRule = (value: string) => true | string;

defineProps<{
  label: string;
  autocomplete: "current-password" | "new-password";
  rules: ValidationRule[];
}>();

const password = defineModel<string>({ required: true });
const isVisible = ref(false);
const { t } = useI18n();
</script>

<template>
  <v-text-field
    v-model="password"
    :label="label"
    :type="isVisible ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :rules="rules"
    prepend-inner-icon="mdi-lock-outline"
    variant="outlined"
  >
    <!-- A full touch target (X4), named for screen readers. -->
    <template #append-inner>
      <v-btn
        :icon="isVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        variant="text"
        size="44"
        :aria-label="isVisible ? t('auth.password.hide') : t('auth.password.show')"
        :aria-pressed="isVisible"
        :class="$style.toggle"
        @click="isVisible = !isVisible"
      />
    </template>
  </v-text-field>
</template>

<style module>
/* Sits in the field's end without making the field taller. */
.toggle {
  flex: none;
  min-width: var(--touch-target);
  margin-block: -10px;
  margin-inline-end: -8px;
}
</style>

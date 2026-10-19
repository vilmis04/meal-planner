<template>
  <v-text-field
    v-model="email"
    :label="t('auth.fields.email')"
    :rules="[rules.required, rules.email]"
    type="email"
    autocomplete="email"
    prepend-inner-icon="mdi-email-outline"
    variant="outlined"
  />
</template>

<script setup lang="ts">
const { t } = useI18n();
const rules = useAuthFieldRules();
const email = defineModel<string>({ required: true });
</script>

<script setup lang="ts">
import type { NuxtError } from "#app";

// Nuxt's own error page has neither the theme toggle nor the language switcher, so errors use the auth layout's hero.
defineOptions({ name: "ErrorPage" });

const NOT_FOUND_STATUS = 404;

const { error } = defineProps<{ error: NuxtError }>();

const { t } = useI18n();

const messageKey = computed(() => (error.statusCode === NOT_FOUND_STATUS ? "error.notFound" : "error.generic"));

useHead({ title: () => t("error.pageTitle") });

function handleHome() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <NuxtLayout name="auth">
    <v-card :class="$style.card" variant="flat" border>
      <h2 :class="$style.title">{{ t(`${messageKey}.title`) }}</h2>
      <p :class="$style.text">{{ t(`${messageKey}.text`) }}</p>
      <v-btn color="primary" variant="flat" size="large" block @click="handleHome">
        {{ t("error.home") }}
      </v-btn>
    </v-card>
  </NuxtLayout>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 20px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.text {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
}
</style>

<script setup lang="ts">
// <html lang> follows the active language, so screen readers and the browser's spell checking use it.
const { localeProperties } = useI18n();

useHead({ htmlAttrs: { lang: () => localeProperties.value.language } });
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

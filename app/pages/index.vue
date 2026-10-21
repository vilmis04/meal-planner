<script setup lang="ts">
defineOptions({ name: "HomePage" });

const { t } = useI18n();
const { profile } = useProfile();
</script>

<template>
  <h1>
    {{ profile ? t("home.greeting", { name: profile.displayName }) : t("home.title") }}
  </h1>
</template>

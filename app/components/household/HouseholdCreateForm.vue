<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const { t } = useI18n();
const { create } = useHousehold();
const { show } = useAppSnackbar();

const name = ref("");
const isSaving = ref(false);

const rules = [
  (value: string) => value.trim().length > 0 || t("household.validation.nameRequired"),
  (value: string) =>
    value.trim().length <= HOUSEHOLD_NAME_MAX_LENGTH ||
    t("household.validation.nameMaxLength", { max: HOUSEHOLD_NAME_MAX_LENGTH }),
];

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid || isSaving.value) {
    return;
  }

  isSaving.value = true;
  const result = await create(name.value);
  isSaving.value = false;

  // On success the page swaps this form for the household overview.
  if (result.isCreated) {
    show("household.create.created", "success");
  } else {
    show(result.errorKey, "error");
  }
}
</script>

<template>
  <div :class="$style.wrapper">
    <section :class="$style.hero">
      <v-icon icon="mdi-home-heart" size="32" />
      <h2 :class="$style.heroTitle">{{ t("household.create.title") }}</h2>
      <p :class="$style.heroHint">{{ t("household.create.hint") }}</p>
    </section>

    <v-card variant="flat" border :class="$style.card">
      <v-form :class="$style.form" @submit.prevent="handleSubmit">
        <v-text-field
          v-model="name"
          :label="t('household.create.nameLabel')"
          :rules="rules"
          :counter="HOUSEHOLD_NAME_MAX_LENGTH"
          autocomplete="off"
        />
        <v-btn type="submit" color="primary" size="large" block :loading="isSaving">
          {{ t("household.create.submit") }}
        </v-btn>
      </v-form>
    </v-card>
  </div>
</template>

<style module>
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background-color: var(--color-hero);
  color: var(--color-on-hero);
}

.heroTitle {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.heroHint {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  opacity: 0.85;
}

.card {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>

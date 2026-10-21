<script setup lang="ts">
import type { SubmitEventPromise } from "vuetify";

const { t } = useI18n();
const user = useSupabaseUser();
const { profile } = useProfile();
const { changeDisplayName } = useProfileSettings();
const { show } = useAppSnackbar();

const displayName = ref(profile.value?.displayName ?? "");
const isSaving = ref(false);

const savedName = computed(() => profile.value?.displayName ?? "");
const initial = computed(() => savedName.value.charAt(0).toUpperCase());
const isUnchanged = computed(() => displayName.value.trim() === savedName.value);

const rules = [
  (value: string) => value.trim().length > 0 || t("profile.validation.nameRequired"),
  (value: string) =>
    value.trim().length <= DISPLAY_NAME_MAX_LENGTH ||
    t("profile.validation.nameMaxLength", { max: DISPLAY_NAME_MAX_LENGTH }),
];

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event;
  if (!valid) {
    return;
  }

  isSaving.value = true;
  const isSaved = await changeDisplayName(displayName.value);
  isSaving.value = false;

  if (isSaved) {
    displayName.value = savedName.value;
  }
  const messageKey = isSaved ? "profile.name.saved" : "profile.errors.saveFailed";
  const messageColor = isSaved ? "success" : "error";
  show(messageKey, messageColor);
}
</script>

<template>
  <v-card :class="$style.card" variant="flat" border>
    <div :class="$style.identity">
      <v-avatar color="primary" variant="tonal" size="44">
        <span :class="$style.initial">{{ initial }}</span>
      </v-avatar>
      <div :class="$style.names">
        <span :class="$style.name">{{ savedName }}</span>
        <span :class="$style.email">{{ user?.email }}</span>
      </div>
    </div>

    <v-form :class="$style.form" @submit.prevent="handleSubmit">
      <v-text-field
        v-model="displayName"
        :label="t('profile.name.label')"
        :rules="rules"
        :counter="DISPLAY_NAME_MAX_LENGTH"
        autocomplete="nickname"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        :class="$style.save"
        :loading="isSaving"
        :disabled="isUnchanged"
      >
        {{ t("profile.name.save") }}
      </v-btn>
    </v-form>
  </v-card>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.initial {
  font-weight: 700;
}

.names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.name {
  font-size: 17px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.email {
  color: var(--color-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.form {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.form > :first-child {
  flex: 1 1 auto;
}

/* Lines the button up with the 56px text field rather than with its counter row. */
.save {
  --v-btn-height: 56px;
}
</style>

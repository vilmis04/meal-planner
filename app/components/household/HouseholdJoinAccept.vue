<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { InvitePreview } from "~/types/household-invite.types";

defineProps<{ preview: DeepReadonly<InvitePreview>; isJoining: boolean }>();
defineEmits<{ accept: [] }>();

const { t } = useI18n();
</script>

<template>
  <div :class="$style.wrapper">
    <section :class="$style.hero">
      <v-icon icon="mdi-home-heart" size="32" />
      <span :class="$style.label">{{ t("household.join.accept.label") }}</span>
      <h2 :class="$style.name">{{ preview.householdName }}</h2>
      <p :class="$style.meta">
        <template v-if="preview.inviterName">
          {{ t("household.join.accept.invitedBy", { name: preview.inviterName }) }} ·
        </template>
        {{ t("household.overview.memberCount", preview.memberCount) }}
      </p>
    </section>

    <v-card variant="flat" border :class="$style.card">
      <p :class="$style.hint">{{ t("household.join.accept.hint") }}</p>
      <v-btn color="primary" size="large" block :loading="isJoining" @click="$emit('accept')">
        {{ t("household.join.accept.submit") }}
      </v-btn>
      <v-btn to="/" variant="text" size="large" block :disabled="isJoining">
        {{ t("household.join.accept.decline") }}
      </v-btn>
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

.label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
}

.name {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.meta {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.hint {
  margin: 0 0 var(--space-1);
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.5;
}
</style>

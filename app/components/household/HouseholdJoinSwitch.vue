<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { InvitePreview } from "~/types/household-invite.types";
import type { Household } from "~/types/household.types";

defineProps<{
  preview: DeepReadonly<InvitePreview>;
  current: DeepReadonly<Household>;
  isJoining: boolean;
}>();
defineEmits<{ leave: [] }>();

const { t } = useI18n();
const { isOwner } = useHousehold();
</script>

<template>
  <div :class="$style.wrapper">
    <section :class="$style.hero">
      <v-icon icon="mdi-swap-horizontal" size="32" />
      <h2 :class="$style.title">{{ t("household.join.switch.title", { name: current.name }) }}</h2>
      <p :class="$style.hint">
        {{ t("household.join.switch.hint", { current: current.name, invited: preview.householdName }) }}
      </p>
    </section>

    <v-card variant="flat" border :class="$style.card">
      <v-alert v-if="current.members.length === 1" type="warning" variant="tonal" density="compact">
        {{ t("household.join.switch.lastMember", { name: current.name }) }}
      </v-alert>
      <!-- The database refuses this switch too; this explains it before the button is pressed. -->
      <v-alert v-else-if="isOwner" type="info" variant="tonal" density="compact">
        {{ t("household.join.switch.ownerMustTransfer", { name: current.name }) }}
      </v-alert>
      <v-btn
        color="error"
        size="large"
        block
        :loading="isJoining"
        :disabled="isOwner && current.members.length > 1"
        @click="$emit('leave')"
      >
        {{ t("household.join.switch.leave", { current: current.name, invited: preview.householdName }) }}
      </v-btn>
      <v-btn to="/household" variant="outlined" size="large" block :disabled="isJoining">
        {{ t("household.join.switch.stay", { name: current.name }) }}
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

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.hint {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  opacity: 0.85;
  overflow-wrap: anywhere;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}
</style>

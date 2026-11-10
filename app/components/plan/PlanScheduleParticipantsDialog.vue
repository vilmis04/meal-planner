<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HouseholdMember } from "~/types/household.types";

// Who the household schedule plans for. Ticking everyone keeps it for everyone, newcomers included.
const props = defineProps<{
  members: DeepReadonly<HouseholdMember[]>;
  // Null: everyone.
  participantIds: DeepReadonly<string[]> | null;
}>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [participantIds: string[]] }>();

const { t } = useI18n();

const selectedIds = ref<string[]>([]);

// Each opening starts from what is saved.
watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    const memberIds = props.members.map((member) => member.userId);
    selectedIds.value = props.participantIds
      ? memberIds.filter((memberId) => props.participantIds?.includes(memberId))
      : memberIds;
  }
});

function save() {
  emit("save", selectedIds.value);
  isOpen.value = false;
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="440">
    <v-card :class="$style.card" data-testid="plan-schedule-participants-dialog">
      <PlanParticipantPicker v-model="selectedIds" :members="members" />
      <p :class="$style.hint">{{ t("plan.schedule.everyoneHint") }}</p>
      <div :class="$style.actions">
        <v-btn variant="text" color="primary" size="large" data-testid="plan-schedule-participants-cancel" @click="isOpen = false">
          {{ t("plan.schedule.cancel") }}
        </v-btn>
        <v-btn
          variant="flat"
          color="primary"
          size="large"
          data-testid="plan-schedule-participants-save"
          @click="save"
        >
          {{ t("plan.schedule.done") }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 24px;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

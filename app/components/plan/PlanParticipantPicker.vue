<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { HouseholdMember } from "~/types/household.types";

const props = defineProps<{ members: DeepReadonly<HouseholdMember[]>; disabled?: boolean }>();

// The ticked members' ids, kept in the household's member order.
const participantIds = defineModel<string[]>({ required: true });

const { t } = useI18n();
const user = useSupabaseUser();

const selected = computed(() => new Set(participantIds.value));
const servings = computed(() => getPlanServings(participantIds.value));

const isCurrentUser = (member: DeepReadonly<HouseholdMember>): boolean => member.userId === user.value?.id;
const isSelected = (member: DeepReadonly<HouseholdMember>): boolean => selected.value.has(member.userId);
// The last ticked box stays ticked: a plan needs at least one participant.
const isLastSelected = (member: DeepReadonly<HouseholdMember>): boolean =>
  servings.value === 1 && isSelected(member);

const memberName = (member: DeepReadonly<HouseholdMember>): string =>
  isCurrentUser(member) ? t("household.overview.you", { name: member.displayName }) : member.displayName;

const memberHint = (member: DeepReadonly<HouseholdMember>): string =>
  isSelected(member)
    ? t("plan.participants.diet", { diet: t(`profile.diet.options.${member.diet}.label`) })
    : t("plan.participants.notInPlan");

const avatarColor = (member: DeepReadonly<HouseholdMember>): string | undefined => {
  if (!isSelected(member)) {
    return undefined;
  }
  return isCurrentUser(member) ? "primary" : "secondary";
};

const toggle = (userId: string, isTicked: boolean | null): void => {
  const next = new Set(selected.value);
  if (isTicked) {
    next.add(userId);
  } else {
    next.delete(userId);
  }
  participantIds.value = props.members.map((member) => member.userId).filter((id) => next.has(id));
};
</script>

<template>
  <section :class="$style.section" aria-labelledby="plan-participants-title" data-testid="plan-participants">
    <div :class="$style.header">
      <h2 id="plan-participants-title" :class="$style.label">{{ t("plan.participants.title") }}</h2>
      <span :class="$style.servings" aria-live="polite" data-testid="plan-servings">
        {{ t("plan.participants.servings", { count: servings }) }}
      </span>
    </div>
    <v-card variant="flat" border :class="$style.card">
      <template v-for="(member, index) in members" :key="member.userId">
        <v-divider v-if="index > 0" inset />
        <label
          :for="`plan-participant-${member.userId}`"
          :class="[$style.row, { [$style.unselected]: !isSelected(member) }]"
          data-testid="plan-participant"
        >
          <v-avatar :color="avatarColor(member)" variant="tonal" size="36">
            <span :class="$style.initial">{{ member.displayName.charAt(0).toUpperCase() }}</span>
          </v-avatar>
          <span :class="$style.text">
            <span :class="$style.name">{{ memberName(member) }}</span>
            <span :class="$style.hint">{{ memberHint(member) }}</span>
          </span>
          <v-checkbox-btn
            :id="`plan-participant-${member.userId}`"
            :model-value="isSelected(member)"
            :disabled="disabled || isLastSelected(member)"
            color="primary"
            :aria-describedby="isLastSelected(member) ? 'plan-participants-last' : undefined"
            data-testid="plan-participant-checkbox"
            @update:model-value="toggle(member.userId, $event)"
          />
        </label>
      </template>
    </v-card>
    <p v-if="servings === 0" :class="$style.warning" role="status" data-testid="plan-participants-empty">
      {{ t("plan.participants.empty") }}
    </p>
    <p v-else-if="servings === 1 && members.length > 1" id="plan-participants-last" :class="$style.note">
      {{ t("plan.participants.lastOne") }}
    </p>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.servings {
  font-size: 13px;
  color: var(--color-muted);
  text-align: right;
}

.card {
  border-radius: var(--radius-lg);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  cursor: pointer;
}

.initial {
  font-size: 14px;
  font-weight: 700;
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  font-size: 12px;
  color: var(--color-muted);
}

.unselected .name {
  color: var(--color-muted);
}

.note {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.warning {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-warning));
}
</style>

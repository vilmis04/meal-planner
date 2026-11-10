<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { PlanScheduleSettings } from "#shared/utils/planSchedule.types";
import type { HouseholdMember } from "~/types/household.types";

// The settings of one schedule (H1), as in the "Automatic plans" design. Every change is handed up at once; the page
// saves it. Members of a household who are not its owner see the household's settings without changing them.
const props = defineProps<{
  kind: PlanKind;
  settings: DeepReadonly<PlanScheduleSettings>;
  // The household's members, for a household schedule.
  members: DeepReadonly<HouseholdMember[]>;
  today: string;
  disabled: boolean;
}>();
const emit = defineEmits<{ change: [change: Partial<PlanScheduleSettings>] }>();

const { t, locale } = useI18n();

// Any Monday: the chips and menus only need the weekday names, Monday first.
const REFERENCE_MONDAY = "2024-01-01";
const DAY_COUNT_OPTIONS = Array.from(
  { length: PLAN_DAY_COUNT_MAX - PLAN_DAY_COUNT_MIN + 1 },
  (_, index) => PLAN_DAY_COUNT_MIN + index,
);

const isParticipantsOpen = ref(false);
const isHousehold = computed(() => props.kind === "household");

const weekdayChips = computed(() =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    label: formatShortWeekday(addDays(REFERENCE_MONDAY, weekday - 1), locale.value),
    name: formatPlanDay(addDays(REFERENCE_MONDAY, weekday - 1), locale.value, { weekday: "long" }),
  })),
);

const memberIds = computed(() => props.members.map((member) => member.userId));
// Chosen members who are still in the household; the database takes leavers off, the screen may not know yet.
const chosenCount = computed(
  () => props.settings.participantIds?.filter((id) => memberIds.value.includes(id)).length ?? 0,
);
const participantsLabel = computed(() =>
  props.settings.participantIds === null
    ? t("plan.schedule.everyone", { count: props.members.length })
    : t("plan.schedule.someOf", { count: chosenCount.value, total: props.members.length }),
);

const createWeekday = computed({
  get: () => props.settings.createWeekday,
  set: (weekday: number) => emit("change", { createWeekday: weekday }),
});
</script>

<template>
  <div :class="$style.settings" data-testid="plan-schedule-settings">
    <v-card variant="flat" border :class="$style.card">
      <div :class="[$style.row, $style.enable]">
        <v-avatar color="primary" variant="tonal" rounded="lg" size="44" :class="$style.icon">
          <v-icon icon="mdi-calendar-sync" size="24" aria-hidden="true" />
        </v-avatar>
        <label for="plan-schedule-enabled" :class="$style.text">
          <span :class="$style.title">{{ t("plan.schedule.enable") }}</span>
          <span :class="$style.hint">
            {{ isHousehold ? t("plan.schedule.forHousehold") : t("plan.schedule.forMe") }}
          </span>
        </label>
        <v-switch
          id="plan-schedule-enabled"
          :model-value="settings.isEnabled"
          color="primary"
          inset
          hide-details
          density="compact"
          :disabled="disabled"
          :class="$style.switch"
          data-testid="plan-schedule-enabled"
          @update:model-value="emit('change', { isEnabled: Boolean($event) })"
        />
      </div>
    </v-card>

    <section :class="$style.section" aria-labelledby="plan-schedule-weekday-label">
      <h2 id="plan-schedule-weekday-label" :class="$style.label">{{ t("plan.schedule.createOn") }}</h2>
      <v-chip-group
        v-model="createWeekday"
        mandatory
        :disabled="disabled"
        :class="$style.chips"
        aria-labelledby="plan-schedule-weekday-label"
        data-testid="plan-schedule-weekdays"
      >
        <v-chip
          v-for="chip in weekdayChips"
          :key="chip.weekday"
          :value="chip.weekday"
          :variant="settings.createWeekday === chip.weekday ? 'flat' : 'outlined'"
          :color="settings.createWeekday === chip.weekday ? 'primary' : undefined"
          :disabled="disabled"
          :class="$style.chip"
          :aria-label="chip.name"
          :data-testid="`plan-schedule-weekday-${chip.weekday}`"
        >
          {{ chip.label }}
        </v-chip>
      </v-chip-group>
    </section>

    <v-card variant="flat" border :class="$style.card">
      <v-list :class="$style.list" :disabled="disabled">
        <v-menu location="bottom end" max-height="320">
          <template #activator="{ props: activatorProps }">
            <v-list-item
              v-bind="activatorProps"
              :title="t('plan.schedule.length')"
              :class="$style.item"
              data-testid="plan-schedule-length"
            >
              <template #append>
                <span :class="$style.value" data-testid="plan-schedule-length-value">
                  {{ t("plan.dayCount", { count: settings.dayCount }, settings.dayCount) }}
                </span>
                <v-icon icon="mdi-chevron-right" :class="$style.chevron" aria-hidden="true" />
              </template>
            </v-list-item>
          </template>
          <v-list density="comfortable" data-testid="plan-schedule-length-options">
            <v-list-item
              v-for="count in DAY_COUNT_OPTIONS"
              :key="count"
              :title="t('plan.dayCount', { count }, count)"
              :active="count === settings.dayCount"
              color="primary"
              @click="emit('change', { dayCount: count })"
            />
          </v-list>
        </v-menu>
        <v-divider />
        <v-menu location="bottom end">
          <template #activator="{ props: activatorProps }">
            <v-list-item
              v-bind="activatorProps"
              :title="t('plan.schedule.starts')"
              :class="$style.item"
              data-testid="plan-schedule-start"
            >
              <template #append>
                <span :class="$style.value" data-testid="plan-schedule-start-value">
                  {{ t(`plan.schedule.startsOn.${settings.startWeekday}`) }}
                </span>
                <v-icon icon="mdi-chevron-right" :class="$style.chevron" aria-hidden="true" />
              </template>
            </v-list-item>
          </template>
          <v-list density="comfortable" data-testid="plan-schedule-start-options">
            <v-list-item
              v-for="weekday in WEEKDAYS"
              :key="weekday"
              :title="t(`plan.schedule.startsOn.${weekday}`)"
              :active="weekday === settings.startWeekday"
              color="primary"
              @click="emit('change', { startWeekday: weekday })"
            />
          </v-list>
        </v-menu>
        <template v-if="isHousehold">
          <v-divider />
          <v-list-item
            :title="t('plan.participants.title')"
            :class="$style.item"
            data-testid="plan-schedule-participants"
            @click="isParticipantsOpen = true"
          >
            <template #append>
              <span :class="$style.value" data-testid="plan-schedule-participants-value">{{ participantsLabel }}</span>
              <v-icon icon="mdi-chevron-right" :class="$style.chevron" aria-hidden="true" />
            </template>
          </v-list-item>
        </template>
        <v-divider />
        <div :class="$style.row">
          <label for="plan-schedule-snacks-on-list" :class="$style.text">{{ t("plan.schedule.snacksOnList") }}</label>
          <v-switch
            id="plan-schedule-snacks-on-list"
            :model-value="settings.snacksOnList"
            color="primary"
            inset
            hide-details
            density="compact"
            :disabled="disabled"
            :class="$style.switch"
            data-testid="plan-schedule-snacks-on-list"
            @update:model-value="emit('change', { snacksOnList: Boolean($event) })"
          />
        </div>
      </v-list>
    </v-card>

    <PlanScheduleNextRun v-if="settings.isEnabled" :kind="kind" :settings="settings" :today="today" />

    <PlanScheduleParticipantsDialog
      v-if="isHousehold"
      v-model="isParticipantsOpen"
      :members="members"
      :participant-ids="settings.participantIds"
      @save="emit('change', { participantIds: getScheduleParticipantIds($event, memberIds) })"
    />
  </div>
</template>

<style module>
/* Vuetify's inset thumb is a fixed lilac in the dark theme; follow the app's own colours instead. */
.switch :global(.v-selection-control .v-switch__thumb) {
  background-color: rgb(var(--v-theme-surface));
}

.switch :global(.v-selection-control--dirty .v-switch__thumb) {
  background-color: rgb(var(--v-theme-on-primary));
}

.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card {
  border-radius: var(--radius-lg);
}

.list {
  padding: 0;
  background: transparent;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
}

.enable {
  padding-block: var(--space-3);
}

.icon {
  flex: 0 0 auto;
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 15px;
  cursor: pointer;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--color-muted);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.chips :global(.v-slide-group__content) {
  justify-content: space-between;
  gap: var(--space-1);
}

/* Seven 44px circles fit one row on a 360px phone, as the workday chips of the New plan screen. */
.chip {
  justify-content: center;
  width: 44px;
  height: 44px !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 999px;
  font-size: 13px;
}

.item {
  min-height: 56px;
}

/* As the switch rows: Vuetify's list titles are smaller and spaced out. */
.item :global(.v-list-item-title) {
  font-size: 15px;
  letter-spacing: normal;
}

.value {
  font-size: 15px;
  font-weight: 600;
}

.chevron {
  margin-left: var(--space-2);
  color: var(--color-muted);
}
</style>

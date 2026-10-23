<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { Household, HouseholdMember } from "~/types/household.types";

const MAX_HERO_AVATARS = 3;

const props = defineProps<{ household: DeepReadonly<Household> }>();

const { t } = useI18n();
const user = useSupabaseUser();

const heroMembers = computed(() => props.household.members.slice(0, MAX_HERO_AVATARS));

const initial = (member: DeepReadonly<HouseholdMember>): string => member.displayName.charAt(0).toUpperCase();
const isCurrentUser = (member: DeepReadonly<HouseholdMember>): boolean => member.userId === user.value?.id;

const memberName = (member: DeepReadonly<HouseholdMember>): string =>
  isCurrentUser(member)
    ? t("household.overview.you", { name: member.displayName })
    : member.displayName;

// Other members' emails are not visible to the user, so they get their role instead.
const memberSubtitle = (member: DeepReadonly<HouseholdMember>): string =>
  (isCurrentUser(member) && user.value?.email) || t("household.overview.roleMember");
</script>

<template>
  <div :class="$style.overview">
    <section :class="$style.hero">
      <span :class="$style.heroLabel">{{ t("household.overview.heroLabel") }}</span>
      <h2 :class="$style.heroName">{{ household.name }}</h2>
      <div :class="$style.heroMembers">
        <div :class="$style.avatars">
          <span v-for="member in heroMembers" :key="member.userId" :class="$style.heroAvatar">
            {{ initial(member) }}
          </span>
        </div>
        <span :class="$style.heroCount">
          {{ t("household.overview.memberCount", household.members.length) }}
        </span>
      </div>
    </section>

    <section :class="$style.members">
      <h3 :class="$style.sectionTitle">{{ t("household.overview.members") }}</h3>
      <v-card variant="flat" border :class="$style.card">
        <v-list lines="two">
          <template v-for="(member, index) in household.members" :key="member.userId">
            <v-divider v-if="index > 0" inset />
            <v-list-item :title="memberName(member)" :subtitle="memberSubtitle(member)">
              <template #prepend>
                <v-avatar :color="isCurrentUser(member) ? 'primary' : 'secondary'" variant="tonal">
                  <span :class="$style.initial">{{ initial(member) }}</span>
                </v-avatar>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </section>
  </div>
</template>

<style module>
.overview {
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

.heroLabel {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
}

.heroName {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.heroMembers {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatars {
  display: flex;
}

.heroAvatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-hero);
  border-radius: 50%;
  background-color: var(--color-on-hero);
  color: var(--color-hero);
  font-size: 13px;
  font-weight: 700;
}

.heroAvatar + .heroAvatar {
  margin-left: -8px;
}

.heroCount {
  font-size: 14px;
  opacity: 0.85;
}

.members {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sectionTitle {
  margin: 0;
  padding-inline: var(--space-1);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 600;
}

.card {
  border-radius: var(--radius-lg);
}

.initial {
  font-weight: 700;
}
</style>

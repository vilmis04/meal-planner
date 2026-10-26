<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { Household, HouseholdMember, MemberActionResult } from "~/types/household.types";

type DialogKind = "remove" | "transfer" | "leave" | "leaveLast" | "blocked" | "delete";

const MAX_HERO_AVATARS = 3;

const DIALOG_ICON: Record<DialogKind, string> = {
  remove: "mdi-account-remove-outline",
  transfer: "mdi-crown-outline",
  leave: "mdi-logout",
  leaveLast: "mdi-logout",
  blocked: "mdi-crown-outline",
  delete: "mdi-delete-outline",
};

const SUCCESS_KEY: Partial<Record<DialogKind, string>> = {
  remove: "household.members.removed",
  transfer: "household.members.transferred",
  leave: "household.members.left",
  leaveLast: "household.members.left",
  delete: "household.members.deleted",
};

const props = defineProps<{ household: DeepReadonly<Household> }>();

const { t, d } = useI18n();
const user = useSupabaseUser();
const { isOwner, removeMember, transferOwnership, leave, deleteHousehold } = useHousehold();
const { show } = useAppSnackbar();

const heroMembers = computed(() => props.household.members.slice(0, MAX_HERO_AVATARS));
const hasOtherMembers = computed(() => props.household.members.length > 1);

const initial = (member: DeepReadonly<HouseholdMember>): string => member.displayName.charAt(0).toUpperCase();
const isCurrentUser = (member: DeepReadonly<HouseholdMember>): boolean => member.userId === user.value?.id;

const memberName = (member: DeepReadonly<HouseholdMember>): string =>
  isCurrentUser(member)
    ? t("household.overview.you", { name: member.displayName })
    : member.displayName;

// Other members' emails are not visible to the user, so they get when they joined instead.
const memberSubtitle = (member: DeepReadonly<HouseholdMember>): string =>
  t("household.overview.subtitle", {
    role: t(member.role === "owner" ? "household.overview.roleOwner" : "household.overview.roleMember"),
    detail:
      (isCurrentUser(member) && user.value?.email) ||
      t("household.overview.joined", { date: d(new Date(member.joinedAt), { day: "numeric", month: "short" }) }),
  });

// The dialog keeps its kind and member while it closes, so its text does not change as it fades out.
const dialogKind = ref<DialogKind>("leave");
const dialogMember = ref<DeepReadonly<HouseholdMember> | null>(null);
const isDialogOpen = ref(false);
const isBusy = ref(false);

const dialogParams = computed(() => ({
  name: dialogMember.value?.displayName ?? "",
  household: props.household.name,
}));

function openDialog(kind: DialogKind, member: DeepReadonly<HouseholdMember> | null = null) {
  dialogKind.value = kind;
  dialogMember.value = member;
  isDialogOpen.value = true;
}

function handleLeave() {
  if (!hasOtherMembers.value) {
    openDialog("leaveLast");
    return;
  }
  // An owner cannot walk away from people who still depend on the household.
  openDialog(isOwner.value ? "blocked" : "leave");
}

async function runAction(kind: DialogKind): Promise<MemberActionResult> {
  const memberId = dialogMember.value?.userId ?? "";
  switch (kind) {
    case "remove":
      return removeMember(memberId);
    case "transfer":
      return transferOwnership(memberId);
    case "delete":
      return deleteHousehold();
    default:
      return leave();
  }
}

async function handleConfirm() {
  if (isBusy.value) {
    return;
  }

  // Not an action itself: it leads on to deleting.
  if (dialogKind.value === "blocked") {
    openDialog("delete");
    return;
  }

  const kind = dialogKind.value;
  isBusy.value = true;
  const result = await runAction(kind);
  isBusy.value = false;
  isDialogOpen.value = false;

  show(result.isDone ? (SUCCESS_KEY[kind] ?? "") : result.errorKey, result.isDone ? "success" : "error");
}
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
              <template v-if="isOwner && !isCurrentUser(member)" #append>
                <HouseholdMemberMenu
                  :member-name="member.displayName"
                  @make-owner="openDialog('transfer', member)"
                  @remove="openDialog('remove', member)"
                />
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </section>

    <HouseholdInviteCard />

    <section :class="$style.actions">
      <v-btn variant="outlined" color="error" size="large" block prepend-icon="mdi-logout" @click="handleLeave">
        {{ t("household.members.leave") }}
      </v-btn>
      <v-btn
        v-if="isOwner && hasOtherMembers"
        variant="text"
        color="error"
        size="large"
        block
        prepend-icon="mdi-delete-outline"
        @click="openDialog('delete')"
      >
        {{ t("household.members.delete") }}
      </v-btn>
    </section>

    <HouseholdConfirmDialog
      v-model="isDialogOpen"
      :icon="DIALOG_ICON[dialogKind]"
      :title="t(`household.members.dialog.${dialogKind}.title`, dialogParams)"
      :text="t(`household.members.dialog.${dialogKind}.text`, dialogParams)"
      :confirm-label="t(`household.members.dialog.${dialogKind}.confirm`)"
      :cancel-label="t(dialogKind === 'blocked' ? 'household.members.dialog.close' : 'household.members.dialog.cancel')"
      :is-busy="isBusy"
      @confirm="handleConfirm"
    />
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

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>

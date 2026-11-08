<script setup lang="ts">
import type { MealPlanSlot, SnackSettings } from "~/types/mealPlan.types";

defineOptions({ name: "PlanPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan, updateSnackSettings, updateParticipants, setSlotRecipe, loadHatedRecipes } = useMealPlans();
const { household, load: loadHousehold } = useHousehold();
const { recipes, loadFailed: recipesFailed, loadList: loadRecipes } = useRecipes();
const { show } = useAppSnackbar();
const user = useSupabaseUser();

const id = String(route.params.id);
// The household gives the participant picker its members, with their names and diets. The recipe library gives
// slots their names and the slot picker its choices; who hates what gives the picker its warnings (E3).
const [{ data: result, refresh: refreshPlan }, { data: hatedResult, refresh: refreshHated }] = await Promise.all([
  useAsyncData(`plan-${id}`, () => loadPlan(id)),
  useAsyncData(`plan-hated-${id}`, () => loadHatedRecipes(id)),
  callOnce("household", loadHousehold, { mode: "navigation" }),
  recipes.value ? undefined : loadRecipes(),
]);

const plan = computed(() => (result.value?.status === "found" ? result.value.plan : null));
const range = computed(() =>
  plan.value ? formatPlanRange(plan.value.startDate, plan.value.endDate, locale.value) : "",
);

useHead({ title: () => range.value || t("plan.pageTitle") });

const isSaving = ref(false);

// The switch follows the tap at once; if nothing was saved, the previous options come back.
async function saveSnacks(change: Partial<SnackSettings>) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  // useAsyncData data is a shallow ref, so the plan is replaced, not changed in place.
  result.value = { status: "found", plan: { ...current, ...change } };
  isSaving.value = true;
  const isSaved = await updateSnackSettings(current.id, change);
  isSaving.value = false;

  if (!isSaved) {
    result.value = { status: "found", plan: current };
    show("plan.snacks.saveFailed", "error");
  }
}

const includeSnacks = computed({
  get: () => plan.value?.includeSnacks ?? true,
  set: (value: boolean) => saveSnacks({ includeSnacks: value }),
});
const snacksOnList = computed({
  get: () => plan.value?.snacksOnList ?? true,
  set: (value: boolean) => saveSnacks({ snacksOnList: value }),
});

// Same pattern for the participants: the count follows the tap, and a refused save puts the old set back.
async function saveParticipants(participantIds: string[]) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  result.value = { status: "found", plan: { ...current, participantIds } };
  isSaving.value = true;
  const saved = await updateParticipants(current.id, participantIds);
  isSaving.value = false;

  if (!saved.isSaved) {
    result.value = { status: "found", plan: current };
    show(saved.errorKey, "error");
    // Someone left or was removed meanwhile, which also took them off this plan: show both as they are now.
    if (saved.errorKey === "plan.errors.participantNotMember") {
      await Promise.all([loadHousehold({ isSilent: true }), refreshPlan(), refreshHated()]);
    }
    return;
  }
  // The hate warnings follow who eats from the plan.
  await refreshHated();
}

const participantIds = computed({
  get: () => plan.value?.participantIds ?? [],
  set: (value: string[]) => saveParticipants(value),
});

// Slot picker (E3).
const viewerId = computed(() => user.value?.id ?? null);
const hated = computed(() => (hatedResult.value?.status === "loaded" ? hatedResult.value.hated : null));
const hatedFailed = computed(() => hatedResult.value?.status === "failed");
const members = computed(() =>
  (household.value?.members ?? []).map((member) => ({ userId: member.userId, displayName: member.displayName })),
);
// "for Ana, Monika" in the picker: household plans only, in the household's member order.
const participantNames = computed(() => {
  if (plan.value?.kind !== "household") {
    return [];
  }
  const ids = new Set(plan.value.participantIds);
  return members.value.filter((member) => ids.has(member.userId)).map((member) => member.displayName);
});
const planDays = computed(() => (plan.value ? getPlanDays(plan.value.startDate, plan.value.dayCount) : []));

const pickerSlotId = ref<string | null>(null);
const pickerSlot = computed(() => plan.value?.slots.find((slot) => slot.id === pickerSlotId.value) ?? null);
const isPickerOpen = ref(false);

function openPicker(slot: MealPlanSlot) {
  pickerSlotId.value = slot.id;
  isPickerOpen.value = true;
}

// The slot (and, for a batch, the same meal on the following days) changes at once; a refused save puts the
// previous plan back, as for snacks and participants.
async function saveSlot(recipeId: string | null, fillDays: number) {
  const current = plan.value;
  const slot = pickerSlot.value;
  if (!current || !slot || isSaving.value) {
    return;
  }

  const lastDay = slot.dayIndex + fillDays - 1;
  const slots = current.slots.map((candidate) =>
    candidate.mealType === slot.mealType && candidate.dayIndex >= slot.dayIndex && candidate.dayIndex <= lastDay
      ? { ...candidate, recipeId }
      : candidate,
  );
  result.value = { status: "found", plan: { ...current, slots } };
  isSaving.value = true;
  const saved = await setSlotRecipe(slot.id, recipeId, fillDays);
  isSaving.value = false;

  if (!saved.isSaved) {
    result.value = { status: "found", plan: current };
    show(saved.errorKey, "error");
    return;
  }

  isPickerOpen.value = false;
  show(recipeId === null ? "plan.slot.cleared" : fillDays > 1 ? "plan.slot.savedBatch" : "plan.slot.saved", "success");
}

const chooseRecipe = (recipeId: string, fillDays: number) => saveSlot(recipeId, fillDays);
const clearSlot = () => saveSlot(null, 1);
</script>

<template>
  <div :class="$style.page">
    <v-btn to="/plans" exact variant="text" prepend-icon="mdi-arrow-left" :class="$style.back" data-testid="plan-back">
      {{ t("plan.detail.back") }}
    </v-btn>

    <template v-if="plan">
      <header :class="$style.header">
        <span :class="$style.kind" data-testid="plan-kind-label">{{ t(`plan.kind.${plan.kind}`) }}</span>
        <h1 :class="$style.title" data-testid="plan-range">{{ range }}</h1>
      </header>

      <div :class="$style.layout">
        <div :class="$style.settings">
          <!-- Individual plans have one participant, their owner, so they show no picker. -->
          <PlanParticipantPicker
            v-if="plan.kind === 'household' && household"
            v-model="participantIds"
            :members="household.members"
            :disabled="isSaving"
          />
          <PlanSnackSettings
            v-model:include-snacks="includeSnacks"
            v-model:snacks-on-list="snacksOnList"
            :disabled="isSaving"
          />
        </div>
        <PlanDayList
          :plan="plan"
          :recipes="recipes"
          :hated="hated"
          :viewer-id="viewerId"
          :disabled="isSaving"
          :class="$style.days"
          @pick="openPicker"
        />
      </div>

      <PlanSlotPicker v-if="pickerSlot" v-model="isPickerOpen" :busy="isSaving">
        <PlanSlotPickerPanel
          :target="pickerSlot"
          :slots="plan.slots"
          :plan-days="planDays"
          :participant-names="participantNames"
          :recipes="recipes"
          :recipes-failed="recipesFailed"
          :hated="hated"
          :hated-failed="hatedFailed"
          :members="members"
          :viewer-id="viewerId"
          :disabled="isSaving"
          @choose="chooseRecipe"
          @clear="clearSlot"
          @close="isPickerOpen = false"
          @retry="loadRecipes"
        />
      </PlanSlotPicker>
    </template>
    <v-alert v-else-if="result?.status === 'not-found'" type="warning" variant="tonal" data-testid="plan-not-found">
      {{ t("plan.errors.notFound") }}
    </v-alert>
    <v-alert v-else type="error" variant="tonal" data-testid="plan-load-failed">
      {{ t("plan.errors.loadFailed") }}
    </v-alert>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.back {
  align-self: flex-start;
  min-height: 44px;
  margin-left: calc(-1 * var(--space-2));
}

.header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kind {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 960px is --breakpoint-md: the options sit beside the week instead of above it. */
@media (min-width: 960px) {
  .layout {
    flex-direction: row-reverse;
    align-items: flex-start;
  }

  .settings {
    flex: 0 0 320px;
  }

  .days {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>

<script setup lang="ts">
import type { GenerationMode } from "#shared/utils/mealPlan";
import type { MealPlanSlot, SnackSettings } from "~/types/mealPlan.types";

defineOptions({ name: "PlanPage" });

const { t, locale } = useI18n();
const route = useRoute();
const {
  loadPlan,
  updateSnackSettings,
  updateParticipants,
  setSlotRecipe,
  loadHatedRecipes,
  generate,
  swapSlot,
  setSlotsLocked,
  loadRecentRecipes,
} = useMealPlans();
const { household, load: loadHousehold } = useHousehold();
const { recipes, loadFailed: recipesFailed, loadList: loadRecipes } = useRecipes();
const { ratings, isLoaded: isRatingLoaded, load: loadRatings } = useRecipeRatings();
const { profile } = useProfile();
const { show } = useAppSnackbar();
const user = useSupabaseUser();
const today = useToday();

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

// A past plan is kept as it was (E6): it is shown, not changed. Current and upcoming plans can be edited.
const timeline = computed(() => (plan.value ? getPlanTimeline(plan.value.startDate, plan.value.endDate, today.value) : null));
const isReadOnly = computed(() => timeline.value === "past");
// "Household plan · 3 people", as in the week plan design; an individual plan is the owner's alone.
const kindLabel = computed(() => {
  if (!plan.value) {
    return "";
  }
  const kind = t(`plan.kind.${plan.value.kind}`);
  return plan.value.kind === "household"
    ? `${kind} · ${t("plan.detail.people", getPlanServings(plan.value.participantIds))}`
    : kind;
});

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
  // The hate warnings and recent recipes follow who eats from the plan.
  recentRecipes.value = null;
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

// The picker's filters (E6). "Enjoyed" knows the viewer's own ratings only: everyone else's are private.
const enjoyedRecipeIds = computed(() =>
  ratings.value
    ? new Set(Object.keys(ratings.value).filter((recipeId) => ratings.value?.[recipeId] === "enjoy"))
    : null,
);
// "Fits all diets": each participant's diet, from the household (household plans) or the owner's profile.
const participantDiets = computed(() => {
  if (!plan.value) {
    return null;
  }
  if (plan.value.kind === "individual") {
    return profile.value ? [profile.value.diet] : null;
  }
  if (!household.value) {
    return null;
  }
  const ids = new Set(plan.value.participantIds);
  return household.value.members.filter((member) => ids.has(member.userId)).map((member) => member.diet);
});
// "Not recent": read when the picker first opens, and again after the participants change. Null hides the filter.
const recentRecipes = shallowRef<Map<string, string> | null>(null);

function openPicker(slot: MealPlanSlot) {
  pickerSlotId.value = slot.id;
  isPickerOpen.value = true;
  const current = plan.value;
  if (current && recentRecipes.value === null) {
    loadRecentRecipes(current).then((recent) => {
      recentRecipes.value = recent;
    });
  }
  if (!isRatingLoaded.value) {
    loadRatings();
  }
}

// The slot (and, for a batch, the same meal on the following days) changes at once; a refused save puts the
// previous plan back, as for snacks and participants.
async function saveSlot(recipeId: string | null, fillDays: number) {
  const current = plan.value;
  const slot = pickerSlot.value;
  if (!current || !slot || isSaving.value) {
    return;
  }

  // A recipe chosen by hand is locked; an emptied slot is not (E5).
  const lastDay = slot.dayIndex + fillDays - 1;
  const slots = current.slots.map((candidate) =>
    candidate.mealType === slot.mealType && candidate.dayIndex >= slot.dayIndex && candidate.dayIndex <= lastDay
      ? { ...candidate, recipeId, isLocked: recipeId !== null, fillNote: null }
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

// Swap (E5): another recipe the generator's rules allow, for the slot in the picker and its batch's other days. The
// picker stays open on the new choice, so the user can swap again.
const isSwapping = ref(false);

async function swapPickerSlot() {
  const current = plan.value;
  const slot = pickerSlot.value;
  if (!current || !slot || isSaving.value) {
    return;
  }

  isSaving.value = true;
  isSwapping.value = true;
  const swapped = await swapSlot(current.id, slot.id);
  await refreshPlan();
  isSwapping.value = false;
  isSaving.value = false;

  if (swapped.isSwapped) {
    show("plan.swap.done", "success");
  } else {
    show(swapped.errorKey, "error");
  }
}

// Lock (E5): a locked slot keeps its recipe when the plan is regenerated. The days of a batch lock together. The
// icon follows the tap at once; a refused save puts the previous plan back.
async function toggleLock(slot: MealPlanSlot) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  const isLocked = !slot.isLocked;
  const slotIds = new Set(getBatchSlots(current.slots, recipes.value ?? [], slot).map((batchSlot) => batchSlot.id));
  const slots = current.slots.map((candidate) => (slotIds.has(candidate.id) ? { ...candidate, isLocked } : candidate));
  result.value = { status: "found", plan: { ...current, slots } };
  isSaving.value = true;
  const saved = await setSlotsLocked([...slotIds], isLocked);
  isSaving.value = false;

  if (!saved.isSaved) {
    result.value = { status: "found", plan: current };
    show(saved.errorKey, "error");
  }
}

// Generation (E4): fills the empty slots the plan shows; a recipe already chosen stays. Offered while any is empty.
// "Regenerate unlocked" (E5) replaces every generated recipe that is not locked; offered while there is one.
const visibleSlots = computed(() => {
  const mealTypes = getVisibleMealTypes(plan.value?.includeSnacks ?? true);
  return (plan.value?.slots ?? []).filter((slot) => mealTypes.includes(slot.mealType));
});
const hasEmptySlots = computed(() => visibleSlots.value.some((slot) => slot.recipeId === null));
const isPlanEmpty = computed(() => visibleSlots.value.every((slot) => slot.recipeId === null));
const canRegenerate = computed(
  () => !isReadOnly.value && visibleSlots.value.some((slot) => slot.recipeId !== null && !slot.isLocked),
);
const generatingMode = ref<GenerationMode | null>(null);

async function generatePlan(mode: GenerationMode) {
  const current = plan.value;
  if (!current || isSaving.value) {
    return;
  }

  isSaving.value = true;
  generatingMode.value = mode;
  const generated = await generate(current.id, mode);
  // Also after "someone changed the plan meanwhile": the page shows what is there now.
  await refreshPlan();
  generatingMode.value = null;
  isSaving.value = false;

  if (generated.isGenerated) {
    show(getGenerationDoneKey(generated.summary, mode), "success");
  } else {
    show(generated.errorKey, "error");
  }
}
</script>

<template>
  <div :class="[$style.page, { [$style.withFab]: canRegenerate }]">
    <v-btn to="/plans" exact variant="text" prepend-icon="mdi-arrow-left" :class="$style.back" data-testid="plan-back">
      {{ t("plan.detail.back") }}
    </v-btn>

    <template v-if="plan">
      <header :class="$style.header">
        <div :class="$style.heading">
          <span :class="$style.kind" data-testid="plan-kind-label">{{ kindLabel }}</span>
          <h1 :class="$style.title">
            <span data-testid="plan-range">{{ range }}</span>
            <v-chip
              v-if="timeline"
              size="small"
              label
              variant="tonal"
              :color="timeline === 'past' ? undefined : 'primary'"
              :class="$style.status"
              data-testid="plan-status"
            >
              {{ t(`plan.status.${timeline}`) }}
            </v-chip>
          </h1>
        </div>
        <!-- A floating button above the navigation on phones, beside the title from 960px. -->
        <v-btn
          v-if="canRegenerate"
          color="primary"
          size="large"
          rounded="pill"
          prepend-icon="mdi-auto-fix"
          :loading="generatingMode === 'regenerate_unlocked'"
          :disabled="isSaving"
          :class="$style.regenerate"
          data-testid="plan-regenerate"
          @click="generatePlan('regenerate_unlocked')"
        >
          {{ t("plan.regenerate.action") }}
        </v-btn>
      </header>

      <v-alert v-if="isReadOnly" type="info" variant="tonal" density="compact" data-testid="plan-past-notice">
        {{ t("plan.detail.pastNotice") }}
      </v-alert>

      <v-btn
        v-if="hasEmptySlots && !isReadOnly"
        color="primary"
        size="large"
        prepend-icon="mdi-auto-fix"
        :loading="generatingMode === 'fill_empty'"
        :disabled="isSaving"
        :class="$style.generate"
        data-testid="plan-fill"
        @click="generatePlan('fill_empty')"
      >
        {{ isPlanEmpty ? t("plan.generate.action") : t("plan.generate.fillEmpty") }}
      </v-btn>

      <div :class="$style.layout">
        <div :class="$style.settings">
          <!-- Individual plans have one participant, their owner, so they show no picker. -->
          <PlanParticipantPicker
            v-if="plan.kind === 'household' && household"
            v-model="participantIds"
            :members="household.members"
            :disabled="isSaving || isReadOnly"
          />
          <PlanSnackSettings
            v-model:include-snacks="includeSnacks"
            v-model:snacks-on-list="snacksOnList"
            :disabled="isSaving || isReadOnly"
          />
        </div>
        <!-- The day list on phones, the week grid from 960px (E6). -->
        <PlanDayList
          :plan="plan"
          :recipes="recipes"
          :hated="hated"
          :disabled="isSaving"
          :is-read-only="isReadOnly"
          :class="$style.dayList"
          @pick="openPicker"
          @toggle-lock="toggleLock"
        />
        <PlanWeekGrid
          :plan="plan"
          :recipes="recipes"
          :hated="hated"
          :disabled="isSaving"
          :is-read-only="isReadOnly"
          :class="$style.weekGrid"
          @pick="openPicker"
          @toggle-lock="toggleLock"
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
          :enjoyed-recipe-ids="enjoyedRecipeIds"
          :participant-diets="participantDiets"
          :recent-recipes="recentRecipes"
          :disabled="isSaving"
          :is-swapping="isSwapping"
          @choose="chooseRecipe"
          @clear="clearSlot"
          @swap="swapPickerSlot"
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

.withFab {
  /* Room below the last day for the floating "Regenerate unlocked" button. */
  padding-bottom: 72px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.regenerate {
  position: fixed;
  right: var(--space-3);
  bottom: calc(var(--nav-height) + var(--space-3) + env(safe-area-inset-bottom, 0px));
  z-index: 5;
  text-transform: none;
}

.kind {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.status {
  font-size: 12px;
  font-weight: 600;
}

.generate {
  align-self: flex-start;
  text-transform: none;
}

/* The week comes first, as in the week plan design; the plan's options follow it. */
.layout {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-4);
}

.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.weekGrid {
  display: none;
}

/* 960px is --breakpoint-md: the week becomes a grid, and the options sit side by side below it. */
@media (min-width: 960px) {
  .withFab {
    padding-bottom: 0;
  }

  /* Relative, as Vuetify's ripple makes a static button relative on press: the phone offsets must not apply. */
  .regenerate {
    position: relative;
    right: auto;
    bottom: auto;
    flex: 0 0 auto;
  }

  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    align-items: start;
  }

  .dayList {
    display: none;
  }

  .weekGrid {
    display: flex;
  }
}
</style>

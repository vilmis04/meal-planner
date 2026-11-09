import type { DeepReadonly, MaybeRefOrGetter } from "vue";
import type { HatedRecipes, MealPlan, MealPlanSlot } from "~/types/mealPlan.types";
import type { RecipeSummary } from "~/types/recipe.types";
import type { BatchJoins, BatchTone, PlanWeekDay } from "~/types/planWeek.types";

// What the plan's day list (phones) and week grid (from 960px) both show of a plan (E4 to E6): each day with its
// visible slots, recipe names, batch lines and the labels a screen reader hears.
export function usePlanWeek(
  plan: MaybeRefOrGetter<MealPlan>,
  recipes: MaybeRefOrGetter<DeepReadonly<RecipeSummary[]> | null>,
  hated: MaybeRefOrGetter<HatedRecipes | null>,
) {
  const { t, locale } = useI18n();
  const today = useToday();

  const recipeNames = computed(() => new Map((toValue(recipes) ?? []).map((recipe) => [recipe.id, recipe.name])));
  const planDays = computed(() => getPlanDays(toValue(plan).startDate, toValue(plan).dayCount));
  const visibleSlots = computed(() => {
    const mealTypes = getVisibleMealTypes(toValue(plan).includeSnacks);
    return toValue(plan).slots.filter((slot) => mealTypes.includes(slot.mealType));
  });
  // Slot id → its place in a batch, for "Day 1 of 2 · covers Wed" (E4). Skipped snacks are not part of the week.
  const batchDays = computed(() => getBatchDays(visibleSlots.value, toValue(recipes) ?? []));
  // A day on which a batch is cooked, the first of its days: "Cook tonight" (E6).
  const cookingDayIndexes = computed(
    () =>
      new Set(
        [...batchDays.value.values()].filter((batchDay) => batchDay.dayNumber === 1).map((batch) => batch.firstDayIndex),
      ),
  );

  const days = computed<PlanWeekDay[]>(() =>
    planDays.value.map((date, dayIndex) => ({
      date,
      dayIndex,
      isToday: date === today.value,
      isWorkday: toValue(plan).workdays.includes(getIsoWeekday(date)),
      isCookingDay: cookingDayIndexes.value.has(dayIndex),
      weekday: formatPlanDay(date, locale.value, { weekday: "long" }),
      shortWeekday: formatShortWeekday(date, locale.value),
      day: formatPlanDay(date, locale.value, { day: "numeric", month: "short" }),
      dayOfMonth: formatPlanDay(date, locale.value, { day: "numeric" }),
      slots: visibleSlots.value.filter((slot) => slot.dayIndex === dayIndex),
    })),
  );

  const getShortWeekday = (dayIndex: number): string => days.value[dayIndex]?.shortWeekday ?? "";

  // "Day 1 of 2 · covers Wed" in the day list; "Cook · covers Wed" and "Day 2 · cooked Mon" in the narrower grid.
  const getBatchLine = (slotId: string, { isShort = false }: { isShort?: boolean } = {}): string | null => {
    const batchDay = batchDays.value.get(slotId);
    if (!batchDay) {
      return null;
    }
    const isCookingDay = batchDay.dayNumber === 1;
    if (isShort) {
      return isCookingDay
        ? t("plan.batch.cookCovers", { day: getShortWeekday(batchDay.lastDayIndex) })
        : t("plan.batch.dayCooked", { day: batchDay.dayNumber, cooked: getShortWeekday(batchDay.firstDayIndex) });
    }
    const position = t("plan.batch.position", { day: batchDay.dayNumber, count: batchDay.dayCount });
    const detail = isCookingDay
      ? t("plan.batch.covers", { day: getShortWeekday(batchDay.lastDayIndex) })
      : t("plan.batch.cooked", { day: getShortWeekday(batchDay.firstDayIndex) });
    return `${position} · ${detail}`;
  };

  // Every other batch of a meal has the second tint, so two batches side by side never read as one (E6).
  const getBatchTone = (slotId: string): BatchTone | null => {
    const batchDay = batchDays.value.get(slotId);
    if (!batchDay) {
      return null;
    }
    return batchDay.batchNumber % 2 === 0 ? "primary" : "secondary";
  };

  // Whether the day before and the day after are days of the same batch, so the grid draws them joined.
  const getBatchJoins = (slotId: string): BatchJoins => {
    const batchDay = batchDays.value.get(slotId);
    return {
      hasPrevious: Boolean(batchDay && batchDay.dayNumber > 1),
      hasNext: Boolean(batchDay && batchDay.dayNumber < batchDay.dayCount),
    };
  };

  // A recipe deleted from the library empties its slots; one missing here only means the list did not load.
  const getRecipeName = (recipeId: string): string => recipeNames.value.get(recipeId) ?? t("plan.slot.unknownRecipe");

  // The same "hate" warning as the picker, as an icon on a filled slot.
  const isHated = (recipeId: string | null): boolean => Boolean(recipeId && toValue(hated)?.[recipeId]?.length);

  // The button's name says everything the slot shows: what it holds, its batch and the generator's note.
  const getSlotLabel = (slot: MealPlanSlot, weekday: string): string => {
    const open = t("plan.slot.open", {
      meal: t(`recipes.mealType.${slot.mealType}`),
      day: weekday,
      recipe: slot.recipeId ? getRecipeName(slot.recipeId) : t("plan.detail.emptySlot"),
    });
    const note = slot.fillNote ? t(`plan.fillNote.${slot.fillNote}`) : null;
    const lock = slot.isLocked ? t("plan.lock.locked") : null;
    return [open, getBatchLine(slot.id), note, lock].filter((part) => part !== null).join(". ");
  };

  // "Lock lunch on Monday" / "Unlock lunch on Monday" (E5). A batch locks with its other days.
  const getLockLabel = (slot: MealPlanSlot, weekday: string): string =>
    t(slot.isLocked ? "plan.lock.unlock" : "plan.lock.lock", {
      meal: t(`recipes.mealType.${slot.mealType}`),
      day: weekday,
    });

  return {
    days,
    getBatchLine,
    getBatchTone,
    getBatchJoins,
    getRecipeName,
    isHated,
    getSlotLabel,
    getLockLabel,
  };
}

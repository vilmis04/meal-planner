import { z } from "zod";

// Who eats from a plan comes with it everywhere: the list and the home card tell a household plan the viewer left for
// the week from their own plan beside it (E7).
export const MEAL_PLAN_COLUMNS =
  "id, kind, start_date, day_count, include_snacks, snacks_on_list, created_at, schedule_id, meal_plan_participants(user_id)";
export const MEAL_PLAN_DETAIL_COLUMNS = `${MEAL_PLAN_COLUMNS}, workdays, cooldown_days, meal_plan_slots(id, day_index, meal_type, recipe_id, fill_note, is_locked)`;
// What the slot picker's "Not recent" filter (E6) reads of the plans before this one.
export const MEAL_PLAN_HISTORY_COLUMNS =
  "id, start_date, include_snacks, meal_plan_slots(day_index, meal_type, recipe_id), meal_plan_participants(user_id)";

// The plan list (E6): every current and upcoming plan, up to this many, and past plans a page at a time.
export const ACTIVE_MEAL_PLAN_LIMIT = 50;
export const PAST_MEAL_PLAN_PAGE_SIZE = 10;

export const mealPlanIdSchema = z.guid();

const mealPlanRowShape = {
  id: z.guid(),
  kind: z.enum(PLAN_KINDS),
  start_date: z.string().refine(isIsoDate),
  day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
  include_snacks: z.boolean(),
  snacks_on_list: z.boolean(),
  created_at: z.string(),
  // The schedule that made the plan (H2); null for a plan made by hand.
  schedule_id: z.guid().nullable(),
  meal_plan_participants: z.array(z.object({ user_id: z.guid() })),
};

type MealPlanRow = z.output<z.ZodObject<typeof mealPlanRowShape>>;

const toMealPlan = (row: MealPlanRow) => ({
  id: row.id,
  kind: row.kind,
  startDate: row.start_date,
  dayCount: row.day_count,
  endDate: getPlanEndDate(row.start_date, row.day_count),
  includeSnacks: row.include_snacks,
  snacksOnList: row.snacks_on_list,
  createdAt: row.created_at,
  isCreatedAutomatically: row.schedule_id !== null,
  participantIds: row.meal_plan_participants.map((participant) => participant.user_id),
});

export const mealPlanListRowsSchema = z.array(z.object(mealPlanRowShape)).transform((rows) => rows.map(toMealPlan));

const slotRowSchema = z.object({
  id: z.guid(),
  day_index: z.number().int().min(0),
  meal_type: z.enum(MEAL_TYPES),
  recipe_id: z.guid().nullable(),
  // Why the generator left the slot empty or compromised (E4). SLOT_FILL_NOTES is in shared/utils/planGenerator.ts.
  fill_note: z.enum(SLOT_FILL_NOTES).nullable(),
  is_locked: z.boolean(),
});

// meal_plan_hated_recipes() (E3): who hates which recipe, grouped by recipe id → user ids.
export const hatedRecipeRowsSchema = z
  .array(z.object({ recipe_id: z.guid(), user_id: z.guid() }))
  .transform((rows) => groupHatedRecipes(rows.map((row) => ({ recipeId: row.recipe_id, userId: row.user_id }))));

// Slots come back in no particular order: they are sorted by day, then in meal order.
export const mealPlanDetailRowSchema = z
  .object({
    ...mealPlanRowShape,
    workdays: z.array(z.number().int()),
    cooldown_days: z.number().int().min(0).max(COOLDOWN_DAYS_MAX),
    meal_plan_slots: z.array(slotRowSchema),
  })
  .transform((row) => ({
    ...toMealPlan(row),
    workdays: normalizeWorkdays(row.workdays),
    cooldownDays: row.cooldown_days,
    slots: row.meal_plan_slots
      .map((slot) => ({
        id: slot.id,
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
        fillNote: slot.fill_note,
        // Regenerate and swap keep it (E5). A slot whose recipe was deleted is open again, as on the server.
        isLocked: slot.is_locked && slot.recipe_id !== null,
      }))
      .sort(
        (a, b) => a.dayIndex - b.dayIndex || MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType),
      ),
  }));

// Plans before the one being edited, for getRecentlyPlannedRecipes() in shared/utils/slotPicker.ts.
export const mealPlanHistoryRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      start_date: z.string().refine(isIsoDate),
      include_snacks: z.boolean(),
      meal_plan_slots: z.array(
        z.object({ day_index: z.number().int().min(0), meal_type: z.enum(MEAL_TYPES), recipe_id: z.guid().nullable() }),
      ),
      meal_plan_participants: z.array(z.object({ user_id: z.guid() })),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      startDate: row.start_date,
      includeSnacks: row.include_snacks,
      participantIds: row.meal_plan_participants.map((participant) => participant.user_id),
      slots: row.meal_plan_slots.map((slot) => ({
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
      })),
    })),
  );

const generationCountsShape = {
  filledCount: z.number().int().min(0),
  emptyCount: z.number().int().min(0),
  compromisedCount: z.number().int().min(0),
};

// POST /api/plans/:id/generate (E4, E5). The 409 answers say why nothing was written.
export const generatePlanResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("generated"), ...generationCountsShape }),
  z.object({ status: z.enum(["nothing-to-fill", "all-locked", "no-participants", "plan-changed"]) }),
]);

// POST /api/plans/:id/slots/:slotId/swap (E5).
export const swapSlotResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("swapped"), ...generationCountsShape }),
  z.object({ status: z.enum(["slot-locked", "no-alternative", "no-participants", "plan-changed"]) }),
]);

import { z } from "zod";

export const MEAL_PLAN_COLUMNS = "id, kind, start_date, day_count, include_snacks, snacks_on_list, created_at";
export const MEAL_PLAN_DETAIL_COLUMNS = `${MEAL_PLAN_COLUMNS}, workdays, meal_plan_slots(id, day_index, meal_type, recipe_id, fill_note), meal_plan_participants(user_id)`;

// The plan list shows the newest plans first; E6 replaces it with the week view and history.
export const MEAL_PLAN_LIST_LIMIT = 50;

export const mealPlanIdSchema = z.guid();

const mealPlanRowShape = {
  id: z.guid(),
  kind: z.enum(PLAN_KINDS),
  start_date: z.string().refine(isIsoDate),
  day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
  include_snacks: z.boolean(),
  snacks_on_list: z.boolean(),
  created_at: z.string(),
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
});

export const mealPlanListRowsSchema = z.array(z.object(mealPlanRowShape)).transform((rows) => rows.map(toMealPlan));

const slotRowSchema = z.object({
  id: z.guid(),
  day_index: z.number().int().min(0),
  meal_type: z.enum(MEAL_TYPES),
  recipe_id: z.guid().nullable(),
  // Why the generator left the slot empty or compromised (E4). SLOT_FILL_NOTES is in shared/utils/planGenerator.ts.
  fill_note: z.enum(SLOT_FILL_NOTES).nullable(),
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
    meal_plan_slots: z.array(slotRowSchema),
    meal_plan_participants: z.array(z.object({ user_id: z.guid() })),
  })
  .transform((row) => ({
    ...toMealPlan(row),
    workdays: normalizeWorkdays(row.workdays),
    participantIds: row.meal_plan_participants.map((participant) => participant.user_id),
    slots: row.meal_plan_slots
      .map((slot) => ({
        id: slot.id,
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
        fillNote: slot.fill_note,
      }))
      .sort(
        (a, b) => a.dayIndex - b.dayIndex || MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType),
      ),
  }));

// POST /api/plans/:id/generate (E4). The 409 answers say why nothing was written.
export const generatePlanResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("generated"),
    filledCount: z.number().int().min(0),
    emptyCount: z.number().int().min(0),
    compromisedCount: z.number().int().min(0),
  }),
  z.object({ status: z.enum(["nothing-to-fill", "no-participants", "plan-changed"]) }),
]);

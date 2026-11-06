import { z } from "zod";

export const MEAL_PLAN_COLUMNS = "id, kind, start_date, day_count, include_snacks, snacks_on_list, created_at";
export const MEAL_PLAN_DETAIL_COLUMNS = `${MEAL_PLAN_COLUMNS}, meal_plan_slots(id, day_index, meal_type, recipe_id), meal_plan_participants(user_id)`;

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
});

// Slots come back in no particular order: they are sorted by day, then in meal order.
export const mealPlanDetailRowSchema = z
  .object({
    ...mealPlanRowShape,
    meal_plan_slots: z.array(slotRowSchema),
    meal_plan_participants: z.array(z.object({ user_id: z.guid() })),
  })
  .transform((row) => ({
    ...toMealPlan(row),
    participantIds: row.meal_plan_participants.map((participant) => participant.user_id),
    slots: row.meal_plan_slots
      .map((slot) => ({
        id: slot.id,
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
      }))
      .sort(
        (a, b) => a.dayIndex - b.dayIndex || MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType),
      ),
  }));

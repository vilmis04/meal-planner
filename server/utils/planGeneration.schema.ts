/*
 * Rows the plan generator reads, as Supabase returns them, parsed into the generator's shapes.
 */
import { z } from "zod";
import { DIETS, PROTEINS } from "../../shared/utils/diet";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import { COOLDOWN_DAYS_MAX, PLAN_DAY_COUNT_MAX, PLAN_DAY_COUNT_MIN, PLAN_KINDS, WEEKDAYS, isIsoDate } from "../../shared/utils/mealPlan";
import { RECIPE_RATINGS } from "../../shared/utils/recipeRating";
import { SEED_LIMIT } from "../../shared/utils/seededRandom";
import type { StoredPlan } from "./planGenerationStore.types";

export const GENERATION_PLAN_COLUMNS =
  "id, kind, start_date, day_count, include_snacks, workdays, cooldown_days, meal_plan_slots(day_index, meal_type, recipe_id)";
export const GENERATION_RECIPE_COLUMNS = "id, meal_type, portion_days, main_proteins";

const isoDateSchema = z.string().refine(isIsoDate);

export const generationPlanRowSchema = z
  .object({
    id: z.guid(),
    kind: z.enum(PLAN_KINDS),
    start_date: isoDateSchema,
    day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
    include_snacks: z.boolean(),
    workdays: z.array(z.number().int().refine((weekday) => (WEEKDAYS as readonly number[]).includes(weekday))),
    cooldown_days: z.number().int().min(0).max(COOLDOWN_DAYS_MAX),
    meal_plan_slots: z.array(
      z.object({ day_index: z.number().int().min(0), meal_type: z.enum(MEAL_TYPES), recipe_id: z.guid().nullable() }),
    ),
  })
  .transform(
    (row): StoredPlan => ({
      id: row.id,
      kind: row.kind,
      startDate: row.start_date,
      dayCount: row.day_count,
      includeSnacks: row.include_snacks,
      workdays: row.workdays,
      cooldownDays: row.cooldown_days,
      slots: row.meal_plan_slots.map((slot) => ({
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
      })),
    }),
  );

export const generationRecipeRowSchema = z
  .object({
    id: z.guid(),
    meal_type: z.enum(MEAL_TYPES),
    portion_days: z.number().int().min(1),
    main_proteins: z.array(z.enum(PROTEINS)),
  })
  .transform((row) => ({
    id: row.id,
    mealType: row.meal_type,
    portionDays: row.portion_days,
    mainProteins: row.main_proteins,
  }));

export const swapDietRowSchema = z.object({ recipe_id: z.guid(), diet: z.enum(DIETS) });

export const participantRowsSchema = z.array(z.object({ user_id: z.guid(), diet: z.enum(DIETS) }));

export const ratingRowsSchema = z.array(
  z.object({ user_id: z.guid(), recipe_id: z.guid(), rating: z.enum(RECIPE_RATINGS) }),
);

export const historyRowsSchema = z
  .array(z.object({ recipe_id: z.guid(), last_planned_on: isoDateSchema }))
  .transform((rows) => rows.map((row) => ({ recipeId: row.recipe_id, lastPlannedOn: row.last_planned_on })));

// POST /api/plans/:id/generate. Kept here because every file under server/api is a route.
export const generateRouteParamsSchema = z.object({ id: z.guid() });
// A seed reproduces a generation (it is logged with every one); without it the server picks one.
export const generateRequestBodySchema = z
  .object({ seed: z.number().int().min(0).max(SEED_LIMIT - 1).optional() })
  .nullish()
  .transform((body) => body ?? {});

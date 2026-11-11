/*
 * Rows the plan generator reads, as Supabase returns them, parsed into the generator's shapes.
 */
import { z } from "zod";
import { DIETS, PROTEINS } from "../../shared/utils/diet";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import {
  COOLDOWN_DAYS_MAX,
  GENERATION_MODES,
  PLAN_DAY_COUNT_MAX,
  PLAN_DAY_COUNT_MIN,
  PLAN_KINDS,
  WEEKDAYS,
  isIsoDate,
} from "../../shared/utils/mealPlan";
import { planConstraintsSchema } from "../../shared/utils/planAdjustment.schema";
import { RECIPE_RATINGS } from "../../shared/utils/recipeRating";
import { SEED_LIMIT } from "../../shared/utils/seededRandom";
import type { StoredPlan } from "./planGenerationStore.types";

export const GENERATION_PLAN_COLUMNS =
  "id, kind, start_date, day_count, include_snacks, workdays, cooldown_days, meal_plan_slots(id, day_index, meal_type, recipe_id, is_locked)";
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
      z.object({
        id: z.guid(),
        day_index: z.number().int().min(0),
        meal_type: z.enum(MEAL_TYPES),
        recipe_id: z.guid().nullable(),
        is_locked: z.boolean(),
      }),
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
        id: slot.id,
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        recipeId: slot.recipe_id,
        isLocked: slot.is_locked,
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

export const ingredientAliasRowsSchema = z.array(z.object({ item: z.string(), ingredient_id: z.guid() }));

export const recipeIngredientUseRowsSchema = z.array(z.object({ recipe_id: z.guid(), item: z.string() }));

// POST /api/plans/:id/generate and POST /api/plans/:id/slots/:slotId/swap. Kept here because every file under
// server/api is a route.
export const generateRouteParamsSchema = z.object({ id: z.guid() });
export const slotSwapRouteParamsSchema = z.object({ id: z.guid(), slotId: z.guid() });

// A seed reproduces a generation (it is logged with every one); without it the server picks one.
const seedSchema = z.number().int().min(0).max(SEED_LIMIT - 1).optional();

// Without a mode only the empty slots are filled, as in E4. constraints are a plan adjustment the user confirmed (I3).
export const generateRequestBodySchema = z
  .object({ seed: seedSchema, mode: z.enum(GENERATION_MODES).optional(), constraints: planConstraintsSchema.optional() })
  .nullish()
  .transform((body) => body ?? {});
export const slotSwapRequestBodySchema = z
  .object({ seed: seedSchema })
  .nullish()
  .transform((body) => body ?? {});

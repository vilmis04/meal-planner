import { z } from "zod";
import { PROTEINS } from "./diet";
import { MEAL_TYPES } from "./mealFilter";
import { PLAN_DAY_COUNT_MAX } from "./mealPlan";
import { BATCH_MEAL_TYPES } from "./planGenerator";

// At most this many rules of each kind, and of things the AI could not apply: a request is one or two sentences.
const PLAN_CONSTRAINT_RULES_MAX = 10;
export const PLAN_ADJUSTMENT_UNSUPPORTED_MAX = 5;
export const PLAN_ADJUSTMENT_UNSUPPORTED_MAX_LENGTH = 200;
const INGREDIENT_NAME_MAX_LENGTH = 120;

// Null: every day of the plan, or every meal type it shows.
const dayIndexesSchema = z
  .array(z.number().int().min(0).max(PLAN_DAY_COUNT_MAX - 1))
  .min(1)
  .max(PLAN_DAY_COUNT_MAX)
  .nullable();
const mealTypesSchema = z.array(z.enum(MEAL_TYPES)).min(1).max(MEAL_TYPES.length).nullable();

// The constraints the generator applies (I3), as the interpretation answers them and the generate route takes them back
// once the user confirmed them. Nothing in here names a slot or a recipe: the generator decides those.
export const planConstraintsSchema = z.object({
  excludedProteins: z
    .array(z.object({ protein: z.enum(PROTEINS), dayIndexes: dayIndexesSchema, mealTypes: mealTypesSchema }))
    .max(PLAN_CONSTRAINT_RULES_MAX),
  excludedIngredients: z
    .array(
      z.object({
        ingredientId: z.guid(),
        // For showing the rule only; the generator goes by the id.
        ingredientName: z.string().trim().min(1).max(INGREDIENT_NAME_MAX_LENGTH),
        dayIndexes: dayIndexesSchema,
        mealTypes: mealTypesSchema,
      }),
    )
    .max(PLAN_CONSTRAINT_RULES_MAX),
  quickMeals: z
    .array(
      z.object({
        dayIndexes: dayIndexesSchema,
        mealTypes: z.array(z.enum(BATCH_MEAL_TYPES)).min(1).max(BATCH_MEAL_TYPES.length).nullable(),
      }),
    )
    .max(PLAN_CONSTRAINT_RULES_MAX),
});

// An interpreted request: the constraints, and the parts of the request they do not cover, in the user's words.
export const planAdjustmentSchema = z.object({
  constraints: planConstraintsSchema,
  unsupported: z
    .array(z.string().min(1).max(PLAN_ADJUSTMENT_UNSUPPORTED_MAX_LENGTH))
    .max(PLAN_ADJUSTMENT_UNSUPPORTED_MAX),
});

// The AI's answer as validatePlanAdjustment() parses it (snake_case, like the JSON schema below). Days and meal types
// are checked against the plan there, so a wrong one is reported back to the model instead of failing the parse.
const responseScopeShape = {
  day_indexes: z.array(z.number().int()).max(PLAN_DAY_COUNT_MAX).nullable(),
  meal_types: z.array(z.enum(MEAL_TYPES)).max(MEAL_TYPES.length).nullable(),
};

export const planAdjustmentResponseSchema = z.object({
  excluded_proteins: z
    .array(z.object({ protein: z.enum(PROTEINS), ...responseScopeShape }))
    .max(PLAN_CONSTRAINT_RULES_MAX),
  excluded_ingredients: z
    .array(z.object({ ingredient: z.string().max(INGREDIENT_NAME_MAX_LENGTH), ...responseScopeShape }))
    .max(PLAN_CONSTRAINT_RULES_MAX),
  quick_meals: z
    .array(
      z.object({
        day_indexes: responseScopeShape.day_indexes,
        meal_types: z.array(z.enum(BATCH_MEAL_TYPES)).max(BATCH_MEAL_TYPES.length).nullable(),
      }),
    )
    .max(PLAN_CONSTRAINT_RULES_MAX),
  unsupported: z.array(z.string()).max(PLAN_ADJUSTMENT_UNSUPPORTED_MAX),
});

const RESPONSE_SCOPE_JSON_SCHEMA = {
  day_indexes: { type: "ARRAY", nullable: true, items: { type: "INTEGER" } },
  meal_types: { type: "ARRAY", nullable: true, items: { type: "STRING", enum: [...MEAL_TYPES] } },
} as const;

// The same shape for the AI's structured output (OpenAPI subset, as Gemini's responseSchema takes it).
export const PLAN_ADJUSTMENT_RESPONSE_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    excluded_proteins: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { protein: { type: "STRING", enum: [...PROTEINS] }, ...RESPONSE_SCOPE_JSON_SCHEMA },
        required: ["protein", "day_indexes", "meal_types"],
      },
    },
    excluded_ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { ingredient: { type: "STRING" }, ...RESPONSE_SCOPE_JSON_SCHEMA },
        required: ["ingredient", "day_indexes", "meal_types"],
      },
    },
    quick_meals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          day_indexes: RESPONSE_SCOPE_JSON_SCHEMA.day_indexes,
          meal_types: { type: "ARRAY", nullable: true, items: { type: "STRING", enum: [...BATCH_MEAL_TYPES] } },
        },
        required: ["day_indexes", "meal_types"],
      },
    },
    unsupported: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["excluded_proteins", "excluded_ingredients", "quick_meals", "unsupported"],
} as const;

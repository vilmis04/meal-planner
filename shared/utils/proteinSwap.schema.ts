import { z } from "zod";
import { PROTEINS } from "./diet";

const proteinSchema = z.enum(PROTEINS);
const nullableNumber = z.number().finite().nullable();

// The AI's answer as validateSwap() parses it (snake_case, like the JSON schema below).
export const swapResponseSchema = z.object({
  swaps: z
    .array(
      z.object({
        position: z.number().int(),
        original_protein: proteinSchema,
        item: z.string(),
        amount: nullableNumber,
        unit: z.string().nullable(),
        replacement_protein: proteinSchema,
      }),
    )
    .min(1),
  note: z.string().nullable(),
  nutrition: z
    .object({
      calories_kcal: nullableNumber,
      carbohydrates: nullableNumber,
      protein: nullableNumber,
      fat: nullableNumber,
    })
    .nullable(),
});

// The same shape for the AI's structured output (OpenAPI subset, as Gemini's responseSchema takes it).
export const SWAP_RESPONSE_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    swaps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          position: { type: "INTEGER" },
          original_protein: { type: "STRING", enum: [...PROTEINS] },
          item: { type: "STRING" },
          amount: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          replacement_protein: { type: "STRING", enum: [...PROTEINS] },
        },
        required: ["position", "original_protein", "item", "amount", "unit", "replacement_protein"],
      },
    },
    note: { type: "STRING", nullable: true },
    nutrition: {
      type: "OBJECT",
      nullable: true,
      properties: {
        calories_kcal: { type: "NUMBER", nullable: true },
        carbohydrates: { type: "NUMBER", nullable: true },
        protein: { type: "NUMBER", nullable: true },
        fat: { type: "NUMBER", nullable: true },
      },
      required: ["calories_kcal", "carbohydrates", "protein", "fat"],
    },
  },
  required: ["swaps", "note", "nutrition"],
} as const;

import { z } from "zod";
import { pickTranslation } from "#shared/utils/contentTranslation";
import type { IngredientNameEntry } from "~/types/ingredientName.types";

// Canonical ingredients (G1) with their names in every language (X1b), for shopping lists and plan adjustments.
export const INGREDIENT_NAME_COLUMNS = "id, name, ingredient_translations(locale, name)";

// Rows asked for per request; Supabase answers at most 1000 per request by default.
export const INGREDIENT_PAGE_SIZE = 1000;

export const ingredientNameRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      name: z.string(),
      ingredient_translations: z.array(z.object({ locale: z.string(), name: z.string() })),
    }),
  )
  .transform((rows) =>
    rows.map((row): IngredientNameEntry => ({ id: row.id, sourceName: row.name, names: row.ingredient_translations })),
  );

// The ingredient's name in the viewer's language, Lithuanian when it has none in it.
export const getLocalizedIngredientName = (entry: IngredientNameEntry, locale: string): string =>
  pickTranslation(entry.names, locale)?.name ?? entry.sourceName;

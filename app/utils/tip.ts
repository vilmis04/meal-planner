import { z } from "zod";
import { pickTranslation } from "#shared/utils/contentTranslation";
import type { TipEntry, TipIngredientEntry } from "~/types/tip.types";

// Tips with their text in every language (X1b) and their tags, which the rules in shared/utils/tips.ts match (X3).
// There are a handful (15 seeded), so they are read whole, once.
export const TIP_COLUMNS = "id, tip, tags, tip_translations(locale, tip)";
// Only the ingredients a tip can be about (with tip tags): their names, for "About: Avocado", and the recipe items
// that map to them.
export const TIP_INGREDIENT_COLUMNS =
  "id, name, tip_tags, ingredient_translations(locale, name), ingredient_aliases(item)";

export const tipRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      tip: z.string(),
      tags: z.array(z.string()),
      tip_translations: z.array(z.object({ locale: z.string(), tip: z.string() })),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({ id: row.id, sourceText: row.tip, tags: row.tags, texts: row.tip_translations })),
  );

export const tipIngredientRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      name: z.string(),
      tip_tags: z.array(z.string()),
      ingredient_translations: z.array(z.object({ locale: z.string(), name: z.string() })),
      ingredient_aliases: z.array(z.object({ item: z.string() })),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      sourceName: row.name,
      names: row.ingredient_translations,
      tipTags: row.tip_tags,
      aliases: row.ingredient_aliases.map((alias) => alias.item),
    })),
  );

// The tip in the viewer's language, the Lithuanian text when it has none in it.
export const getLocalizedTipText = (tip: TipEntry, locale: string): string =>
  pickTranslation(tip.texts, locale)?.tip ?? tip.sourceText;

// The ingredient's name in the viewer's language, likewise.
export const getLocalizedTipIngredientName = (ingredient: TipIngredientEntry, locale: string): string =>
  pickTranslation(ingredient.names, locale)?.name ?? ingredient.sourceName;

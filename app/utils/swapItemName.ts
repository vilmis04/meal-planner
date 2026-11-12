import { z } from "zod";
import { pickTranslation } from "#shared/utils/contentTranslation";
import type { SwapItemText } from "#shared/utils/proteinSwap.types";

// Protein swap replacements (D2) by their Lithuanian item, with the item in every language (X1c). Row level security
// shows the items of ready swaps only.
export const SWAP_ITEM_NAME_COLUMNS = "item, recipe_protein_swap_item_translations(locale, item)";

// Each Lithuanian item with its translations; the same item in several swaps gives all of theirs (the first wins).
export const swapItemNameRowsSchema = z
  .array(
    z.object({
      item: z.string(),
      recipe_protein_swap_item_translations: z.array(z.object({ locale: z.string(), item: z.string() })),
    }),
  )
  .transform((rows) => {
    const texts = new Map<string, SwapItemText[]>();
    for (const row of rows) {
      texts.set(row.item, [...(texts.get(row.item) ?? []), ...row.recipe_protein_swap_item_translations]);
    }
    return texts;
  });

// A replacement's name in the viewer's language, as stored when it has none in it.
export const getLocalizedSwapItemName = (
  texts: readonly SwapItemText[] | undefined,
  storedName: string,
  locale: string,
): string => pickTranslation(texts ?? [], locale)?.item ?? storedName;

import { z } from "zod";

// recipe_protein_swaps rows as the dry run reads them: each pair's status and the languages it is stored in (X1c).
export const storedSwapStatusRowsSchema = z.array(
  z.object({
    recipe_id: z.string(),
    diet: z.string(),
    status: z.string(),
    recipe_protein_swap_translations: z.array(z.object({ locale: z.string() })),
  }),
);

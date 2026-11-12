import type { z } from "zod";
import type { tipIngredientRowsSchema, tipRowsSchema } from "~/utils/tip";

// Tips and the ingredients they are about (X3) as read, with their texts in every language (X1b).
export type TipEntry = z.output<typeof tipRowsSchema>[number];
export type TipIngredientEntry = z.output<typeof tipIngredientRowsSchema>[number];

// The screens whose tips the viewer can put out of the way (useTipsCollapsed()).
export type TipContext = "plan" | "recipe";

// A tip as a screen shows it: in the viewer's language, with the names of the ingredients it is about (on a recipe).
export interface ShownTip {
  id: string;
  text: string;
  about: string[];
}

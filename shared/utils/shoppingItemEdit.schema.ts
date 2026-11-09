import { z } from "zod";
import { INGREDIENT_CATEGORIES } from "./ingredient";
import { MANUAL_ITEM_UNITS, MAX_ITEM_NAME_LENGTH, normaliseItemName, readAmountInput } from "./shoppingItemEdit";
import type { NewShoppingItem } from "./shoppingItemEdit.types";

// A manual line's name: tidied, then 1 to 120 characters (shopping_items_name_length).
export const shoppingItemNameSchema = z
  .string()
  .transform(normaliseItemName)
  .pipe(z.string().min(1).max(MAX_ITEM_NAME_LENGTH));

// The add form (G4) as add_shopping_item() takes it: the amount in its base unit, or none.
export const newShoppingItemSchema = z
  .object({
    name: shoppingItemNameSchema,
    category: z.enum(INGREDIENT_CATEGORIES),
    amountText: z.string(),
    unit: z.enum(MANUAL_ITEM_UNITS).nullable(),
  })
  .transform((form, context): NewShoppingItem => {
    const result = readAmountInput({ amountText: form.amountText, unit: form.unit }, MANUAL_ITEM_UNITS);
    if (result.status === "invalid") {
      context.addIssue({ code: "custom", path: ["amountText"], message: result.error });
      return z.NEVER;
    }
    return { name: form.name, category: form.category, ...result.change };
  });

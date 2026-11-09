import type { MANUAL_ITEM_UNITS } from "./shoppingItemEdit";
import type { IngredientCategory } from "./shoppingList.types";

// A unit a manual line can be typed in (the add form's choices).
export type ManualItemUnit = (typeof MANUAL_ITEM_UNITS)[number];

// A manual line as add_shopping_item() takes it: the name tidied, the amount in its base unit (2 kg as 2000 g), and
// amount and unit both null for a line without an amount.
export interface NewShoppingItem {
  name: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string | null;
}

// An amount as set_shopping_item_amount() takes it, in the base unit. Both null clear it: a generated line goes back
// to the plan's amount, a manual one has no amount.
export interface ShoppingItemAmountChange {
  amount: number | null;
  unit: string | null;
}

// What the amount fields hold while someone types: the amount as text ("1,5"), and the unit picked.
export interface AmountInput {
  amountText: string;
  unit: string | null;
}

// What is wrong with the amount fields: not a number ("1.2.3"), no unit picked, or zero or too much.
export type AmountInputError = "not_a_number" | "missing_unit" | "out_of_range";

export type AmountInputResult =
  | { status: "valid"; change: ShoppingItemAmountChange }
  | { status: "invalid"; error: AmountInputError };

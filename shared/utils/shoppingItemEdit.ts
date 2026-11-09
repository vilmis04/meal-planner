/*
 * Changing a shopping list by hand (G4). What add_shopping_item() and set_shopping_item_amount()
 * (supabase/migrations/20261115000000_add_shopping_item_edits.sql) accept is checked here first, so the form can say
 * what is wrong before anything is sent; the database checks the same again.
 *
 * Amounts are stored in their base unit (g, ml, or a unit counted on its own), as generated lines are, so 2 kg typed
 * by hand is stored as 2000 g and reads back as 2 kg. A change to a generated line's amount is an override in the
 * line's own unit and stays when the plan later needs more or less (getPlanAmount() shows what the plan says).
 */
import { getUnitsWithBase, toBaseQuantity, toDisplayQuantity } from "./ingredientUnit";
import type { AmountInput, AmountInputResult, ShoppingItemAmountChange } from "./shoppingItemEdit.types";
import type { ShoppingItem } from "./shoppingList.types";

// The units the add form offers, as recipes write them. kg and l are stored as g and ml.
export const MANUAL_ITEM_UNITS = ["g", "kg", "ml", "l", "vnt.", "pakuotė"] as const;
// shopping_items_name_length.
export const MAX_ITEM_NAME_LENGTH = 120;
// In the base unit: a tonne, a thousand litres or pieces. is_valid_shopping_item_amount() must match.
const MAX_ITEM_AMOUNT = 1_000_000;
// shopping_items.amount is numeric(12, 2).
const AMOUNT_FRACTION_DIGITS = 2;

// Matches "2", "1.5", "0,25" and " 12 "; rejects "1.2.3", "-1", "1e3", "½" and "1,".
const AMOUNT_INPUT_REGEX = /^\s*\d+(?:[.,]\d+)?\s*$/;
// Matches each run of white space, such as the three spaces in "Mixed   berries".
const WHITE_SPACE_RUN_REGEX = /\s+/g;

// The name as it is stored: trimmed, with inner runs of white space as one space.
export function normaliseItemName(name: string): string {
  return name.replace(WHITE_SPACE_RUN_REGEX, " ").trim();
}

// What a line is to be bought in: the person's change when there is one, otherwise what the plan (or the manual line)
// says.
export function getShoppingItemAmount(item: ShoppingItem): number | null {
  return item.amountOverride ?? item.amount;
}

// How much more a bought line now says to buy than was bought (G7): the plan (or someone) raised its amount after the
// tick. Null when nothing more is needed, or the amounts cannot be compared (no amount, or another unit).
export function getBoughtShortfall(item: ShoppingItem): number | null {
  const neededAmount = getShoppingItemAmount(item);
  if (item.state !== "bought" || neededAmount === null || item.boughtAmount === null || item.boughtUnit !== item.unit) {
    return null;
  }
  const shortfall = roundToStoredAmount(neededAmount - item.boughtAmount);
  return shortfall > 0 ? shortfall : null;
}

// The plan's amount of a generated line whose amount someone changed; null when nothing was changed.
export function getPlanAmount(item: ShoppingItem): number | null {
  if (item.source !== "generated" || item.amountOverride === null) {
    return null;
  }
  return item.amount;
}

// Whether the amount can be changed: a "to taste" line has none.
export function isAmountEditable(item: ShoppingItem): boolean {
  return item.source === "manual" || item.unit !== null;
}

// The units the amount can be typed in: g or kg for a generated line in grams, any manual unit for a manual line.
export function getAmountUnitChoices(item: ShoppingItem): readonly string[] {
  if (item.source === "manual" || item.unit === null) {
    return MANUAL_ITEM_UNITS;
  }
  return getUnitsWithBase(item.unit);
}

// The amount fields filled with what the line holds now, in the unit it reads in (1.5 kg, not 1500 g).
export function getAmountInput(item: ShoppingItem, locale: string): AmountInput {
  const amount = getShoppingItemAmount(item);
  if (amount === null || item.unit === null) {
    return { amountText: "", unit: null };
  }
  const quantity = toDisplayQuantity({ amount, unit: item.unit });
  return { amountText: formatAmountInput(quantity.amount, locale), unit: quantity.unit };
}

// The typed amount as a number, null when the field is empty, undefined when it is not a number.
export function parseAmountText(amountText: string): number | null | undefined {
  if (amountText.trim() === "") {
    return null;
  }
  if (!AMOUNT_INPUT_REGEX.test(amountText)) {
    return undefined;
  }
  return Number(amountText.trim().replace(",", "."));
}

// The amount fields as set_shopping_item_amount() and add_shopping_item() take them, or what is wrong with them. An
// empty amount clears it; a unit must be one of unitChoices.
export function readAmountInput(input: AmountInput, unitChoices: readonly string[]): AmountInputResult {
  const amount = parseAmountText(input.amountText);
  if (amount === undefined) {
    return { status: "invalid", error: "not_a_number" };
  }
  if (amount === null) {
    return { status: "valid", change: { amount: null, unit: null } };
  }
  if (input.unit === null || !unitChoices.includes(input.unit)) {
    return { status: "invalid", error: "missing_unit" };
  }
  const change = toStoredAmount(amount, input.unit);
  if (change === null) {
    return { status: "invalid", error: "out_of_range" };
  }
  return { status: "valid", change };
}

// The amount as stored, in its base unit; null when it is out of range (zero once rounded, or above the limit).
export function toStoredAmount(amount: number, unit: string): ShoppingItemAmountChange | null {
  const quantity = toBaseQuantity({ amount, unit });
  const storedAmount = roundToStoredAmount(quantity.amount);
  if (storedAmount <= 0 || storedAmount > MAX_ITEM_AMOUNT) {
    return null;
  }
  return { amount: storedAmount, unit: quantity.unit };
}

// Two decimals, as numeric(12, 2) stores, so 0.1 + 0.2 compares as 0.3.
const roundToStoredAmount = (amount: number): number => {
  const scale = 10 ** AMOUNT_FRACTION_DIGITS;
  return Math.round(amount * scale) / scale;
};

// 1.5 in English, 1,5 in Lithuanian, without grouping, so what is shown can be typed back.
const formatAmountInput = (amount: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(amount);

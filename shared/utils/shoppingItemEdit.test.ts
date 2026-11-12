import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toBaseQuantity } from "./ingredientUnit";
import {
  MANUAL_ITEM_UNITS,
  getAmountInput,
  getAmountUnitChoices,
  getBoughtShortfall,
  getPlanAmount,
  getShoppingItemAmount,
  isAmountEditable,
  normaliseItemName,
  parseAmountText,
  readAmountInput,
  toStoredAmount,
} from "./shoppingItemEdit";
import { newShoppingItemSchema, shoppingItemNameSchema } from "./shoppingItemEdit.schema";
import type { ShoppingItem } from "./shoppingList.types";

const MIGRATION_PATH = "supabase/migrations/20261115000000_add_shopping_item_edits.sql";
// The quoted units of the manual unit check, e.g. "unit in ('g', 'ml', 'vnt.', 'pakuotė')".
const MANUAL_UNIT_CHECK_REGEX = /unit is null or unit in \(([^)]*)\)/;
// A quoted SQL string, e.g. "'vnt.'".
const QUOTED_VALUE_REGEX = /'([^']+)'/g;

const item = (overrides: Partial<ShoppingItem>): ShoppingItem => ({
  id: "item",
  source: "generated",
  ingredientId: null,
  name: "Vištienos filė",
  category: "meat_and_fish",
  amount: 600,
  unit: "g",
  isExtra: false,
  swappedFor: [],
  inPlan: true,
  state: "to_buy",
  isRemoved: false,
  amountOverride: null,
  addedBy: null,
  shopId: null,
  boughtAmount: null,
  boughtUnit: null,
  ...overrides,
});

describe("normaliseItemName", () => {
  it("trims and folds inner white space", () => {
    expect(normaliseItemName("  Mixed \t  berries\n")).toBe("Mixed berries");
  });
});

describe("amounts", () => {
  it("are the override when there is one, the plan's otherwise", () => {
    expect(getShoppingItemAmount(item({}))).toBe(600);
    expect(getShoppingItemAmount(item({ amountOverride: 800 }))).toBe(800);
    expect(getShoppingItemAmount(item({ amount: null, unit: null, isExtra: true }))).toBeNull();
  });

  it("show the plan's amount only when a generated line was changed", () => {
    expect(getPlanAmount(item({}))).toBeNull();
    expect(getPlanAmount(item({ amountOverride: 800 }))).toBe(600);
    expect(getPlanAmount(item({ source: "manual", amountOverride: 800 }))).toBeNull();
  });

  it("can be changed except on to-taste lines", () => {
    expect(isAmountEditable(item({}))).toBe(true);
    expect(isAmountEditable(item({ amount: null, unit: null, isExtra: true }))).toBe(false);
    expect(isAmountEditable(item({ source: "manual", amount: null, unit: null }))).toBe(true);
  });
});

describe("getBoughtShortfall", () => {
  const bought = { state: "bought" as const, boughtAmount: 600, boughtUnit: "g" };

  it("is how much more the line says to buy than was bought", () => {
    expect(getBoughtShortfall(item({ ...bought, amount: 900 }))).toBe(300);
    expect(getBoughtShortfall(item({ ...bought, amountOverride: 750.5 }))).toBe(150.5);
    expect(getBoughtShortfall(item({ ...bought, boughtAmount: 0.2, amount: 0.3 }))).toBe(0.1);
  });

  it("is null when enough was bought", () => {
    expect(getBoughtShortfall(item(bought))).toBeNull();
    expect(getBoughtShortfall(item({ ...bought, amount: 400 }))).toBeNull();
  });

  it("is null when the amounts cannot be compared, or the line is not bought", () => {
    expect(getBoughtShortfall(item({ ...bought, amount: null, unit: null, isExtra: true }))).toBeNull();
    expect(getBoughtShortfall(item({ ...bought, boughtAmount: null, boughtUnit: null, amount: 900 }))).toBeNull();
    expect(getBoughtShortfall(item({ ...bought, boughtUnit: "vnt.", amount: 900 }))).toBeNull();
    expect(getBoughtShortfall(item({ boughtAmount: 600, boughtUnit: "g", amount: 900 }))).toBeNull();
  });
});

describe("getAmountUnitChoices", () => {
  it("keeps a generated line in its own unit, larger or not", () => {
    expect(getAmountUnitChoices(item({}))).toEqual(["g", "kg"]);
    expect(getAmountUnitChoices(item({ unit: "skiltelė" }))).toEqual(["skiltelė"]);
  });

  it("offers every manual unit for a manual line", () => {
    expect(getAmountUnitChoices(item({ source: "manual", unit: "vnt." }))).toEqual(MANUAL_ITEM_UNITS);
  });
});

describe("getAmountInput", () => {
  it("fills the fields in the unit the line reads in", () => {
    expect(getAmountInput(item({ amount: 1500 }), "en")).toEqual({ amountText: "1.5", unit: "kg" });
    expect(getAmountInput(item({ amount: 1500 }), "lt")).toEqual({ amountText: "1,5", unit: "kg" });
    expect(getAmountInput(item({ amountOverride: 900 }), "en")).toEqual({ amountText: "900", unit: "g" });
  });

  it("leaves them empty for a line without an amount", () => {
    expect(getAmountInput(item({ source: "manual", amount: null, unit: null }), "en")).toEqual({ amountText: "", unit: null });
  });
});

describe("parseAmountText", () => {
  it.each([
    ["2", 2],
    ["1.5", 1.5],
    [" 0,25 ", 0.25],
    ["", null],
    ["  ", null],
    ["1.2.3", undefined],
    ["-1", undefined],
    ["1e3", undefined],
    ["1,", undefined],
  ])("reads %j as %j", (text, expected) => {
    expect(parseAmountText(text)).toBe(expected);
  });
});

describe("readAmountInput", () => {
  it("stores kg as g and l as ml", () => {
    expect(readAmountInput({ amountText: "1,5", unit: "kg" }, MANUAL_ITEM_UNITS)).toEqual({
      status: "valid",
      change: { amount: 1500, unit: "g" },
    });
    expect(readAmountInput({ amountText: "2", unit: "vnt." }, MANUAL_ITEM_UNITS)).toEqual({
      status: "valid",
      change: { amount: 2, unit: "vnt." },
    });
  });

  it("clears the amount when it is empty", () => {
    expect(readAmountInput({ amountText: "", unit: "g" }, MANUAL_ITEM_UNITS)).toEqual({
      status: "valid",
      change: { amount: null, unit: null },
    });
  });

  it("says what is wrong", () => {
    expect(readAmountInput({ amountText: "abc", unit: "g" }, MANUAL_ITEM_UNITS)).toEqual({ status: "invalid", error: "not_a_number" });
    expect(readAmountInput({ amountText: "2", unit: null }, MANUAL_ITEM_UNITS)).toEqual({ status: "invalid", error: "missing_unit" });
    expect(readAmountInput({ amountText: "2", unit: "kg" }, ["g"])).toEqual({ status: "invalid", error: "missing_unit" });
    expect(readAmountInput({ amountText: "0", unit: "g" }, MANUAL_ITEM_UNITS)).toEqual({ status: "invalid", error: "out_of_range" });
    expect(readAmountInput({ amountText: "2000", unit: "kg" }, MANUAL_ITEM_UNITS)).toEqual({ status: "invalid", error: "out_of_range" });
  });
});

describe("toStoredAmount", () => {
  it("rounds to two decimals and refuses what rounds to zero", () => {
    expect(toStoredAmount(0.3333, "vnt.")).toEqual({ amount: 0.33, unit: "vnt." });
    expect(toStoredAmount(0.004, "g")).toBeNull();
    expect(toStoredAmount(1000, "kg")).toEqual({ amount: 1_000_000, unit: "g" });
  });
});

describe("newShoppingItemSchema", () => {
  it("reads the add form as add_shopping_item() takes it", () => {
    expect(
      newShoppingItemSchema.parse({ name: " Mixed  berries ", category: "fruit_and_vegetables", amountText: "0,3", unit: "kg" }),
    ).toEqual({ name: "Mixed berries", category: "fruit_and_vegetables", amount: 300, unit: "g" });
    expect(newShoppingItemSchema.parse({ name: "Kava", category: "pantry", amountText: "", unit: "g" })).toEqual({
      name: "Kava",
      category: "pantry",
      amount: null,
      unit: null,
    });
  });

  it("refuses a missing or long name, an unknown category or unit, and a bad amount", () => {
    const valid = { name: "Kava", category: "pantry", amountText: "1", unit: "pakuotė" };
    expect(newShoppingItemSchema.safeParse(valid).success).toBe(true);
    expect(newShoppingItemSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(newShoppingItemSchema.safeParse({ ...valid, name: "a".repeat(121) }).success).toBe(false);
    expect(newShoppingItemSchema.safeParse({ ...valid, category: "drinks" }).success).toBe(false);
    expect(newShoppingItemSchema.safeParse({ ...valid, unit: "bags" }).success).toBe(false);
    expect(newShoppingItemSchema.safeParse({ ...valid, amountText: "-2" }).success).toBe(false);
  });

  it("accepts a 120-character name", () => {
    expect(shoppingItemNameSchema.safeParse("a".repeat(120)).success).toBe(true);
  });
});

describe("manual units", () => {
  it("are stored in the base units the database accepts", () => {
    const migration = readFileSync(new URL(`../../${MIGRATION_PATH}`, import.meta.url), "utf8");
    const allowed = [...(MANUAL_UNIT_CHECK_REGEX.exec(migration)?.[1] ?? "").matchAll(QUOTED_VALUE_REGEX)].map(
      (match) => match[1],
    );
    const storedUnits = [...new Set(MANUAL_ITEM_UNITS.map((unit) => toBaseQuantity({ amount: 1, unit }).unit))];

    expect(storedUnits).toEqual(allowed);
  });
});

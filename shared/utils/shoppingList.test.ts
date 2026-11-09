import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INGREDIENT_CATEGORIES } from "./ingredient";
import {
  EXTRAS_GROUP_KEY,
  HAVE_AT_HOME_GROUP_KEY,
  SHOPPING_ITEM_SOURCES,
  SHOPPING_ITEM_STATES,
  buildShoppingList,
  getShoppingListView,
} from "./shoppingList";
import type { Diet } from "./diet";
import type {
  ShoppingItem,
  ShoppingListIngredient,
  ShoppingListInput,
  ShoppingListRecipe,
  ShoppingListSwapItem,
} from "./shoppingList.types";

const MIGRATION_PATH = "supabase/migrations/20261114000000_create_shopping_lists.sql";
// The quoted values of a check on `column`, e.g. "state in ('to_buy', 'have_at_home', 'bought')".
const checkValuesRegex = (column: string): RegExp => new RegExp(`${column} in \\(([^)]*)\\)`);
// A quoted SQL string, e.g. "'bought'".
const QUOTED_VALUE_REGEX = /'([^']+)'/g;

const ANA = "user-ana";
const MONIKA = "user-monika";

const ingredient = (id: string, name: string, category: ShoppingListIngredient["category"], isOnShoppingList = true) => ({
  id,
  name,
  category,
  isOnShoppingList,
});

const EGGS = ingredient("ingredient-eggs", "Kiaušiniai", "dairy_and_eggs");
const OATS = ingredient("ingredient-oats", "Avižiniai dribsniai", "grains_and_bread");
const CHICKEN = ingredient("ingredient-chicken", "Vištienos filė", "meat_and_fish");
const COD = ingredient("ingredient-cod", "Menkė", "meat_and_fish");
const MINCE = ingredient("ingredient-mince", "Liesa jautienos malta mėsa", "meat_and_fish");
const SALT = ingredient("ingredient-salt", "Druska", "pantry");
const WATER = ingredient("ingredient-water", "Vanduo", "other", false);
const YOGURT = ingredient("ingredient-yogurt", "Graikiškas jogurtas", "dairy_and_eggs");

const ALIASES = new Map<string, ShoppingListIngredient>([
  ["Kiaušiniai", EGGS],
  ["Kiaušiniai (M)", EGGS],
  ["Avižiniai dribsniai", OATS],
  ["Vištienos filė", CHICKEN],
  ["Menkė", COD],
  ["Liesa jautienos malta mėsa", MINCE],
  ["Druska", SALT],
  ["Vanduo", WATER],
  ["Graikiškas jogurtas", YOGURT],
]);

const PORRIDGE: ShoppingListRecipe = {
  id: "recipe-porridge",
  portionDays: 1,
  mainProteins: ["egg_dairy"],
  ingredients: [
    { id: "porridge-1", item: "Avižiniai dribsniai", amount: 50, unit: "g" },
    { id: "porridge-2", item: "Vanduo", amount: 200, unit: "ml" },
    { id: "porridge-3", item: "Druska", amount: null, unit: null },
  ],
};
const OMELETTE: ShoppingListRecipe = {
  id: "recipe-omelette",
  portionDays: 1,
  mainProteins: ["egg_dairy"],
  ingredients: [
    { id: "omelette-1", item: "Kiaušiniai (M)", amount: 2, unit: "vnt." },
    { id: "omelette-2", item: "Kiaušiniai", amount: 0.1, unit: "kg" },
    { id: "omelette-3", item: "Druska", amount: 1, unit: "g" },
  ],
};
const CHICKEN_BATCH: ShoppingListRecipe = {
  id: "recipe-chicken",
  portionDays: 2,
  mainProteins: ["poultry"],
  ingredients: [
    { id: "chicken-1", item: "Vištienos filė", amount: 300, unit: "g" },
    { id: "chicken-2", item: "Kokosų pienas", amount: 1, unit: "skardinė" },
    { id: "chicken-3", item: "Garam masala", amount: null, unit: null },
  ],
};
const CHILLI: ShoppingListRecipe = {
  id: "recipe-chilli",
  portionDays: 1,
  mainProteins: ["beef"],
  ingredients: [
    { id: "chilli-1", item: "Liesa jautienos malta mėsa", amount: 150, unit: "g" },
    { id: "chilli-2", item: "Graikiškas jogurtas", amount: 40, unit: "g" },
  ],
};
const SNACK: ShoppingListRecipe = {
  id: "recipe-snack",
  portionDays: 1,
  mainProteins: ["egg_dairy"],
  ingredients: [{ id: "snack-1", item: "Graikiškas jogurtas", amount: 150, unit: "g" }],
};

const RECIPES = new Map([PORRIDGE, OMELETTE, CHICKEN_BATCH, CHILLI, SNACK].map((recipe) => [recipe.id, recipe]));

const swapsFor = (recipeId: string, diet: Diet, replacements: Record<string, ShoppingListSwapItem>) =>
  new Map([[recipeId, new Map([[diet, new Map(Object.entries(replacements))]])]]);

const buildInput = (overrides: Partial<ShoppingListInput>): ShoppingListInput => ({
  slots: [],
  includeSnacks: true,
  snacksOnList: true,
  participants: [{ userId: ANA, diet: "full" }],
  recipes: RECIPES,
  swaps: new Map(),
  aliases: ALIASES,
  ...overrides,
});

const amountsByKey = (input: ShoppingListInput) =>
  Object.fromEntries(buildShoppingList(input).items.map((item) => [item.key, item.amount]));

const storedItem = (overrides: Partial<ShoppingItem>): ShoppingItem => ({
  id: "item",
  source: "generated",
  name: "Item",
  category: "other",
  amount: 1,
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

describe("buildShoppingList", () => {
  it("scales per-person amounts by the participants", () => {
    const input = buildInput({
      slots: [{ mealType: "breakfast", recipeId: PORRIDGE.id }],
      participants: [
        { userId: ANA, diet: "full" },
        { userId: MONIKA, diet: "full" },
      ],
    });

    expect(amountsByKey(input)).toEqual({
      [`ingredient:${OATS.id}|g`]: 100,
      [`ingredient:${SALT.id}|`]: null,
    });
  });

  it("merges items of one ingredient and base unit across recipes and days, keeping pieces apart", () => {
    const input = buildInput({
      slots: [
        { mealType: "breakfast", recipeId: OMELETTE.id },
        { mealType: "breakfast", recipeId: OMELETTE.id },
      ],
    });

    expect(amountsByKey(input)).toEqual({
      [`ingredient:${EGGS.id}|vnt.`]: 4,
      [`ingredient:${EGGS.id}|g`]: 200,
      [`ingredient:${SALT.id}|g`]: 2,
    });
  });

  it("puts a to-taste item in the extras once, unless the ingredient is on the list with an amount", () => {
    const onlyToTaste = buildShoppingList(
      buildInput({
        slots: [
          { mealType: "breakfast", recipeId: PORRIDGE.id },
          { mealType: "lunch", recipeId: PORRIDGE.id },
        ],
      }),
    ).items.filter((item) => item.isExtra);
    const withAmountToo = buildShoppingList(
      buildInput({
        slots: [
          { mealType: "breakfast", recipeId: PORRIDGE.id },
          { mealType: "lunch", recipeId: OMELETTE.id },
        ],
      }),
    ).items.filter((item) => item.ingredientId === SALT.id);

    expect(onlyToTaste).toEqual([
      {
        key: `ingredient:${SALT.id}|`,
        ingredientId: SALT.id,
        name: "Druska",
        category: "pantry",
        amount: null,
        unit: null,
        isExtra: true,
        swappedFor: [],
      },
    ]);
    expect(withAmountToo).toMatchObject([{ isExtra: false, amount: 1, unit: "g" }]);
  });

  it("counts a 2-day batch once for both days, and a 2-day recipe on one day for that day", () => {
    const batch = buildInput({
      slots: [
        { mealType: "dinner", recipeId: CHICKEN_BATCH.id },
        { mealType: "dinner", recipeId: CHICKEN_BATCH.id },
      ],
      participants: [
        { userId: ANA, diet: "full" },
        { userId: MONIKA, diet: "full" },
      ],
    });
    const oneDay = { ...batch, slots: [{ mealType: "dinner" as const, recipeId: CHICKEN_BATCH.id }] };

    expect(amountsByKey(batch)).toMatchObject({
      [`ingredient:${CHICKEN.id}|g`]: 600,
      "item:Kokosų pienas|skardinė": 2,
    });
    expect(amountsByKey(oneDay)).toMatchObject({
      [`ingredient:${CHICKEN.id}|g`]: 300,
      "item:Kokosų pienas|skardinė": 1,
    });
  });

  it("keeps an item without an alias under its own spelling, in other", () => {
    const items = buildShoppingList(buildInput({ slots: [{ mealType: "dinner", recipeId: CHICKEN_BATCH.id }] })).items;

    expect(items.filter((item) => item.ingredientId === null)).toEqual([
      {
        key: "item:Garam masala|",
        ingredientId: null,
        name: "Garam masala",
        category: "other",
        amount: null,
        unit: null,
        isExtra: true,
        swappedFor: [],
      },
      {
        key: "item:Kokosų pienas|skardinė",
        ingredientId: null,
        name: "Kokosų pienas",
        category: "other",
        amount: 0.5,
        unit: "skardinė",
        isExtra: false,
        swappedFor: [],
      },
    ]);
  });

  it("leaves out ingredients that are never bought", () => {
    const items = buildShoppingList(buildInput({ slots: [{ mealType: "breakfast", recipeId: PORRIDGE.id }] })).items;

    expect(items.map((item) => item.ingredientId)).not.toContain(WATER.id);
  });

  it("leaves snacks out when the plan skips them or leaves them off the list, and lists them again otherwise", () => {
    const slots = [
      { mealType: "dinner" as const, recipeId: CHILLI.id },
      { mealType: "snack" as const, recipeId: SNACK.id },
    ];
    const yogurtKey = `ingredient:${YOGURT.id}|g`;

    expect(amountsByKey(buildInput({ slots }))[yogurtKey]).toBe(190);
    expect(amountsByKey(buildInput({ slots, snacksOnList: false }))[yogurtKey]).toBe(40);
    expect(amountsByKey(buildInput({ slots, includeSnacks: false }))[yogurtKey]).toBe(40);
  });

  it("uses each participant's protein swap, listing the replacement for them separately", () => {
    const input = buildInput({
      slots: [{ mealType: "dinner", recipeId: CHICKEN_BATCH.id }],
      participants: [
        { userId: ANA, diet: "full" },
        { userId: MONIKA, diet: "fish" },
      ],
      swaps: swapsFor(CHICKEN_BATCH.id, "fish", { "chicken-1": { item: "Menkė", amount: 0.3, unit: "kg" } }),
    });
    const build = buildShoppingList(input);

    expect(build.missingSwapCount).toBe(0);
    expect(build.items.filter((item) => item.category === "meat_and_fish")).toEqual([
      expect.objectContaining({ name: "Menkė", amount: 150, unit: "g", swappedFor: [MONIKA] }),
      expect.objectContaining({ name: "Vištienos filė", amount: 150, unit: "g", swappedFor: [] }),
    ]);
    expect(build.items.find((item) => item.name === "Kokosų pienas")?.amount).toBe(1);
  });

  it("follows the original recipe for a participant whose swap is not ready, and counts it", () => {
    const build = buildShoppingList(
      buildInput({
        slots: [
          { mealType: "dinner", recipeId: CHILLI.id },
          { mealType: "dinner", recipeId: CHILLI.id },
        ],
        participants: [{ userId: MONIKA, diet: "vegetarian" }],
      }),
    );

    expect(build.missingSwapCount).toBe(1);
    expect(build.items.find((item) => item.ingredientId === MINCE.id)?.amount).toBe(300);
  });

  it("is empty without participants or recipes, and counts each participant once", () => {
    const slots = [{ mealType: "breakfast" as const, recipeId: PORRIDGE.id }];

    expect(buildShoppingList(buildInput({ slots, participants: [] })).items).toEqual([]);
    expect(buildShoppingList(buildInput({ slots: [{ mealType: "lunch", recipeId: null }] })).items).toEqual([]);
    expect(
      amountsByKey(
        buildInput({
          slots,
          participants: [
            { userId: ANA, diet: "full" },
            { userId: ANA, diet: "full" },
          ],
        }),
      )[`ingredient:${OATS.id}|g`],
    ).toBe(50);
  });

  it("sorts lines by category in list order, then by name", () => {
    const items = buildShoppingList(
      buildInput({
        slots: [
          { mealType: "breakfast", recipeId: OMELETTE.id },
          { mealType: "lunch", recipeId: CHILLI.id },
          { mealType: "dinner", recipeId: PORRIDGE.id },
        ],
      }),
    ).items;

    expect(items.map((item) => `${item.category} ${item.name} ${item.unit}`)).toEqual([
      "meat_and_fish Liesa jautienos malta mėsa g",
      "dairy_and_eggs Graikiškas jogurtas g",
      "dairy_and_eggs Kiaušiniai g",
      "dairy_and_eggs Kiaušiniai vnt.",
      "grains_and_bread Avižiniai dribsniai g",
      "pantry Druska g",
    ]);
  });

  it("rounds sums to two decimals without floating-point noise", () => {
    const thirds: ShoppingListRecipe = {
      id: "recipe-thirds",
      portionDays: 1,
      mainProteins: ["egg_dairy"],
      ingredients: [{ id: "thirds-1", item: "Kiaušiniai", amount: 0.1, unit: "vnt." }],
    };
    const input = buildInput({
      recipes: new Map([[thirds.id, thirds]]),
      slots: [
        { mealType: "breakfast", recipeId: thirds.id },
        { mealType: "lunch", recipeId: thirds.id },
        { mealType: "dinner", recipeId: thirds.id },
      ],
    });

    expect(amountsByKey(input)[`ingredient:${EGGS.id}|vnt.`]).toBe(0.3);
  });
});

describe("getShoppingListView", () => {
  it("groups shown lines by category in list order, then the extras, and hides empty groups", () => {
    const view = getShoppingListView([
      storedItem({ id: "salt", name: "Druska", category: "pantry", amount: null, unit: null, isExtra: true }),
      storedItem({ id: "oats", name: "Avižiniai dribsniai", category: "grains_and_bread" }),
      storedItem({ id: "eggs", name: "Kiaušiniai", category: "dairy_and_eggs" }),
      storedItem({ id: "cheese", name: "Čederio sūris", category: "dairy_and_eggs" }),
      storedItem({ id: "onion", name: "Svogūnai", category: "fruit_and_vegetables" }),
      storedItem({ id: "gone", name: "Menkė", category: "meat_and_fish", inPlan: false, state: "bought" }),
      storedItem({ id: "removed", name: "Vištiena", category: "meat_and_fish", isRemoved: true }),
    ]);

    expect(view.groups.map((group) => [group.key, group.items.map((item) => item.id), group.itemCount])).toEqual([
      ["fruit_and_vegetables", ["onion"], 1],
      ["dairy_and_eggs", ["cheese", "eggs"], 2],
      ["grains_and_bread", ["oats"], 1],
      [EXTRAS_GROUP_KEY, ["salt"], 1],
    ]);
    expect(view.totalCount).toBe(5);
    expect(view.boughtCount).toBe(0);
    expect(view.atHomeCount).toBe(0);
  });

  it("leaves the extras group out when there are no extras", () => {
    const view = getShoppingListView([storedItem({ id: "oats", name: "Avižiniai dribsniai", category: "grains_and_bread" })]);

    expect(view.groups.map((group) => group.key)).toEqual(["grains_and_bread"]);
  });

  it("has no groups for an empty list", () => {
    expect(getShoppingListView([])).toEqual({ groups: [], boughtCount: 0, totalCount: 0, atHomeCount: 0 });
  });

  it("moves lines at home into their own group, last, and leaves them out of the to-buy count", () => {
    const view = getShoppingListView([
      storedItem({ id: "salt", name: "Druska", category: "pantry", amount: null, unit: null, isExtra: true, state: "have_at_home" }),
      storedItem({ id: "oats", name: "Avižiniai dribsniai", category: "grains_and_bread", state: "have_at_home" }),
      storedItem({ id: "eggs", name: "Kiaušiniai", category: "dairy_and_eggs" }),
      storedItem({ id: "coffee", name: "Kava", category: "pantry", source: "manual", amount: null, unit: null }),
      storedItem({ id: "gone", name: "Menkė", category: "meat_and_fish", inPlan: false, state: "have_at_home" }),
      storedItem({ id: "removed", name: "Bananai", category: "fruit_and_vegetables", isRemoved: true, state: "have_at_home" }),
    ]);

    expect(view.groups.map((group) => [group.key, group.items.map((item) => item.id), group.itemCount])).toEqual([
      ["dairy_and_eggs", ["eggs"], 1],
      ["pantry", ["coffee"], 1],
      [HAVE_AT_HOME_GROUP_KEY, ["oats", "salt"], 2],
    ]);
    expect(view.totalCount).toBe(2);
    expect(view.atHomeCount).toBe(2);
  });

  describe("bought lines (G5)", () => {
    const groceries = [
      storedItem({ id: "onion", name: "Svogūnai", category: "fruit_and_vegetables", state: "bought" }),
      storedItem({ id: "carrots", name: "Morkos", category: "fruit_and_vegetables" }),
      storedItem({ id: "beetroot", name: "Burokėliai", category: "fruit_and_vegetables", state: "bought" }),
      storedItem({ id: "apples", name: "Obuoliai", category: "fruit_and_vegetables" }),
      storedItem({ id: "salt", name: "Druska", category: "pantry", amount: null, unit: null, isExtra: true, state: "bought" }),
      storedItem({ id: "coffee", name: "Kava", category: "pantry", source: "manual", amount: null, unit: null }),
      storedItem({ id: "oats", name: "Avižiniai dribsniai", category: "grains_and_bread", state: "have_at_home" }),
      storedItem({ id: "gone", name: "Menkė", category: "meat_and_fish", inPlan: false, state: "bought" }),
      storedItem({ id: "removed", name: "Vištiena", category: "meat_and_fish", isRemoved: true, state: "bought" }),
    ];

    it("stay in their group, after the lines still to buy", () => {
      const view = getShoppingListView(groceries);

      expect(view.groups.map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([
        ["fruit_and_vegetables", ["carrots", "apples", "beetroot", "onion"]],
        ["pantry", ["coffee"]],
        [EXTRAS_GROUP_KEY, ["salt"]],
        [HAVE_AT_HOME_GROUP_KEY, ["oats"]],
      ]);
    });

    it("keep their name order when bought last is off", () => {
      const view = getShoppingListView(groceries, { isBoughtLast: false });

      expect(view.groups[0]?.items.map((item) => item.id)).toEqual(["beetroot", "carrots", "apples", "onion"]);
    });

    it("count bought of all lines to shop for, per group and for the list, leaving out what is at home", () => {
      const view = getShoppingListView(groceries);

      expect(view.groups.map((group) => [group.key, group.boughtCount, group.itemCount])).toEqual([
        ["fruit_and_vegetables", 2, 4],
        ["pantry", 0, 1],
        [EXTRAS_GROUP_KEY, 1, 1],
        [HAVE_AT_HOME_GROUP_KEY, 0, 1],
      ]);
      expect(view.boughtCount).toBe(3);
      expect(view.totalCount).toBe(6);
      expect(view.atHomeCount).toBe(1);
    });
  });
});

describe("shopping item values", () => {
  const migration = readFileSync(new URL(`../../${MIGRATION_PATH}`, import.meta.url), "utf8");
  const allowedValues = (column: string) =>
    [...(checkValuesRegex(column).exec(migration)?.[1] ?? "").matchAll(QUOTED_VALUE_REGEX)].map((match) => match[1]);

  it("match the checks of shopping_items", () => {
    expect(allowedValues("state")).toEqual([...SHOPPING_ITEM_STATES]);
    expect(allowedValues("source")).toEqual([...SHOPPING_ITEM_SOURCES]);
    expect(allowedValues("category")).toEqual([...INGREDIENT_CATEGORIES]);
  });
});

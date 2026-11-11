import { describe, expect, it } from "vitest";
import type { Diet, Protein } from "./diet";
import { MEAL_TYPES } from "./mealFilter";
import type { MealType } from "./mealFilter";
import { generateMealPlan } from "./planGenerator";
import type {
  GeneratorParticipant,
  GeneratorRecipe,
  GeneratorSlot,
  PlanGenerationInput,
  SlotAssignment,
} from "./planGenerator.types";
import type { RecipeRating } from "./recipeRating";

// 2026-11-09 is a Monday, 2026-11-07 a Saturday.
const MONDAY = "2026-11-09";
const SATURDAY = "2026-11-07";

const makeRecipe = (
  id: string,
  mealType: MealType,
  { portionDays = 1, proteins = ["plant"] }: { portionDays?: number; proteins?: Protein[] } = {},
): GeneratorRecipe => ({ id, mealType, portionDays, mainProteins: proteins });

const makeRecipes = (prefix: string, mealType: MealType, count: number, options?: Parameters<typeof makeRecipe>[2]) =>
  Array.from({ length: count }, (_, index) =>
    makeRecipe(`${prefix}${String(index + 1).padStart(2, "0")}`, mealType, options),
  );

const LIBRARY: GeneratorRecipe[] = [
  ...makeRecipes("breakfast-", "breakfast", 10, { proteins: ["egg_dairy"] }),
  ...makeRecipes("lunch-", "lunch", 8, { proteins: ["poultry"] }),
  ...makeRecipes("lunch-batch-", "lunch", 5, { portionDays: 2, proteins: ["beef"] }),
  ...makeRecipes("dinner-", "dinner", 8, { proteins: ["fish"] }),
  ...makeRecipes("dinner-batch-", "dinner", 5, { portionDays: 2, proteins: ["plant"] }),
  ...makeRecipes("snack-", "snack", 10),
];

const makeParticipant = (
  userId: string,
  diet: Diet = "full",
  ratings: Record<string, RecipeRating> = {},
): GeneratorParticipant => ({ userId, diet, ratings });

const makeSlots = (dayCount: number, mealTypes: readonly MealType[] = MEAL_TYPES): GeneratorSlot[] =>
  Array.from({ length: dayCount }, (_, dayIndex) =>
    mealTypes.map((mealType) => ({ dayIndex, mealType, recipeId: null, isLocked: false })),
  ).flat();

const makeInput = (overrides: Partial<PlanGenerationInput> = {}): PlanGenerationInput => {
  const dayCount = overrides.dayCount ?? 7;
  return {
    startDate: MONDAY,
    dayCount,
    mealTypes: MEAL_TYPES,
    slots: makeSlots(dayCount),
    workdays: [1, 2, 3, 4, 5],
    recipes: LIBRARY,
    participants: [makeParticipant("ana")],
    swapDiets: {},
    history: [],
    cooldownDays: 14,
    seed: 1,
    ...overrides,
  };
};

const recipesOf = (assignments: SlotAssignment[], mealType: MealType): (string | null)[] =>
  assignments
    .filter((assignment) => assignment.mealType === mealType)
    .sort((first, second) => first.dayIndex - second.dayIndex)
    .map((assignment) => assignment.recipeId);

const countValues = (values: readonly (string | null)[]): Map<string | null, number> => {
  const counts = new Map<string | null, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
};

const isBatchRecipe = (recipeId: string | null | undefined): boolean => Boolean(recipeId?.includes("-batch-"));

// How many of `seedCount` fixed seeds put `recipeId` in the plan.
const countPlansWith = (recipeId: string, makeSeedInput: (seed: number) => PlanGenerationInput, seedCount = 400) => {
  let count = 0;
  for (let seed = 1; seed <= seedCount; seed++) {
    if (generateMealPlan(makeSeedInput(seed)).some((assignment) => assignment.recipeId === recipeId)) {
      count++;
    }
  }
  return count;
};

describe("generateMealPlan", () => {
  it("fills every open slot of every meal type, in day and meal order", () => {
    const assignments = generateMealPlan(makeInput());
    expect(assignments).toHaveLength(28);
    expect(assignments.every((assignment) => assignment.recipeId !== null && assignment.note === null)).toBe(true);
    expect(assignments.slice(0, 4).map((assignment) => [assignment.dayIndex, assignment.mealType])).toEqual([
      [0, "breakfast"],
      [0, "lunch"],
      [0, "dinner"],
      [0, "snack"],
    ]);
  });

  it("puts each recipe only in a slot of its own meal type", () => {
    const mealTypeById = new Map(LIBRARY.map((recipe) => [recipe.id, recipe.mealType]));
    for (const assignment of generateMealPlan(makeInput({ seed: 99 }))) {
      expect(mealTypeById.get(assignment.recipeId ?? "")).toBe(assignment.mealType);
    }
  });

  describe("determinism", () => {
    it("gives the same plan for the same seed", () => {
      expect(generateMealPlan(makeInput({ seed: 123 }))).toEqual(generateMealPlan(makeInput({ seed: 123 })));
    });

    it("gives different plans for different seeds", () => {
      const plans = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateMealPlan(makeInput({ seed })))));
      expect(plans.size).toBeGreaterThan(1);
    });

    it("does not depend on the order the recipes come in", () => {
      const reversed = [...LIBRARY].reverse();
      expect(generateMealPlan(makeInput({ recipes: reversed, seed: 8 }))).toEqual(
        generateMealPlan(makeInput({ seed: 8 })),
      );
    });
  });

  describe("diets", () => {
    it("plans only recipes that fit every participant's diet", () => {
      const assignments = generateMealPlan(
        makeInput({ participants: [makeParticipant("ana", "full"), makeParticipant("monika", "vegetarian")] }),
      );
      // Poultry lunches, beef batch lunches and fish dinners do not fit a vegetarian.
      expect(recipesOf(assignments, "lunch").every((recipeId) => recipeId === null)).toBe(true);
      expect(recipesOf(assignments, "dinner").every((recipeId) => recipeId?.startsWith("dinner-batch-"))).toBe(true);
      expect(assignments.filter((assignment) => assignment.mealType === "lunch").map((assignment) => assignment.note)).toEqual(
        Array(7).fill("no_recipe_fits_diets"),
      );
    });

    it("lets a recipe in when a stored protein swap makes it fit", () => {
      const swapDiets = Object.fromEntries(
        LIBRARY.filter((recipe) => recipe.id.startsWith("lunch-batch-")).map((recipe) => [recipe.id, ["vegetarian"] as Diet[]]),
      );
      const assignments = generateMealPlan(
        makeInput({ participants: [makeParticipant("monika", "vegetarian")], swapDiets }),
      );
      const lunches = recipesOf(assignments, "lunch");
      expect(lunches.filter(isBatchRecipe).length).toBeGreaterThan(0);
      expect(lunches.filter((recipeId) => recipeId !== null).every(isBatchRecipe)).toBe(true);
    });

    it("does not count a swap for another diet", () => {
      const assignments = generateMealPlan(
        makeInput({
          participants: [makeParticipant("monika", "vegetarian")],
          swapDiets: { "lunch-batch-01": ["fish"] },
        }),
      );
      expect(recipesOf(assignments, "lunch")).not.toContain("lunch-batch-01");
    });
  });

  describe("preferences", () => {
    it("never plans a recipe any participant hates", () => {
      const hated = Object.fromEntries(
        LIBRARY.filter((recipe) => recipe.mealType === "breakfast" && recipe.id !== "breakfast-01").map((recipe) => [
          recipe.id,
          "hate" as const,
        ]),
      );
      const assignments = generateMealPlan(
        makeInput({ participants: [makeParticipant("ana"), makeParticipant("monika", "full", hated)] }),
      );
      expect(new Set(recipesOf(assignments, "breakfast"))).toEqual(new Set(["breakfast-01"]));
    });

    it("leaves a slot empty, with the reason, when everything that fits is hated", () => {
      const hated = Object.fromEntries(
        LIBRARY.filter((recipe) => recipe.mealType === "snack").map((recipe) => [recipe.id, "hate" as const]),
      );
      const assignments = generateMealPlan(makeInput({ participants: [makeParticipant("ana", "full", hated)] }));
      const snacks = assignments.filter((assignment) => assignment.mealType === "snack");
      expect(snacks.every((snack) => snack.recipeId === null && snack.note === "all_recipes_hated")).toBe(true);
    });

    // Fixed seeds 1 to 400: how often a breakfast lands in a 1-day, breakfast-only plan out of 10 breakfasts.
    const breakfastOnly = (ratings: Record<string, RecipeRating>, participants = 1) => (seed: number) =>
      makeInput({
        dayCount: 1,
        mealTypes: ["breakfast"],
        slots: makeSlots(1, ["breakfast"]),
        participants: Array.from({ length: participants }, (_, index) =>
          makeParticipant(`person-${index}`, "full", ratings),
        ),
        seed,
      });

    it("weights a liked recipe higher, but never guarantees it", () => {
      const neutral = countPlansWith("breakfast-05", breakfastOnly({}));
      const liked = countPlansWith("breakfast-05", breakfastOnly({ "breakfast-05": "enjoy" }));
      // 1 of 10 neutral (about 40 of 400), 2 of 11 liked (about 73 of 400).
      expect(neutral).toBe(42);
      expect(liked).toBe(82);
      expect(liked / neutral).toBeGreaterThan(1.5);
      expect(liked).toBeLessThan(400);
    });

    it("counts each participant who likes a recipe", () => {
      const likedByOne = countPlansWith("breakfast-05", breakfastOnly({ "breakfast-05": "enjoy" }, 1));
      const likedByTwo = countPlansWith("breakfast-05", breakfastOnly({ "breakfast-05": "enjoy" }, 2));
      // 3 of 12 when both like it (about 100 of 400).
      expect(likedByTwo).toBe(99);
      expect(likedByTwo).toBeGreaterThan(likedByOne);
    });

    it("weights an 'enjoy less' recipe lower, without excluding it", () => {
      const lukewarm = countPlansWith("breakfast-05", breakfastOnly({ "breakfast-05": "enjoy_less" }));
      // 0.5 of 9.5 (about 21 of 400).
      expect(lukewarm).toBe(23);
      expect(lukewarm).toBeGreaterThan(0);
    });
  });

  describe("workday batches", () => {
    it("lays a Monday-to-Sunday week out as Mon–Tue, Wed–Thu, Fri–Sat and Sun", () => {
      const assignments = generateMealPlan(makeInput());
      for (const mealType of ["lunch", "dinner"] as const) {
        const [mon, tue, wed, thu, fri, sat, sun] = recipesOf(assignments, mealType);
        expect([mon, wed, fri].every(isBatchRecipe)).toBe(true);
        expect(tue).toBe(mon);
        expect(thu).toBe(wed);
        expect(sat).toBe(fri);
        expect(new Set([mon, wed, fri]).size).toBe(3);
        expect(isBatchRecipe(sun)).toBe(false);
      }
    });

    it("cooks on the weekend before a week that starts on Saturday", () => {
      const assignments = generateMealPlan(makeInput({ startDate: SATURDAY }));
      const [sat, sun, mon, tue, wed, thu, fri] = recipesOf(assignments, "dinner");
      expect(isBatchRecipe(sat)).toBe(false);
      expect(isBatchRecipe(sun)).toBe(true);
      expect(mon).toBe(sun);
      expect(wed).toBe(tue);
      expect(fri).toBe(thu);
    });

    it("follows the plan's own workdays", () => {
      // Workdays Thursday to Sunday: Thu–Fri and Sat–Sun are batches, Monday to Wednesday single days.
      const assignments = generateMealPlan(makeInput({ workdays: [4, 5, 6, 7] }));
      const [mon, tue, wed, thu, fri, sat, sun] = recipesOf(assignments, "lunch");
      // Monday to Wednesday are single days (no batch spans across them).
      expect(new Set([mon, tue, wed, thu]).size).toBe(4);
      expect(isBatchRecipe(thu)).toBe(true);
      expect(fri).toBe(thu);
      expect(isBatchRecipe(sat)).toBe(true);
      expect(sun).toBe(sat);
    });

    it("plans no batches without workdays", () => {
      const assignments = generateMealPlan(makeInput({ workdays: [] }));
      expect(new Set(assignments.map((assignment) => assignment.recipeId)).size).toBe(28);
    });

    it("never batches breakfast or snacks", () => {
      const recipes = [...LIBRARY, makeRecipe("breakfast-batch-01", "breakfast", { portionDays: 2 })];
      const breakfasts = recipesOf(generateMealPlan(makeInput({ recipes, seed: 3 })), "breakfast");
      expect(new Set(breakfasts).size).toBe(7);
    });

    it("splits a batch into single days, with a note on workdays, when batch recipes run out", () => {
      const recipes = LIBRARY.filter((recipe) => !recipe.id.startsWith("lunch-batch-") || recipe.id === "lunch-batch-01");
      const assignments = generateMealPlan(makeInput({ recipes }));
      const lunches = assignments.filter((assignment) => assignment.mealType === "lunch");
      const batchDays = lunches.filter((assignment) => assignment.recipeId === "lunch-batch-01");
      expect(batchDays).toHaveLength(2);
      const missed = lunches.filter((assignment) => assignment.note === "no_batch_recipe").map((assignment) => assignment.dayIndex);
      // One batch recipe covers two days; the other two batch spans become single days. Saturday is no workday.
      expect(missed).toHaveLength(3);
      expect(missed).not.toContain(5);
      expect(lunches.every((assignment) => assignment.recipeId !== null)).toBe(true);
    });
    it("gives a batch a resting batch recipe, least recently used first, before splitting it", () => {
      // Every lunch batch was planned last week; the two that rested longest fill two of the three spans.
      const history = [1, 2, 3, 4, 5].map((number) => ({
        recipeId: `lunch-batch-0${number}`,
        lastPlannedOn: `2026-11-0${number + 2}`,
      }));
      const assignments = generateMealPlan(makeInput({ history }));
      const lunches = assignments.filter((assignment) => assignment.mealType === "lunch");
      const batchIds = lunches.filter((assignment) => isBatchRecipe(assignment.recipeId)).map((assignment) => assignment.recipeId);
      expect(new Set(batchIds)).toEqual(new Set(["lunch-batch-01", "lunch-batch-02", "lunch-batch-03"]));
      expect(lunches.filter((assignment) => isBatchRecipe(assignment.recipeId)).every((assignment) => assignment.note === "recently_planned")).toBe(true);
      expect(lunches.filter((assignment) => assignment.note === "no_batch_recipe")).toHaveLength(0);
    });

    it("never repeats a batch recipe within a plan to keep a batch", () => {
      const recipes = LIBRARY.filter((recipe) => !recipe.id.startsWith("dinner-batch-") || recipe.id === "dinner-batch-01");
      const dinners = recipesOf(generateMealPlan(makeInput({ recipes })), "dinner");
      expect(dinners.filter((recipeId) => recipeId === "dinner-batch-01")).toHaveLength(2);
    });
  });

  describe("variety", () => {
    it("plans a recipe once per week when there are enough", () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const assignments = generateMealPlan(makeInput({ seed }));
        for (const mealType of MEAL_TYPES) {
          const recipes = recipesOf(assignments, mealType);
          // A recipe is in one slot, or in two consecutive ones as a batch.
          for (const [recipeId, count] of countValues(recipes)) {
            const firstDay = recipes.indexOf(recipeId);
            expect(count === 1 || (count === 2 && isBatchRecipe(recipeId) && recipes[firstDay + 1] === recipeId)).toBe(true);
          }
        }
      }
    });

    it("allows a recipe twice in a two-week plan before repeating anything a third time", () => {
      const recipes = [...LIBRARY.filter((recipe) => recipe.mealType !== "breakfast"), ...makeRecipes("breakfast-", "breakfast", 7)];
      const assignments = generateMealPlan(makeInput({ dayCount: 14, slots: makeSlots(14), recipes }));
      const breakfasts = assignments.filter((assignment) => assignment.mealType === "breakfast");
      expect([...countValues(breakfasts.map((assignment) => assignment.recipeId)).values()].every((count) => count === 2)).toBe(true);
      expect(breakfasts.every((assignment) => assignment.note === null)).toBe(true);
    });

    it("repeats only when nothing else is left, least used first, never on the next day, and says so", () => {
      const recipes = [...LIBRARY.filter((recipe) => recipe.mealType !== "breakfast"), ...makeRecipes("breakfast-", "breakfast", 3)];
      const assignments = generateMealPlan(makeInput({ recipes }));
      const breakfasts = assignments.filter((assignment) => assignment.mealType === "breakfast");
      const ids = breakfasts.map((assignment) => assignment.recipeId);
      expect([...countValues(ids).values()].sort()).toEqual([2, 2, 3]);
      ids.slice(1).forEach((recipeId, index) => expect(recipeId).not.toBe(ids[index]));
      expect(breakfasts.slice(0, 3).every((assignment) => assignment.note === null)).toBe(true);
      expect(breakfasts.slice(3).every((assignment) => assignment.note === "repeated_in_plan")).toBe(true);
    });

    it("makes the same meat or fish twice in a day less likely", () => {
      const recipes = [
        makeRecipe("lunch-fish", "lunch", { proteins: ["fish"] }),
        makeRecipe("lunch-pork", "lunch", { proteins: ["pork"] }),
        makeRecipe("dinner-fish", "dinner", { proteins: ["fish"] }),
      ];
      // Dinner is a fish dish kept as it is; lunch is fish or pork.
      const fishLunches = countPlansWith("lunch-fish", (seed) =>
        makeInput({
          dayCount: 1,
          mealTypes: ["lunch"],
          slots: [
            { dayIndex: 0, mealType: "lunch", recipeId: null, isLocked: false },
            { dayIndex: 0, mealType: "dinner", recipeId: "dinner-fish", isLocked: true },
          ],
          recipes,
          seed,
        }),
      );
      // Weight 0.5 against 1: about a third of 400.
      expect(fishLunches).toBe(136);
      expect(fishLunches).toBeLessThan(200);
    });
  });

  describe("cooldown", () => {
    const breakfastWeek = (overrides: Partial<PlanGenerationInput> = {}) =>
      makeInput({
        mealTypes: ["breakfast"],
        slots: makeSlots(7, ["breakfast"]),
        recipes: makeRecipes("breakfast-", "breakfast", 10),
        ...overrides,
      });

    it("rests recipes planned in recent plans, liked ones too", () => {
      const history = ["breakfast-01", "breakfast-02", "breakfast-03"].map((recipeId) => ({
        recipeId,
        lastPlannedOn: "2026-11-02",
      }));
      const participants = [makeParticipant("ana", "full", { "breakfast-01": "enjoy" })];
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const breakfasts = recipesOf(generateMealPlan(breakfastWeek({ history, participants, seed })), "breakfast");
        expect(breakfasts).not.toContain("breakfast-01");
        expect(breakfasts).not.toContain("breakfast-02");
        expect(breakfasts).not.toContain("breakfast-03");
      }
    });

    it("relaxes the rest when too few recipes remain, least recently used first", () => {
      const history = [
        { recipeId: "breakfast-01", lastPlannedOn: "2026-11-08" },
        { recipeId: "breakfast-02", lastPlannedOn: "2026-11-01" },
        { recipeId: "breakfast-03", lastPlannedOn: "2026-10-30" },
        { recipeId: "breakfast-04", lastPlannedOn: "2026-11-05" },
        { recipeId: "breakfast-05", lastPlannedOn: "2026-11-06" },
      ];
      const assignments = generateMealPlan(breakfastWeek({ history }));
      // Five fresh recipes fill five days; the sixth and seventh days take the two longest-rested ones.
      expect(assignments.filter((assignment) => assignment.note === null)).toHaveLength(5);
      const relaxed = assignments.filter((assignment) => assignment.note === "recently_planned");
      expect(relaxed.map((assignment) => assignment.recipeId)).toEqual(["breakfast-03", "breakfast-02"]);
    });

    it("ignores plans older than the cooldown and uses on or after the start date", () => {
      const history = [
        { recipeId: "breakfast-01", lastPlannedOn: "2026-10-26" },
        { recipeId: "breakfast-02", lastPlannedOn: MONDAY },
      ];
      const recipes = makeRecipes("breakfast-", "breakfast", 7);
      const breakfasts = recipesOf(generateMealPlan(breakfastWeek({ history, recipes })), "breakfast");
      expect(new Set(breakfasts).size).toBe(7);
    });

    it("can be turned off", () => {
      const history = makeRecipes("breakfast-", "breakfast", 7).map((recipe) => ({ recipeId: recipe.id, lastPlannedOn: "2026-11-08" }));
      const recipes = makeRecipes("breakfast-", "breakfast", 7);
      const assignments = generateMealPlan(breakfastWeek({ history, recipes, cooldownDays: 0 }));
      expect(assignments.every((assignment) => assignment.note === null)).toBe(true);
    });

    it("lets a rested recipe's weight recover gradually", () => {
      const oneBreakfast = (lastPlannedOn: string | null) => (seed: number) =>
        breakfastWeek({
          dayCount: 1,
          slots: makeSlots(1, ["breakfast"]),
          history: lastPlannedOn ? [{ recipeId: "breakfast-05", lastPlannedOn }] : [],
          seed,
        });
      // 14 days ago: half weight; 21 days ago: three quarters; 28 days ago: full weight.
      expect(countPlansWith("breakfast-05", oneBreakfast("2026-10-26"))).toBe(23);
      expect(countPlansWith("breakfast-05", oneBreakfast("2026-10-19"))).toBe(30);
      expect(countPlansWith("breakfast-05", oneBreakfast("2026-10-12"))).toBe(42);
    });
  });

  describe("locked slots", () => {
    it("keeps locked slots out of the result and counts their recipes", () => {
      const slots = makeSlots(7, ["breakfast"]).map((slot) =>
        slot.dayIndex === 2 ? { ...slot, recipeId: "breakfast-04", isLocked: true } : slot,
      );
      const recipes = makeRecipes("breakfast-", "breakfast", 7);
      const assignments = generateMealPlan(makeInput({ mealTypes: ["breakfast"], slots, recipes }));
      expect(assignments.map((assignment) => assignment.dayIndex)).toEqual([0, 1, 3, 4, 5, 6]);
      expect(recipesOf(assignments, "breakfast")).not.toContain("breakfast-04");
    });

    it("lays batches out around locked days", () => {
      // Tuesday's dinner is kept: Monday cannot pair with it, so Mon is single and Wed–Thu, Fri–Sat are batches.
      const slots = makeSlots(7, ["dinner"]).map((slot) =>
        slot.dayIndex === 1 ? { ...slot, recipeId: "dinner-01", isLocked: true } : slot,
      );
      const assignments = generateMealPlan(makeInput({ mealTypes: ["dinner"], slots }));
      const [mon, wed, thu, fri, sat] = recipesOf(assignments, "dinner");
      expect(isBatchRecipe(mon)).toBe(false);
      expect(thu).toBe(wed);
      expect(sat).toBe(fri);
      expect(isBatchRecipe(wed) && isBatchRecipe(fri)).toBe(true);
    });

    it("never gives an open slot an excluded recipe, so a swap differs", () => {
      const recipes = makeRecipes("breakfast-", "breakfast", 2);
      const slots = makeSlots(1, ["breakfast"]).map((slot) => ({ ...slot, recipeId: "breakfast-01" }));
      for (const seed of [1, 2, 3, 4, 5]) {
        const assignments = generateMealPlan(
          makeInput({ dayCount: 1, mealTypes: ["breakfast"], slots, recipes, excludedRecipeIds: ["breakfast-01"], seed }),
        );
        expect(recipesOf(assignments, "breakfast")).toEqual(["breakfast-02"]);
      }
    });

    it("leaves a slot empty when the excluded recipe was the only one that fits", () => {
      const assignments = generateMealPlan(
        makeInput({
          dayCount: 1,
          mealTypes: ["breakfast"],
          slots: makeSlots(1, ["breakfast"]),
          recipes: makeRecipes("breakfast-", "breakfast", 1),
          excludedRecipeIds: ["breakfast-01"],
        }),
      );
      expect(assignments).toEqual([{ dayIndex: 0, mealType: "breakfast", recipeId: null, note: "no_recipe_fits_diets" }]);
    });

    it("leaves meal types that are not asked for alone", () => {
      const assignments = generateMealPlan(makeInput({ mealTypes: ["breakfast", "lunch", "dinner"] }));
      expect(assignments.some((assignment) => assignment.mealType === "snack")).toBe(false);
      expect(assignments).toHaveLength(21);
    });
  });

  describe("plan adjustment (I3)", () => {
    const dinnerIds = LIBRARY.filter((recipe) => recipe.mealType === "dinner").map((recipe) => recipe.id);
    const fishDinnerIds = LIBRARY.filter((recipe) => recipe.mainProteins.includes("fish")).map((recipe) => recipe.id);

    it("never puts an excluded recipe in its slots, whatever the seed", () => {
      const slotExclusions = Array.from({ length: 7 }, (_, dayIndex) => ({
        dayIndex,
        mealType: "dinner" as const,
        recipeIds: fishDinnerIds,
      }));
      for (let seed = 1; seed <= 50; seed++) {
        const dinners = recipesOf(generateMealPlan(makeInput({ seed, slotExclusions })), "dinner");
        expect(dinners.some((recipeId) => recipeId !== null && fishDinnerIds.includes(recipeId))).toBe(false);
      }
    });

    it("leaves out a recipe only where the exclusion says", () => {
      const slotExclusions = [{ dayIndex: 0, mealType: "breakfast" as const, recipeIds: ["breakfast-01"] }];
      const counts = { onDay: 0, elsewhere: 0 };
      for (let seed = 1; seed <= 200; seed++) {
        const breakfasts = recipesOf(generateMealPlan(makeInput({ seed, slotExclusions })), "breakfast");
        counts.onDay += Number(breakfasts[0] === "breakfast-01");
        counts.elsewhere += Number(breakfasts.slice(1).includes("breakfast-01"));
      }
      expect(counts.onDay).toBe(0);
      expect(counts.elsewhere).toBeGreaterThan(0);
    });

    it("leaves a slot empty with a note when the adjustment excludes everything left, and never relaxes it", () => {
      const slotExclusions = [{ dayIndex: 2, mealType: "dinner" as const, recipeIds: dinnerIds }];
      const assignments = generateMealPlan(makeInput({ slotExclusions }));
      const wednesday = assignments.find((assignment) => assignment.dayIndex === 2 && assignment.mealType === "dinner");
      expect(wednesday).toEqual({ dayIndex: 2, mealType: "dinner", recipeId: null, note: "no_recipe_fits_adjustment" });
      expect(recipesOf(assignments, "dinner").filter((recipeId) => recipeId === null)).toHaveLength(1);
    });

    it("keeps diet and hate notes first", () => {
      const slotExclusions = [{ dayIndex: 0, mealType: "dinner" as const, recipeIds: dinnerIds }];
      const assignments = generateMealPlan(
        makeInput({
          slotExclusions,
          participants: [makeParticipant("ana", "vegetarian")],
          recipes: LIBRARY.filter((recipe) => !recipe.id.startsWith("dinner-batch-")),
        }),
      );
      const monday = assignments.find((assignment) => assignment.dayIndex === 0 && assignment.mealType === "dinner");
      expect(monday?.note).toBe("no_recipe_fits_diets");
    });

    it("plans a quick meal like a workday's: from a batch cooked the day before", () => {
      const weekend = { workdays: [], startDate: MONDAY };
      const plain = recipesOf(generateMealPlan(makeInput(weekend)), "dinner");
      expect(plain.every((recipeId) => !isBatchRecipe(recipeId))).toBe(true);

      const quick = recipesOf(
        generateMealPlan(makeInput({ ...weekend, quickMeals: [{ dayIndex: 6, mealType: "dinner" }] })),
        "dinner",
      );
      expect(isBatchRecipe(quick[6])).toBe(true);
      expect(quick[5]).toBe(quick[6]);
    });
  });
});

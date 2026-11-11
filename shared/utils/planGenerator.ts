/*
 * The plan generator (E4): fills a plan's open slots by rules and a seeded weighted random choice. Pure and
 * deterministic: the same input and seed always give the same plan. No AI is involved.
 *
 * Rules, in the product description's priority order (docs/product-description.md, 3.4):
 *   1. Diet (hard): a recipe fits every participant's diet, or has a ready protein swap for each diet it breaks.
 *   2. Preferences: a recipe any participant hates is never planned. Each "enjoy" raises the weight, each
 *      "enjoy less" lowers it; liking never guarantees a recipe. A recipe planned in the same people's other plans
 *      within `cooldownDays` before this plan rests (liked ones too) and its weight recovers gradually over the
 *      same number of days afterwards.
 *   3. Batching: lunch and dinner are laid out first, as 2-day spans where they save cooking on workdays
 *      (cook on day N, eat on N and N+1), and filled with batch recipes before anything else.
 *   4. Variety: a recipe is planned at most once per started week of the plan, a batch counting once, and meat or
 *      fish already on the same day is less likely again.
 *
 * When a slot cannot be filled by these rules, the rules relax in steps instead of leaving it empty: a resting
 * recipe comes back, the least recently used first; then a recipe already in this plan, the least used first.
 * Batch recipes are few (17 of 123 seeded), so a batch span relaxes the rest before giving up its batch, as
 * workdays come first; it never repeats a batch within the plan, and becomes two single days instead. Diet and
 * hate never relax: a slot with no recipe left is left empty. Every relaxed or empty slot carries a note that
 * says why.
 *
 * A plan adjustment (I3, shared/utils/planAdjustment.ts) only adds input: recipes some slots must not get, which never
 * relax either, and lunches and dinners planned as a workday's.
 */

import { isRecipeCompatible } from "./diet";
import type { Protein } from "./diet";
import { MEAL_TYPES } from "./mealFilter";
import type { MealType } from "./mealFilter";
import { addDays, getDaysBetween, getIsoWeekday } from "./mealPlan";
import type {
  GeneratorRecipe,
  PlanGenerationInput,
  SlotAssignment,
  SlotFillNote,
} from "./planGenerator.types";
import { createSeededRandom, pickWeighted } from "./seededRandom";

// Must match the meal_plan_slots_fill_note_supported check (supabase/migrations/20261109000000_add_meal_plan_generation.sql).
export const SLOT_FILL_NOTES = [
  // Empty: no recipe of this meal type fits every participant's diet.
  "no_recipe_fits_diets",
  // Empty: every recipe that fits the diets is hated by a participant.
  "all_recipes_hated",
  // Filled with a recipe that is still resting after another plan.
  "recently_planned",
  // Filled with a recipe this plan already has.
  "repeated_in_plan",
  // A workday that should have had a batch recipe got a single-day one: none was left.
  "no_batch_recipe",
  // Empty: every recipe that fits the diets and nobody hates is left out by the plan adjustment (I3).
  "no_recipe_fits_adjustment",
] as const;

// Only lunch and dinner are cooked in batches (all seeded 2-day recipes are one of them).
export const BATCH_MEAL_TYPES = ["lunch", "dinner"] as const satisfies readonly MealType[];

export function generateMealPlan(input: PlanGenerationInput): SlotAssignment[] {
  const random = createSeededRandom(input.seed);
  const recipeById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const workdays = new Set(input.workdays);
  const quickMeals = new Set((input.quickMeals ?? []).map((meal) => getSlotKey(meal.dayIndex, meal.mealType)));
  // A workday's lunch and dinner, or one the adjustment asks to be quick, come from a batch cooked the day before.
  const isWorkMeal = (dayIndex: number, mealType: MealType): boolean =>
    workdays.has(getIsoWeekday(addDays(input.startDate, dayIndex))) || quickMeals.has(getSlotKey(dayIndex, mealType));
  const excludedBySlot = getExcludedRecipesBySlot(input);
  const isExcludedAt = (recipeId: string, dayIndex: number, mealType: MealType): boolean =>
    excludedBySlot.get(getSlotKey(dayIndex, mealType))?.has(recipeId) ?? false;
  const maxUses = MAX_USES_PER_WEEK * Math.ceil(input.dayCount / 7);
  const daysSinceUse = getDaysSinceUse(input);

  // What the plan holds so far: day → meal → recipe, and how often each recipe is planned (a batch counts once).
  const planned = new Map<number, Map<MealType, string>>();
  const uses = new Map<string, number>();
  const getPlanned = (dayIndex: number, mealType: MealType): string | undefined => planned.get(dayIndex)?.get(mealType);
  const place = (dayIndex: number, mealType: MealType, recipeId: string): void => {
    const day = planned.get(dayIndex) ?? new Map<MealType, string>();
    day.set(mealType, recipeId);
    planned.set(dayIndex, day);
  };
  const countUse = (recipeId: string): void => {
    uses.set(recipeId, (uses.get(recipeId) ?? 0) + 1);
  };

  const lockedSlots = input.slots
    .flatMap(({ dayIndex, mealType, recipeId, isLocked }) =>
      isLocked && recipeId !== null ? [{ dayIndex, mealType, recipeId }] : [],
    )
    .sort((first, second) => first.dayIndex - second.dayIndex);
  for (const slot of lockedSlots) {
    // The same recipe in the same meal on consecutive days is one batch.
    if (getPlanned(slot.dayIndex - 1, slot.mealType) !== slot.recipeId) {
      countUse(slot.recipeId);
    }
    place(slot.dayIndex, slot.mealType, slot.recipeId);
  }

  const pools = new Map(input.mealTypes.map((mealType) => [mealType, getRecipePool(input, mealType)]));

  const getWeight = (candidate: Candidate, days: readonly number[]): number => {
    const { recipe } = candidate;
    const ratings = input.participants.map((participant) => participant.ratings[recipe.id]);
    const fanCount = ratings.filter((rating) => rating === "enjoy").length;
    const lukewarmCount = ratings.filter((rating) => rating === "enjoy_less").length;
    let weight = (1 + ENJOY_BONUS * fanCount) * ENJOY_LESS_FACTOR ** lukewarmCount;
    if (candidate.needsSwap) {
      weight *= SWAP_FACTOR;
    }
    weight *= getCooldownRecovery(daysSinceUse.get(recipe.id), input.cooldownDays);
    weight *= REPEAT_FACTOR ** (uses.get(recipe.id) ?? 0);
    if (days.length === 1 && recipe.portionDays > 1) {
      weight *= LEFTOVER_FACTOR;
    }

    const proteinsThatDay = new Set<Protein>();
    for (const dayIndex of days) {
      for (const [mealType, recipeId] of planned.get(dayIndex) ?? []) {
        if (mealType !== recipe.mealType) {
          recipeById.get(recipeId)?.mainProteins.forEach((protein) => proteinsThatDay.add(protein));
        }
      }
    }
    for (const protein of recipe.mainProteins) {
      if (VARIETY_PROTEINS.has(protein) && proteinsThatDay.has(protein)) {
        weight *= SAME_DAY_PROTEIN_FACTOR;
      }
    }
    return weight;
  };

  const isNextToItself = (recipeId: string, mealType: MealType, days: readonly number[]): boolean => {
    const first = days[0] ?? 0;
    const last = days[days.length - 1] ?? first;
    return getPlanned(first - 1, mealType) === recipeId || getPlanned(last + 1, mealType) === recipeId;
  };
  const isResting = (recipeId: string): boolean => {
    const daysSince = daysSinceUse.get(recipeId);
    return daysSince !== undefined && daysSince < input.cooldownDays;
  };
  const isFresh = (candidate: Candidate, mealType: MealType, days: readonly number[]): boolean =>
    !isResting(candidate.recipe.id) &&
    (uses.get(candidate.recipe.id) ?? 0) < maxUses &&
    !isNextToItself(candidate.recipe.id, mealType, days);

  // The candidates whose last use is the longest ago: a relaxed cooldown lets those back first.
  const getLeastRecent = (candidates: readonly Candidate[]): Candidate[] => {
    const longestRest = Math.max(...candidates.map((candidate) => daysSinceUse.get(candidate.recipe.id) ?? 0));
    return candidates.filter((candidate) => (daysSinceUse.get(candidate.recipe.id) ?? 0) === longestRest);
  };

  const pick = (candidates: readonly Candidate[], days: readonly number[]): Candidate | null =>
    pickWeighted(candidates, (candidate) => getWeight(candidate, days), random);

  // The relaxation steps for one single-day slot, or the reason it stays empty.
  const chooseSingle = (mealType: MealType, dayIndex: number): { candidate: Candidate | null; note: SlotFillNote | null } => {
    const pool = pools.get(mealType);
    if (!pool?.fitting.length) {
      return { candidate: null, note: "no_recipe_fits_diets" };
    }
    if (!pool.allowed.length) {
      return { candidate: null, note: "all_recipes_hated" };
    }
    const allowed = pool.allowed.filter((candidate) => !isExcludedAt(candidate.recipe.id, dayIndex, mealType));
    if (!allowed.length) {
      return { candidate: null, note: "no_recipe_fits_adjustment" };
    }
    const days = [dayIndex];

    const fresh = allowed.filter((candidate) => isFresh(candidate, mealType, days));
    if (fresh.length) {
      return { candidate: pick(fresh, days), note: null };
    }

    const resting = allowed.filter(
      (candidate) =>
        isResting(candidate.recipe.id) &&
        (uses.get(candidate.recipe.id) ?? 0) < maxUses &&
        !isNextToItself(candidate.recipe.id, mealType, days),
    );
    if (resting.length) {
      return { candidate: pick(getLeastRecent(resting), days), note: "recently_planned" };
    }

    const apart = allowed.filter((candidate) => !isNextToItself(candidate.recipe.id, mealType, days));
    const repeatable = apart.length ? apart : allowed;
    const fewestUses = Math.min(...repeatable.map((candidate) => uses.get(candidate.recipe.id) ?? 0));
    const leastUsed = repeatable.filter((candidate) => (uses.get(candidate.recipe.id) ?? 0) === fewestUses);
    return { candidate: pick(leastUsed, days), note: "repeated_in_plan" };
  };

  const assignments = new Map<string, SlotAssignment>();
  const assign = (dayIndex: number, mealType: MealType, recipeId: string | null, note: SlotFillNote | null): void => {
    assignments.set(getSlotKey(dayIndex, mealType), { dayIndex, mealType, recipeId, note });
    if (recipeId !== null) {
      place(dayIndex, mealType, recipeId);
    }
  };

  const openSlots = input.slots
    .filter((slot) => !slot.isLocked && input.mealTypes.includes(slot.mealType) && slot.dayIndex < input.dayCount)
    .sort(compareSlots);

  const batchSpans: Span[] = [];
  const singles: Single[] = [];
  for (const mealType of input.mealTypes) {
    const openDays = openSlots.filter((slot) => slot.mealType === mealType).map((slot) => slot.dayIndex);
    const spans = BATCH_MEAL_TYPE_SET.has(mealType)
      ? planSpans(openDays, (dayIndex) => isWorkMeal(dayIndex, mealType))
      : openDays.map((day) => [day]);
    for (const days of spans) {
      if (days.length > 1) {
        batchSpans.push({ mealType, days });
      } else {
        singles.push({ mealType, dayIndex: days[0] ?? 0, isSplitBatch: false });
      }
    }
  }

  // Batches first, so the scarce batch recipes go where they save workday cooking. A batch takes a fresh batch
  // recipe, else a resting one (the least recently used), but never one this plan already has: with none left it
  // becomes single days, which relax like any other slot.
  for (const span of batchSpans.sort(compareSpans)) {
    const batchCandidates = (pools.get(span.mealType)?.allowed ?? []).filter(
      (candidate) =>
        candidate.recipe.portionDays >= span.days.length &&
        span.days.every((dayIndex) => !isExcludedAt(candidate.recipe.id, dayIndex, span.mealType)) &&
        (uses.get(candidate.recipe.id) ?? 0) < maxUses &&
        !isNextToItself(candidate.recipe.id, span.mealType, span.days),
    );
    const fresh = batchCandidates.filter((candidate) => !isResting(candidate.recipe.id));
    const { candidates, note } = fresh.length
      ? { candidates: fresh, note: null }
      : { candidates: getLeastRecent(batchCandidates), note: "recently_planned" as const };
    const chosen = pick(candidates, span.days);
    if (chosen) {
      countUse(chosen.recipe.id);
      span.days.forEach((dayIndex) => assign(dayIndex, span.mealType, chosen.recipe.id, note));
    } else {
      span.days.forEach((dayIndex) => singles.push({ mealType: span.mealType, dayIndex, isSplitBatch: true }));
    }
  }

  for (const single of singles.sort(compareSlots)) {
    const { candidate, note } = chooseSingle(single.mealType, single.dayIndex);
    if (candidate) {
      countUse(candidate.recipe.id);
    }
    const missedBatch = single.isSplitBatch && isWorkMeal(single.dayIndex, single.mealType) ? "no_batch_recipe" : null;
    assign(single.dayIndex, single.mealType, candidate?.recipe.id ?? null, note ?? missedBatch);
  }

  return openSlots.flatMap((slot) => assignments.get(getSlotKey(slot.dayIndex, slot.mealType)) ?? []);
}

interface Candidate {
  recipe: GeneratorRecipe;
  // It breaks a participant's diet, and a stored protein swap fixes that.
  needsSwap: boolean;
}

interface RecipePool {
  // Recipes of the meal type that fit every participant's diet (with a swap where needed), in id order.
  fitting: Candidate[];
  // Of those, the ones no participant hates.
  allowed: Candidate[];
}

interface Span {
  mealType: MealType;
  days: number[];
}

interface Single {
  mealType: MealType;
  dayIndex: number;
  // Laid out as part of a batch that found no batch recipe.
  isSplitBatch: boolean;
}

// A batch counts once; a 14-day plan may hold a recipe twice.
const MAX_USES_PER_WEEK = 1;
// Each participant who enjoys a recipe adds the base weight once more: one fan doubles it, two triple it.
const ENJOY_BONUS = 1;
// Each participant who enjoys a recipe less halves its weight: a weak penalty, never an exclusion.
const ENJOY_LESS_FACTOR = 0.5;
// A recipe that needs a protein swap for someone is cooked twice over, so it is less likely than one that fits.
const SWAP_FACTOR = 0.5;
// The same meat or fish twice in a day is less likely.
const SAME_DAY_PROTEIN_FACTOR = 0.5;
// A batch recipe used for a single day leaves food over, so it is less likely in a single slot.
const LEFTOVER_FACTOR = 0.3;
// Each time a recipe is already in this plan halves its weight (matters once repeats are allowed).
const REPEAT_FACTOR = 0.5;
// Right after its rest a recipe has this share of its weight, rising evenly to the full weight over the next
// `cooldownDays` days.
const COOLDOWN_RECOVERY_START = 0.5;

const BATCH_MEAL_TYPE_SET: ReadonlySet<MealType> = new Set(BATCH_MEAL_TYPES);
// Egg, dairy and plants are in most meals, so only meat and fish count for "the same protein twice a day".
const VARIETY_PROTEINS: ReadonlySet<Protein> = new Set(["fish", "poultry", "pork", "beef", "other_meat"]);

// What laying out a day costs in cooking effort: cooking fresh on a workday is the worst; a batch started on a
// workday still means cooking that day but saves the next one; a batch that touches no workday wastes a batch
// recipe a workday could have used.
const SINGLE_WORKDAY_COST = 2;
const BATCH_FROM_WORKDAY_COST = 1;
const BATCH_WITHOUT_WORKDAY_COST = 0.01;

const getSlotKey = (dayIndex: number, mealType: MealType): string => `${dayIndex}:${mealType}`;

const compareSlots = (
  first: { dayIndex: number; mealType: MealType },
  second: { dayIndex: number; mealType: MealType },
): number => first.dayIndex - second.dayIndex || MEAL_TYPES.indexOf(first.mealType) - MEAL_TYPES.indexOf(second.mealType);

const compareSpans = (first: Span, second: Span): number =>
  compareSlots({ dayIndex: first.days[0] ?? 0, mealType: first.mealType }, { dayIndex: second.days[0] ?? 0, mealType: second.mealType });

// Slot → the recipes the plan adjustment leaves out of it.
function getExcludedRecipesBySlot({ slotExclusions = [] }: PlanGenerationInput): Map<string, Set<string>> {
  const excludedBySlot = new Map<string, Set<string>>();
  for (const { dayIndex, mealType, recipeIds } of slotExclusions) {
    const key = getSlotKey(dayIndex, mealType);
    const excluded = excludedBySlot.get(key) ?? new Set<string>();
    recipeIds.forEach((recipeId) => excluded.add(recipeId));
    excludedBySlot.set(key, excluded);
  }
  return excludedBySlot;
}

// Days since each recipe was last planned before this plan starts. Uses on or after the start date do not count.
function getDaysSinceUse({ history, startDate }: PlanGenerationInput): Map<string, number> {
  const daysSinceUse = new Map<string, number>();
  for (const { recipeId, lastPlannedOn } of history) {
    const daysSince = getDaysBetween(lastPlannedOn, startDate);
    const known = daysSinceUse.get(recipeId);
    if (daysSince > 0 && (known === undefined || daysSince < known)) {
      daysSinceUse.set(recipeId, daysSince);
    }
  }
  return daysSinceUse;
}

function getCooldownRecovery(daysSince: number | undefined, cooldownDays: number): number {
  if (daysSince === undefined || cooldownDays <= 0 || daysSince >= 2 * cooldownDays) {
    return 1;
  }
  const recovered = Math.max(0, daysSince - cooldownDays) / cooldownDays;
  return COOLDOWN_RECOVERY_START + (1 - COOLDOWN_RECOVERY_START) * recovered;
}

function getRecipePool(input: PlanGenerationInput, mealType: MealType): RecipePool {
  const excludedRecipeIds = new Set(input.excludedRecipeIds);
  const fitting = input.recipes
    .filter((recipe) => recipe.mealType === mealType && !excludedRecipeIds.has(recipe.id))
    .flatMap((recipe): Candidate[] => {
      const brokenDiets = input.participants
        .map((participant) => participant.diet)
        .filter((diet) => !isRecipeCompatible(diet, recipe.mainProteins));
      const swapDiets = input.swapDiets[recipe.id] ?? [];
      if (!brokenDiets.every((diet) => swapDiets.includes(diet))) {
        return [];
      }
      return [{ recipe, needsSwap: brokenDiets.length > 0 }];
    })
    // The input order (whatever the database returned) must not change the result.
    .sort((first, second) => (first.recipe.id < second.recipe.id ? -1 : Number(first.recipe.id > second.recipe.id)));

  const allowed = fitting.filter(({ recipe }) =>
    input.participants.every((participant) => participant.ratings[recipe.id] !== "hate"),
  );
  return { fitting, allowed };
}

// Splits each run of consecutive open days into 2-day batch spans and single days, at the lowest cooking cost
// on workdays (see the *_COST constants). A Monday-to-Sunday week with Monday to Friday as workdays becomes
// Mon–Tue, Wed–Thu, Fri–Sat and Sun; a week starting on Saturday becomes Sat, Sun–Mon, Tue–Wed and Thu–Fri.
function planSpans(openDays: readonly number[], isWorkday: (dayIndex: number) => boolean): number[][] {
  const runs: number[][] = [];
  for (const dayIndex of openDays) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === dayIndex - 1) {
      run.push(dayIndex);
    } else {
      runs.push([dayIndex]);
    }
  }

  const getBatchCost = (first: number, second: number): number => {
    if (isWorkday(first)) {
      return BATCH_FROM_WORKDAY_COST;
    }
    return isWorkday(second) ? 0 : BATCH_WITHOUT_WORKDAY_COST;
  };

  return runs.flatMap((run) => {
    // costFrom[i]: the lowest cost of laying out run[i..]; lengthAt[i]: the span length that achieves it.
    const costFrom: number[] = new Array<number>(run.length + 1).fill(0);
    const lengthAt: number[] = new Array<number>(run.length).fill(1);
    for (let i = run.length - 1; i >= 0; i--) {
      const day = run[i] ?? 0;
      const singleCost = (isWorkday(day) ? SINGLE_WORKDAY_COST : 0) + (costFrom[i + 1] ?? 0);
      const next = run[i + 1];
      const batchCost = next === undefined ? Infinity : getBatchCost(day, next) + (costFrom[i + 2] ?? 0);
      // On a tie the single day wins, which keeps a batch recipe for a day that needs it more.
      lengthAt[i] = batchCost < singleCost ? 2 : 1;
      costFrom[i] = Math.min(batchCost, singleCost);
    }

    const spans: number[][] = [];
    for (let i = 0; i < run.length; i += lengthAt[i] ?? 1) {
      spans.push(run.slice(i, i + (lengthAt[i] ?? 1)));
    }
    return spans;
  });
}

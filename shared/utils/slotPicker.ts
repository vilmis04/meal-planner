/*
 * Rules for choosing a recipe for a plan slot (E3): which recipes the picker offers, which following slots a
 * batch recipe can fill, and who hates a recipe. Pure, so the picker and its tests share them.
 *
 * The database checks the same meal type and batch rules in set_meal_plan_slot()
 * (supabase/migrations/20261108000000_add_meal_plan_slot_editing.sql).
 */

import type { MealType } from "./mealFilter";

export interface PickableRecipe {
  id: string;
  name: string;
  mealType: MealType;
  portionDays: number;
}

export interface PlanSlotRef {
  id: string;
  dayIndex: number;
  mealType: MealType;
  recipeId: string | null;
}

export interface PlanMemberRef {
  userId: string;
  displayName: string;
}

// Lower case without accents, so "kiausiniai" finds "Kiaušiniai" and "SRIUBA" finds "sriuba".
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// The recipes a slot can take: its own meal type only, every word of the search somewhere in the name, by name.
// The slot's current recipe comes first, so the choice that is already made is on top.
export function filterSlotRecipes<T extends PickableRecipe>(
  recipes: readonly T[],
  mealType: MealType,
  query: string,
  options: { currentRecipeId?: string | null; locale?: string } = {},
): T[] {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  const collator = new Intl.Collator(options.locale, { sensitivity: "base" });

  return recipes
    .filter((recipe) => recipe.mealType === mealType)
    .filter((recipe) => {
      const name = normalizeSearch(recipe.name);
      return words.every((word) => name.includes(word));
    })
    .sort((a, b) => {
      const aCurrent = a.id === options.currentRecipeId ? 0 : 1;
      const bCurrent = b.id === options.currentRecipeId ? 0 : 1;
      return aCurrent - bCurrent || collator.compare(a.name, b.name);
    });
}

// How many meal type recipes the slot can choose from, for "Search 32 dinners".
export function countSlotRecipes(recipes: readonly PickableRecipe[], mealType: MealType): number {
  return recipes.filter((recipe) => recipe.mealType === mealType).length;
}

export interface BatchTarget<S extends PlanSlotRef> {
  // The same meal on the following days that the batch would fill, in day order. Empty when there is none.
  slots: S[];
  // The fill_days to send for "fill them all": 1 + the slots above.
  fillDays: number;
  // Following slots that hold another recipe now and would be replaced.
  replaced: S[];
  // True when filling them changes something, so the picker asks. False on the last day of a plan, for a
  // one-day recipe, or when the following days already hold this recipe.
  isOffered: boolean;
}

// The slots a recipe cooked for portionDays days could also fill after `slot`: the same meal on each next day,
// stopping at the end of the plan.
export function getBatchTarget<S extends PlanSlotRef>(
  slots: readonly S[],
  slot: PlanSlotRef,
  recipe: Pick<PickableRecipe, "id" | "portionDays">,
): BatchTarget<S> {
  const following: S[] = [];
  for (let offset = 1; offset < recipe.portionDays; offset++) {
    const next = slots.find((candidate) => candidate.mealType === slot.mealType && candidate.dayIndex === slot.dayIndex + offset);
    if (!next) {
      break;
    }
    following.push(next);
  }

  const replaced = following.filter((next) => next.recipeId !== null && next.recipeId !== recipe.id);
  return {
    slots: following,
    fillDays: following.length + 1,
    replaced,
    isOffered: following.some((next) => next.recipeId !== recipe.id),
  };
}

// Who hates each recipe, from meal_plan_hated_recipes() rows: recipe id → user ids.
export function groupHatedRecipes(rows: readonly { recipeId: string; userId: string }[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const { recipeId, userId } of rows) {
    const users = (grouped[recipeId] ??= []);
    if (!users.includes(userId)) {
      users.push(userId);
    }
  }
  return grouped;
}

export interface HateWarning {
  // The viewer hates it: shown as "You".
  includesViewer: boolean;
  // The other people who hate it, by name, in the household's member order.
  names: string[];
  // Participants the viewer has no name for (not in the loaded household), counted only.
  unnamedCount: number;
}

// The warning for one recipe, or null when no participant hates it.
export function getHateWarning(
  recipeId: string,
  hated: Readonly<Record<string, readonly string[]>>,
  members: readonly PlanMemberRef[],
  viewerId: string | null | undefined,
): HateWarning | null {
  const userIds = hated[recipeId];
  if (!userIds?.length) {
    return null;
  }

  const others = userIds.filter((userId) => userId !== viewerId);
  const named = members.filter((member) => others.includes(member.userId));
  return {
    includesViewer: Boolean(viewerId) && userIds.includes(viewerId!),
    names: named.map((member) => member.displayName),
    unnamedCount: others.length - named.length,
  };
}

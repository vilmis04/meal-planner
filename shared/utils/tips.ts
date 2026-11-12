import type { RecipeTipMatch, TaggedTip, TipIngredient } from "./tips.types";

/*
 * Tips in context (X3): which of the tips (public.tips, translated in tip_translations) a screen shows. A tip has
 * free-form tags; what they are matched against was added by
 * supabase/migrations/20261127000000_add_tip_matching.sql:
 *
 *   * Ingredient tips: a canonical ingredient has tip tags (ingredients.tip_tags). A tip matches an ingredient when
 *     they share a tag. A shopping list line shows its ingredient's tips; a recipe shows the tips of the ingredients
 *     its lines map to (by their Lithuanian item, through ingredient_aliases), most-matched first.
 *   * Plan tips: tips tagged PLAN_TIP_TAG are shown on the plan page; one also tagged HOUSEHOLD_TIP_TAG only on a plan
 *     for more than one person.
 *
 * Tips keep the order they are given in (the order they are read), so the same tips always show the same way.
 */

export const PLAN_TIP_TAG = "plan";
export const HOUSEHOLD_TIP_TAG = "family";

const sharesTag = (tip: TaggedTip, tags: readonly string[]): boolean => tip.tags.some((tag) => tags.includes(tag));

// The tips about an ingredient with these tip tags; none for an ingredient without tags.
export function getIngredientTips<T extends TaggedTip>(tips: readonly T[], tipTags: readonly string[]): T[] {
  return tipTags.length === 0 ? [] : tips.filter((tip) => sharesTag(tip, tipTags));
}

// The tips about a recipe's ingredients, given the Lithuanian items of its lines. A tip about more of the recipe's
// ingredients comes first; lines naming the same ingredient count once, and items no ingredient knows are skipped.
export function getRecipeTips<T extends TaggedTip>(
  tips: readonly T[],
  ingredients: readonly TipIngredient[],
  items: readonly string[],
): RecipeTipMatch<T>[] {
  const ingredientByItem = new Map(ingredients.flatMap((ingredient) => ingredient.aliases.map((alias) => [alias, ingredient])));
  const recipeIngredients = [
    ...new Set(items.flatMap((item) => ingredientByItem.get(item) ?? [])),
  ].filter((ingredient) => ingredient.tipTags.length > 0);

  return tips
    .map((tip) => ({
      tip,
      ingredientIds: recipeIngredients.filter((ingredient) => sharesTag(tip, ingredient.tipTags)).map(({ id }) => id),
    }))
    .filter((match) => match.ingredientIds.length > 0)
    .sort((first, second) => second.ingredientIds.length - first.ingredientIds.length);
}

// The plan page's tips for a plan with this many participants.
export function getPlanTips<T extends TaggedTip>(tips: readonly T[], participantCount: number): T[] {
  return tips.filter(
    (tip) => tip.tags.includes(PLAN_TIP_TAG) && (participantCount > 1 || !tip.tags.includes(HOUSEHOLD_TIP_TAG)),
  );
}

// Which of count tips a plan shows first: the same for the same plan (and on the server and in the browser), and
// different from plan to plan, so tips take turns. 0 when there are none.
export function getTipStartIndex(seed: string, count: number): number {
  if (count <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 2_147_483_647;
  }
  return hash % count;
}

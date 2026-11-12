// A tip as the matching rules (shared/utils/tips.ts) see it: its id and its tags.
export interface TaggedTip {
  id: string;
  tags: readonly string[];
}

// A canonical ingredient (G1) with the tip tags it is about (X3) and the recipe items that map to it (its aliases).
export interface TipIngredient {
  id: string;
  tipTags: readonly string[];
  aliases: readonly string[];
}

// A tip a recipe shows, with the recipe's ingredients it is about, in the order the recipe lists them.
export interface RecipeTipMatch<T extends TaggedTip> {
  tip: T;
  ingredientIds: string[];
}

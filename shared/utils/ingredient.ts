/*
 * Shopping categories of canonical ingredients (G1), in the order a shopping list shows them (G3): roughly the walk
 * through a shop, with "other" last. The database stores the snake_case value (ingredients.category) and must allow
 * exactly these: the ingredients_category_supported constraint and the report list them too, and a test compares them.
 * To add a category, add it here, replace the constraint in a new migration and add it to the report.
 */
export const INGREDIENT_CATEGORIES = [
  "fruit_and_vegetables",
  "meat_and_fish",
  "dairy_and_eggs",
  "grains_and_bread",
  "pantry",
  "frozen",
  "other",
] as const;

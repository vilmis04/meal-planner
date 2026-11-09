import { z } from "zod";
import { INGREDIENT_CATEGORIES } from "#shared/utils/ingredient";
import { SHOPPING_ITEM_SOURCES, SHOPPING_ITEM_STATES } from "#shared/utils/shoppingList";
import type { ShoppingItem } from "#shared/utils/shoppingList.types";

// A plan's list and its lines (G2), as the list page reads them. Row level security shows lists of plans the viewer
// can open only.
export const SHOPPING_LIST_COLUMNS =
  "id, source_version, generated_version, missing_swap_count, shopping_items(id, source, name, category, amount, unit, is_extra, swapped_for, in_plan, state, is_removed, amount_override, added_by)";

// The columns of a line as both PostgREST and Realtime (G6) send them.
export const shoppingItemColumnsSchema = z.object({
  id: z.guid(),
  source: z.enum(SHOPPING_ITEM_SOURCES),
  name: z.string(),
  category: z.enum(INGREDIENT_CATEGORIES),
  amount: z.number().positive().nullable(),
  unit: z.string().nullable(),
  is_extra: z.boolean(),
  swapped_for: z.array(z.guid()),
  in_plan: z.boolean(),
  state: z.enum(SHOPPING_ITEM_STATES),
  is_removed: z.boolean(),
  amount_override: z.number().positive().nullable(),
  added_by: z.guid().nullable(),
});

export const toShoppingItem = (row: z.output<typeof shoppingItemColumnsSchema>): ShoppingItem => ({
  id: row.id,
  source: row.source,
  name: row.name,
  category: row.category,
  amount: row.amount,
  unit: row.unit,
  isExtra: row.is_extra,
  swappedFor: row.swapped_for,
  inPlan: row.in_plan,
  state: row.state,
  isRemoved: row.is_removed,
  amountOverride: row.amount_override,
  addedBy: row.added_by,
});

const shoppingItemRowSchema = shoppingItemColumnsSchema.transform(toShoppingItem);

export const shoppingListRowSchema = z
  .object({
    id: z.guid(),
    source_version: z.number().int().min(0),
    generated_version: z.number().int().min(0),
    missing_swap_count: z.number().int().min(0),
    shopping_items: z.array(shoppingItemRowSchema),
  })
  .transform((row) => ({
  id: row.id,
    sourceVersion: row.source_version,
    generatedVersion: row.generated_version,
    missingSwapCount: row.missing_swap_count,
    items: row.shopping_items,
  }));

// POST /api/plans/:id/shopping-list (server/api/plans/[id]/shopping-list.post.ts) when it succeeded; "list-changed" comes
// with a 409, which fetch treats as a failure.
export const shoppingListRefreshResponseSchema = z.object({
  status: z.enum(["up-to-date", "refreshed"]),
});

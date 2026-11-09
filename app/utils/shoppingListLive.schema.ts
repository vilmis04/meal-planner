import { z } from "zod";
import type { RemoteShoppingItemChange, RemoteShoppingListChange } from "~/types/shoppingList.types";
import { shoppingItemColumnsSchema, toShoppingItem } from "./shoppingList";

// Realtime "postgres_changes" payloads for the list page (G6), as supabase-js hands them over (numbers and arrays
// already converted). Anything else is refused, and the page then reads the list again instead of guessing.

const upsertedItemSchema = z
  .object({
    eventType: z.enum(["INSERT", "UPDATE"]),
    new: shoppingItemColumnsSchema.extend({ list_id: z.guid() }),
  })
  .transform((payload): RemoteShoppingItemChange => ({
    kind: "upsert",
    listId: payload.new.list_id,
    item: toShoppingItem(payload.new),
  }));

// Under row level security a deleted row comes as its primary key only.
const deletedItemSchema = z
  .object({ eventType: z.literal("DELETE"), old: z.object({ id: z.guid() }) })
  .transform((payload): RemoteShoppingItemChange => ({ kind: "delete", itemId: payload.old.id }));

export const remoteShoppingItemChangeSchema = z.union([upsertedItemSchema, deletedItemSchema]);

export const remoteShoppingListChangeSchema = z
  .object({
    new: z.object({
      id: z.guid(),
      source_version: z.number().int().min(0),
      generated_version: z.number().int().min(0),
      missing_swap_count: z.number().int().min(0),
    }),
  })
  .transform(
    (payload): RemoteShoppingListChange => ({
      listId: payload.new.id,
      sourceVersion: payload.new.source_version,
      generatedVersion: payload.new.generated_version,
      missingSwapCount: payload.new.missing_swap_count,
    }),
  );

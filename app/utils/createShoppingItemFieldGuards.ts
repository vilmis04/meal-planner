import type { ShoppingItemGuardedField } from "~/types/shoppingList.types";

// How long a saved change keeps winning over what other copies of the list send while its own echo from Realtime has
// not arrived (G6). The echo normally comes within a second; without Realtime the guard simply runs out.
export const REMOTE_ECHO_WAIT_MS = 3000;

interface FieldGuard {
  changeId: number;
  value: unknown;
  // When the database confirmed the change (performance.now()); null while it is on the way.
  settledAt: number | null;
  // The echo arrived before the database's answer did.
  isEchoed: boolean;
}

// The fields of each line this viewer is changing (G4, G6). They decide two things: a refused change puts back only the
// fields nobody changed again since (G4), and a change another copy of the list sends never overwrites a field this
// viewer has on the way, nor right after it was saved, until the database's echo of it arrives (G6). Without that, an
// older change arriving late would flick a line back for a moment, or keep it wrong.
export function createShoppingItemFieldGuards() {
  // Line id → field → its newest change.
  const guards = new Map<string, Map<ShoppingItemGuardedField, FieldGuard>>();
  let changeCount = 0;

  const begin = (itemId: string, values: Partial<Record<ShoppingItemGuardedField, unknown>>): number => {
    const changeId = ++changeCount;
    const itemGuards = guards.get(itemId) ?? new Map<ShoppingItemGuardedField, FieldGuard>();
    for (const [field, value] of getEntries(values)) {
      itemGuards.set(field, { changeId, value, settledAt: null, isEchoed: false });
    }
    guards.set(itemId, itemGuards);
    return changeId;
  };

  const isLatest = (itemId: string, field: string, changeId: number): boolean =>
    [...(guards.get(itemId)?.entries() ?? [])].some(
      ([guardedField, guard]) => guardedField === field && guard.changeId === changeId,
    );

  // A refused change stops guarding at once; a saved one keeps guarding until its echo arrives or the wait runs out.
  const settle = (itemId: string, changeId: number, isSaved: boolean, now: number): void => {
    const itemGuards = guards.get(itemId);
    if (itemGuards === undefined) {
      return;
    }
    for (const [field, guard] of itemGuards) {
      if (guard.changeId !== changeId) {
        continue;
      }
      if (!isSaved || guard.isEchoed) {
        itemGuards.delete(field);
      } else {
        guard.settledAt = now;
      }
    }
    forgetEmpty(itemId);
  };

  // What another copy of the list says a line now holds; a field holding this viewer's value is its echo.
  const acknowledge = (itemId: string, values: Partial<Record<ShoppingItemGuardedField, unknown>>): void => {
    const itemGuards = guards.get(itemId);
    if (itemGuards === undefined) {
      return;
    }
    for (const [field, value] of getEntries(values)) {
      const guard = itemGuards.get(field);
      if (guard === undefined || guard.value !== value) {
        continue;
      }
      if (guard.settledAt === null) {
        guard.isEchoed = true;
      } else {
        itemGuards.delete(field);
      }
    }
    forgetEmpty(itemId);
  };

  const getGuardedFields = (itemId: string, now: number): ReadonlySet<ShoppingItemGuardedField> => {
    const itemGuards = guards.get(itemId);
    if (itemGuards === undefined) {
      return new Set();
    }
    for (const [field, guard] of itemGuards) {
      if (guard.settledAt !== null && now - guard.settledAt >= REMOTE_ECHO_WAIT_MS) {
        itemGuards.delete(field);
      }
    }
    forgetEmpty(itemId);
    return new Set(itemGuards.keys());
  };

  const forgetEmpty = (itemId: string): void => {
    if (guards.get(itemId)?.size === 0) {
      guards.delete(itemId);
    }
  };

  const getEntries = (
    values: Partial<Record<ShoppingItemGuardedField, unknown>>,
  ): [ShoppingItemGuardedField, unknown][] =>
    GUARDED_FIELDS.filter((field) => field in values).map((field): [ShoppingItemGuardedField, unknown] => [
      field,
      values[field],
    ]);

  return { begin, isLatest, settle, acknowledge, getGuardedFields };
}

const GUARDED_FIELDS: readonly ShoppingItemGuardedField[] = [
  "state",
  "isRemoved",
  "amountOverride",
  "amount",
  "unit",
  "shopId",
  "boughtAmount",
  "boughtUnit",
  "isPresent",
];

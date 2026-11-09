import { z } from "zod";
import type { StoredGroupExpansion } from "~/types/shoppingList.types";

// Which list groups a viewer opened or closed (G3) is remembered in this browser only: it is a convenience while
// shopping, not something other people or devices need. The newest lists are kept, so the entry stays small.
export const GROUP_EXPANSION_STORAGE_KEY = "meal-planner:shopping-list-groups";
const REMEMBERED_LIST_LIMIT = 10;

const storedGroupExpansionSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

// Anything unreadable (another version's shape, a hand edit) counts as nothing saved.
export function parseStoredGroupExpansion(storedValue: string | null): StoredGroupExpansion {
  if (storedValue === null) {
    return {};
  }
  const parsedJson = parseJson(storedValue);
  const result = storedGroupExpansionSchema.safeParse(parsedJson);
  return result.success ? result.data : {};
}

// The saved state with one group of one list changed; that list becomes the newest and the oldest beyond the limit
// are dropped.
export function setStoredGroupExpansion(
  stored: StoredGroupExpansion,
  listId: string,
  groupKey: string,
  isExpanded: boolean,
): StoredGroupExpansion {
  const { [listId]: listGroups, ...otherLists } = stored;
  const keptLists = Object.entries(otherLists).slice(-(REMEMBERED_LIST_LIMIT - 1));
  return { ...Object.fromEntries(keptLists), [listId]: { ...listGroups, [groupKey]: isExpanded } };
}

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

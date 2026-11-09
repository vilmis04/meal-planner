import type { NewShoppingItem, ShoppingItemAmountChange } from "#shared/utils/shoppingItemEdit.types";
import type { ShoppingItem, ShoppingItemState } from "#shared/utils/shoppingList.types";
import type {
  RemoteShoppingItemChange,
  ShoppingItemEditResult,
  ShoppingItemGuardedField,
  ShoppingItemPatch,
} from "~/types/shoppingList.types";

interface RpcResponse {
  error: { message: string } | null;
}

// Changes to a shopping list (G4), one line and one field at a time through the list functions, so two people
// changing different lines never overwrite each other. The page shows a change at once; when the database refuses
// it, the changed fields go back, unless the same field of the same line was changed again meanwhile.
// Calls for one line are sent one after another (G5): ticking a line twice quickly must reach the database in that
// order, or it could end up bought while the page shows it unticked.
// Other members' changes (G6) come in through applyRemoteChange() and fresh reads through applyStoredItems(); both
// keep the fields this viewer has on the way (createShoppingItemFieldGuards()).
export function useShoppingItemEdits(items: Ref<ShoppingItem[]>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  // Which fields this viewer is changing: a late refusal cannot undo a later change, and a remote change cannot
  // overwrite one on the way.
  const guards = createShoppingItemFieldGuards();
  const sendInOrder = createOrderedSender();
  // The newest remote changes, numbered from 0 in arrival order, so a read that started before some of them arrived can
  // apply them again on top of what it read (it may have read the database before they happened).
  const recentRemoteChanges: { number: number; change: RemoteShoppingItemChange }[] = [];
  let remoteChangeCount = 0;

  const getGuardedFields = (itemId: string): ReadonlySet<ShoppingItemGuardedField> =>
    guards.getGuardedFields(itemId, performance.now());

  // A change to a line from Realtime: another member's, or the echo of this viewer's own.
  const applyRemoteChange = (change: RemoteShoppingItemChange): void => {
    recentRemoteChanges.push({ number: remoteChangeCount++, change });
    if (recentRemoteChanges.length > MAX_RECENT_REMOTE_CHANGES) {
      recentRemoteChanges.shift();
    }
    if (change.kind === "upsert") {
      guards.acknowledge(change.item.id, { ...change.item, isPresent: true });
    } else {
      guards.acknowledge(change.itemId, { isPresent: false });
    }
    items.value = applyRemoteShoppingItemChange(items.value, change, getGuardedFields);
  };

  // How many remote changes have arrived; a read takes this before it starts and hands it to applyStoredItems().
  const countRemoteChanges = (): number => remoteChangeCount;

  // The lines as read from the database, then the remote changes that arrived since the read started.
  const applyStoredItems = (stored: readonly ShoppingItem[], remoteChangesBefore: number): void => {
    const merged = mergeStoredShoppingItems(items.value, stored, getGuardedFields);
    items.value = recentRemoteChanges
      .filter(({ number }) => number >= remoteChangesBefore)
      .reduce((lines, { change }) => applyRemoteShoppingItemChange(lines, change, getGuardedFields), merged);
  };

  // The app picks the id, so the line keeps the id it is shown with and a retried call adds it once.
  const addItem = (listId: string, newItem: NewShoppingItem): Promise<ShoppingItemEditResult> =>
    insertItem(listId, {
      id: crypto.randomUUID(),
      source: "manual",
      ...newItem,
      isExtra: false,
      swappedFor: [],
      inPlan: true,
      state: "to_buy",
      isRemoved: false,
      amountOverride: null,
      addedBy: user.value?.id ?? null,
    });

  // A generated line's change is an override of the plan's amount; the plan's amount itself clears it.
  const setAmount = (item: ShoppingItem, change: ShoppingItemAmountChange): Promise<ShoppingItemEditResult> => {
    const patch: ShoppingItemPatch =
      item.source === "generated"
        ? { amountOverride: change.amount === item.amount ? null : change.amount }
        : { amount: change.amount, unit: change.unit };
    return changeItem(item.id, patch, () =>
      supabase.rpc("set_shopping_item_amount", {
        target_item_id: item.id,
        new_amount: change.amount,
        new_unit: change.unit,
      }),
    );
  };

  const setState = (itemId: string, state: ShoppingItemState): Promise<ShoppingItemEditResult> =>
    changeItem(itemId, { state }, () =>
      supabase.rpc("set_shopping_item_state", { target_item_id: itemId, new_state: state }),
    );

  // A generated line is only marked removed; a manual one is deleted, and taken off the page at once.
  const removeItem = async (item: ShoppingItem): Promise<ShoppingItemEditResult> => {
    if (item.source === "generated") {
      return changeItem(item.id, { isRemoved: true }, () =>
        supabase.rpc("remove_shopping_item", { target_item_id: item.id }),
      );
    }

    const changeId = guards.begin(item.id, { isPresent: false });
    items.value = items.value.filter((line) => line.id !== item.id);
    const { error } = await sendInOrder(item.id, () =>
      supabase.rpc("remove_shopping_item", { target_item_id: item.id }),
    );
    // Someone else removed it first: it is gone either way.
    if (!error || error.message === "item_not_found") {
      guards.settle(item.id, changeId, true, performance.now());
      return { isSaved: true };
    }
    console.error("Removing the shopping item failed", error);
    const isStillOurs = guards.isLatest(item.id, "isPresent", changeId);
    guards.settle(item.id, changeId, false, performance.now());
    if (isStillOurs && !items.value.some((line) => line.id === item.id)) {
      items.value = [...items.value, item];
    }
    return { isSaved: false, errorKey: getShoppingItemErrorKey(error) };
  };

  // Undoes a removal: a generated line comes back, a manual one is added again as it was.
  const restoreItem = (listId: string, item: ShoppingItem): Promise<ShoppingItemEditResult> => {
    if (item.source === "generated") {
      return changeItem(item.id, { isRemoved: false }, () =>
        supabase.rpc("restore_shopping_item", { target_item_id: item.id }),
      );
    }
    return insertItem(listId, item);
  };

  const insertItem = async (listId: string, item: ShoppingItem): Promise<ShoppingItemEditResult> => {
    const changeId = guards.begin(item.id, { isPresent: true });
    items.value = [...items.value.filter((line) => line.id !== item.id), item];
    const { error } = await sendInOrder(item.id, () =>
      supabase.rpc("add_shopping_item", {
        target_list_id: listId,
        new_item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        item_amount: item.amount,
        item_unit: item.unit,
      }),
    );
    if (error) {
      console.error("Adding the shopping item failed", error);
      const isStillOurs = guards.isLatest(item.id, "isPresent", changeId);
      guards.settle(item.id, changeId, false, performance.now());
      if (isStillOurs) {
        items.value = items.value.filter((line) => line.id !== item.id);
      }
      return { isSaved: false, errorKey: getShoppingItemErrorKey(error) };
    }
    guards.settle(item.id, changeId, true, performance.now());
    // A line added again by an undo keeps being at home, or bought, if it was.
    if (item.state === "to_buy") {
      return { isSaved: true };
    }
    return changeItem(item.id, { state: item.state }, () =>
      supabase.rpc("set_shopping_item_state", { target_item_id: item.id, new_state: item.state }),
    );
  };

  const changeItem = async (
    itemId: string,
    patch: ShoppingItemPatch,
    send: () => PromiseLike<RpcResponse>,
  ): Promise<ShoppingItemEditResult> => {
    const current = items.value.find((item) => item.id === itemId);
    if (current === undefined) {
      return { isSaved: false, errorKey: "shoppingList.errors.itemNotFound" };
    }

    const previous = getPatchedFields(current, patch);
    const changeId = guards.begin(itemId, patch);
    items.value = patchShoppingItem(items.value, itemId, patch);

    const { error } = await sendInOrder(itemId, send);
    if (!error) {
      guards.settle(itemId, changeId, true, performance.now());
      return { isSaved: true };
    }

    console.error("Saving the shopping item failed", error);
    const stillOurs = Object.entries(previous).filter(([field]) => guards.isLatest(itemId, field, changeId));
    guards.settle(itemId, changeId, false, performance.now());
    items.value = patchShoppingItem(items.value, itemId, Object.fromEntries(stillOurs));
    return { isSaved: false, errorKey: getShoppingItemErrorKey(error) };
  };

  return {
    addItem,
    setAmount,
    setState,
    removeItem,
    restoreItem,
    applyRemoteChange,
    countRemoteChanges,
    applyStoredItems,
  };
}

// Enough for any read to finish within; older changes are already in what a read returns.
const MAX_RECENT_REMOTE_CHANGES = 500;

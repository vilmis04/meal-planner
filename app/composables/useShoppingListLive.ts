import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ShoppingListLiveHandlers, ShoppingListLiveStatus } from "~/types/shoppingList.types";

// Live updates of one shopping list (G6) through Supabase Realtime "postgres_changes". Realtime sends a change only to
// subscribers whose row level security lets them read the row, so household members hear each other's changes to a
// household plan's list and nobody else hears them. The page listens to its own list's lines being added or changed,
// to any line being deleted (a deleted row comes as its id only and cannot be filtered by list; ids it does not show
// are ignored), to the purchases of its lines (G7: the shop of a bought line; deleted ones likewise come as the line's
// id only) and to its list row (the plan changed, or the list was rebuilt).
// Changes can be missed while the page is not subscribed (before the first subscription, while reconnecting, or while
// a phone sleeps with the tab in the background), so the page catches up each time it subscribes and each time the tab
// comes back. Only in the browser; the channel is removed when the page goes.
export function useShoppingListLive(listId: () => string | null, handlers: ShoppingListLiveHandlers) {
  const supabase = useSupabaseClient();
  const status = ref<ShoppingListLiveStatus>("connecting");
  let channel: RealtimeChannel | null = null;

  const handleItemPayload = (payload: unknown) => {
    const result = remoteShoppingItemChangeSchema.safeParse(payload);
    if (!result.success) {
      console.error("Unexpected shopping item change", result.error);
      handlers.onCatchUp();
      return;
    }
    if (result.data.kind === "upsert" && result.data.listId !== listId()) {
      return;
    }
    handlers.onItemChange(result.data);
  };

  const handlePurchasePayload = (payload: unknown) => {
    const result = remotePurchaseChangeSchema.safeParse(payload);
    if (!result.success) {
      console.error("Unexpected purchase change", result.error);
      handlers.onCatchUp();
      return;
    }
    if (result.data.kind === "purchase_upsert" && result.data.listId !== listId()) {
      return;
    }
    handlers.onItemChange(result.data);
  };

  const handleListPayload = (payload: unknown) => {
    const result = remoteShoppingListChangeSchema.safeParse(payload);
    if (!result.success) {
      console.error("Unexpected shopping list change", result.error);
      handlers.onCatchUp();
      return;
    }
    if (result.data.listId === listId()) {
      handlers.onListChange(result.data);
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      handlers.onCatchUp();
    }
  };

  const subscribe = (currentListId: string) => {
    // A topic of its own per page visit: supabase-js hands back an existing channel with the same topic, which may be
    // one a page that is going away is still closing.
    const subscribedChannel = supabase
      .channel(`shopping-list:${currentListId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shopping_items", filter: `list_id=eq.${currentListId}` },
        handleItemPayload,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shopping_items", filter: `list_id=eq.${currentListId}` },
        handleItemPayload,
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "shopping_items" }, handleItemPayload)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "purchases", filter: `list_id=eq.${currentListId}` },
        handlePurchasePayload,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "purchases", filter: `list_id=eq.${currentListId}` },
        handlePurchasePayload,
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "purchases" }, handlePurchasePayload)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shopping_lists", filter: `id=eq.${currentListId}` },
        handleListPayload,
      )
      .subscribe((subscribeStatus, error) => {
        // A channel this page already let go of reports CLOSED; that is not this page's status any more.
        if (channel !== subscribedChannel) {
          return;
        }
        if (subscribeStatus === "SUBSCRIBED") {
          status.value = "live";
          handlers.onCatchUp();
          return;
        }
        if (error) {
          console.warn("Live updates of the shopping list paused", subscribeStatus, error);
        }
        status.value = "reconnecting";
      });
    channel = subscribedChannel;
  };

  const unsubscribe = () => {
    if (channel !== null) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };

  onMounted(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    watch(
      listId,
      (currentListId) => {
        unsubscribe();
        status.value = "connecting";
        if (currentListId !== null) {
          subscribe(currentListId);
        }
      },
      { immediate: true },
    );
  });

  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    unsubscribe();
  });

  return { status: readonly(status) };
}

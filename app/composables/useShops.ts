import { z } from "zod";
import type { Shop } from "#shared/utils/shop.types";

const shopRowsSchema = z.array(z.object({ id: z.guid(), name: z.string() }));

// The shops the viewer can pick from (G7): their household's, or their own without a household (row level security
// shows only those). They are read with the list; a shop someone else adds shows up when a line names it (the page then
// reads them again), and one this viewer adds shows at once with the id the page suggested for it.
export function useShops() {
  const supabase = useSupabaseClient();
  const shops = ref<Shop[]>([]);

  // Null when they could not be read; the list still works, with names missing until a later read.
  const loadShops = async (): Promise<Shop[] | null> => {
    const { data, error } = await supabase.from("shops").select("id, name").order("name");
    const result = error ? null : shopRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the shops failed", error ?? result?.error);
      return null;
    }
    return result.data;
  };

  const reloadShops = createCoalescedRunner(async () => {
    const loaded = await loadShops();
    if (loaded !== null) {
      shops.value = loaded;
    }
  });

  // A shop this viewer is adding, shown before the database has it; the next read replaces it with what is stored.
  const addShop = (shop: Shop): void => {
    if (!shops.value.some((known) => known.id === shop.id)) {
      shops.value = [...shops.value, shop];
    }
  };

  return { shops, loadShops, reloadShops, addShop };
}

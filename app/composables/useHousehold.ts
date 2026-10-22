import type { CreateHouseholdResult, Household } from "~/types/household.types";

export function useHousehold() {
  const supabase = useSupabaseClient();
  const household = useState<Household | null>("household", () => null);
  // Kept apart from "no household", so the create form is never offered to someone who may already have one.
  const loadFailed = useState<boolean>("household-load-failed", () => false);

  const load = async (): Promise<void> => {
    const { data, error } = await supabase
      .from("household_members")
      .select(HOUSEHOLD_MEMBER_COLUMNS)
      .order("joined_at");

    const result = error ? null : householdRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the household failed", error ?? result?.error);
      loadFailed.value = true;
      return;
    }

    household.value = result.data;
    loadFailed.value = false;
  };

  const create = async (name: string): Promise<CreateHouseholdResult> => {
    const { error } = await supabase.rpc("create_household", { household_name: name.trim() });

    if (error) {
      console.error("Creating the household failed", error);
      // Created or joined elsewhere in the meantime: show what is actually there.
      if (error.message === ALREADY_IN_HOUSEHOLD_ERROR) {
        await load();
      }
      return { isCreated: false, errorKey: getHouseholdErrorKey(error) };
    }

    await load();
    return household.value
      ? { isCreated: true }
      : { isCreated: false, errorKey: getHouseholdErrorKey({ message: "" }) };
  };

  const clear = (): void => {
    household.value = null;
    loadFailed.value = false;
  };

  return { household: readonly(household), loadFailed: readonly(loadFailed), load, create, clear };
}

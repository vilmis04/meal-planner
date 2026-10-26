import type { CreateHouseholdResult, Household, MemberActionResult } from "~/types/household.types";

// Errors that mean what the screen shows is out of date, so it is reloaded to show what is really there.
const STALE_STATE_ERRORS = [
  NOT_OWNER_ERROR,
  MEMBER_NOT_FOUND_ERROR,
  NOT_IN_HOUSEHOLD_ERROR,
  OWNER_MUST_TRANSFER_ERROR,
];

export function useHousehold() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { clear: clearInvite } = useHouseholdInvite();
  const household = useState<Household | null>("household", () => null);
  // Kept apart from "no household", so the create form is never offered to someone who may already have one.
  const loadFailed = useState<boolean>("household-load-failed", () => false);

  const isOwner = computed(() =>
    Boolean(household.value?.members.some((member) => member.userId === user.value?.id && member.role === "owner")),
  );

  // A silent load is for refreshing a screen that is already showing a household: if it fails,
  // the household on screen stays instead of being replaced by an error.
  const load = async (options?: { isSilent?: boolean }): Promise<void> => {
    const { data, error } = await supabase
      .from("household_members")
      .select(HOUSEHOLD_MEMBER_COLUMNS)
      .order("joined_at");

    const result = error ? null : householdRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the household failed", error ?? result?.error);
      if (!options?.isSilent) {
        loadFailed.value = true;
      }
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

  const fail = async (
    logMessage: string,
    error: { message: string },
    fallbackKey: string,
  ): Promise<MemberActionResult> => {
    console.error(logMessage, error);
    if (STALE_STATE_ERRORS.includes(error.message)) {
      await load({ isSilent: true });
    }
    const errorKey = getHouseholdErrorKey(error);
    // The create-household message for an unknown error would be wrong here.
    return { isDone: false, errorKey: errorKey === GENERIC_HOUSEHOLD_ERROR_KEY ? fallbackKey : errorKey };
  };

  // Owner only. The person loses access to the household at once.
  const removeMember = async (memberUserId: string): Promise<MemberActionResult> => {
    const { error } = await supabase.rpc("remove_household_member", { member_user_id: memberUserId });
    if (error) {
      return fail("Removing the member failed", error, "household.members.errors.removeFailed");
    }

    await load({ isSilent: true });
    return { isDone: true };
  };

  // Owner only. The owner becomes a regular member.
  const transferOwnership = async (newOwnerUserId: string): Promise<MemberActionResult> => {
    const { error } = await supabase.rpc("transfer_household_ownership", { new_owner_id: newOwnerUserId });
    if (error) {
      return fail("Transferring the household failed", error, "household.members.errors.transferFailed");
    }

    await load({ isSilent: true });
    return { isDone: true };
  };

  // An owner with other members must transfer ownership or delete the household first.
  const leave = async (): Promise<MemberActionResult> => {
    const { error } = await supabase.rpc("leave_household");
    if (error) {
      return fail("Leaving the household failed", error, "household.members.errors.leaveFailed");
    }

    clear();
    return { isDone: true };
  };

  // Owner only. Removes the household for every member.
  const deleteHousehold = async (): Promise<MemberActionResult> => {
    const { error } = await supabase.rpc("delete_household");
    if (error) {
      return fail("Deleting the household failed", error, "household.members.errors.deleteFailed");
    }

    clear();
    return { isDone: true };
  };

  const clear = (): void => {
    household.value = null;
    loadFailed.value = false;
    clearInvite();
  };

  return {
    household: readonly(household),
    loadFailed: readonly(loadFailed),
    isOwner,
    load,
    create,
    removeMember,
    transferOwnership,
    leave,
    deleteHousehold,
    clear,
  };
}

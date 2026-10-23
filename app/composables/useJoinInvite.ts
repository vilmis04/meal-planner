import type { AcceptInviteResult, PreviewInviteResult } from "~/types/household-invite.types";

// The /join/[token] page: look at a link, then use it.
export function useJoinInvite() {
  const supabase = useSupabaseClient();
  const { load: loadHousehold, clear: clearHousehold } = useHousehold();
  const { clear: clearInvite } = useHouseholdInvite();

  // Read-only; bad links come back as a status, not an error.
  const preview = async (token: string): Promise<PreviewInviteResult> => {
    const { data, error } = await supabase.rpc("get_household_invite", { invite_token: token });
    const result = error ? null : invitePreviewRowsSchema.safeParse(data);

    if (!result?.success || !result.data) {
      console.error("Loading the invite failed", error ?? result?.error);
      return { isLoaded: false };
    }

    return { isLoaded: true, preview: result.data };
  };

  // leaveCurrent must be true to move out of a household the user is already in.
  const accept = async (token: string, leaveCurrent: boolean): Promise<AcceptInviteResult> => {
    const { data, error } = await supabase.rpc("accept_household_invite", {
      invite_token: token,
      leave_current: leaveCurrent,
    });

    if (error || !acceptedHouseholdIdSchema.safeParse(data).success) {
      console.error("Accepting the invite failed", error);
      const errorKey = getHouseholdErrorKey({ message: error?.message ?? "" });
      return {
        isJoined: false,
        // The create-household message for an unknown error would be wrong here.
        errorKey: errorKey === GENERIC_HOUSEHOLD_ERROR_KEY ? "household.join.errors.acceptFailed" : errorKey,
        status: INVITE_STATUS_BY_ERROR[error?.message ?? ""],
        isInOtherHousehold: error?.message === ALREADY_IN_HOUSEHOLD_ERROR,
      };
    }

    // The old household and its invite are gone from the user's point of view.
    clearHousehold();
    clearInvite();
    await loadHousehold();
    return { isJoined: true };
  };

  return { preview, accept };
}

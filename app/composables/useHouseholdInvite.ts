import type { InviteActionResult, LiveInvite } from "~/types/household-invite.types";

// The invite card on /household: the household's live link, created and revoked by any member.
export function useHouseholdInvite() {
  const supabase = useSupabaseClient();
  const requestUrl = useRequestURL();
  const invite = useState<LiveInvite | null>("household-invite", () => null);
  // Only known right after creating the invite: the database keeps a hash, so a reload cannot show it again.
  const inviteLink = useState<string | null>("household-invite-link", () => null);
  const loadFailed = useState<boolean>("household-invite-load-failed", () => false);

  const load = async (): Promise<void> => {
    const { data, error } = await supabase
      .from("household_invites")
      .select(LIVE_INVITE_COLUMNS)
      .is("revoked_at", null)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    const result = error ? null : liveInviteRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the invite failed", error ?? result?.error);
      loadFailed.value = true;
      return;
    }

    invite.value = result.data;
    loadFailed.value = false;
  };

  // Replaces the live link, if any.
  const create = async (): Promise<InviteActionResult> => {
    const { data, error } = await supabase.rpc("create_household_invite");
    const created = error ? null : createdInviteRowsSchema.safeParse(data);

    if (!created?.success || !created.data) {
      console.error("Creating the invite failed", error ?? created?.error);
      return { isDone: false, errorKey: "household.invite.errors.createFailed" };
    }

    invite.value = { expiresAt: created.data.expiresAt };
    inviteLink.value = `${requestUrl.origin}${getJoinPath(created.data.token)}`;
    loadFailed.value = false;
    return { isDone: true };
  };

  const revoke = async (): Promise<InviteActionResult> => {
    const { error } = await supabase.rpc("revoke_household_invite");

    if (error) {
      console.error("Revoking the invite failed", error);
      return { isDone: false, errorKey: "household.invite.errors.revokeFailed" };
    }

    clear();
    return { isDone: true };
  };

  const clear = (): void => {
    invite.value = null;
    inviteLink.value = null;
    loadFailed.value = false;
  };

  return {
    invite: readonly(invite),
    inviteLink: readonly(inviteLink),
    loadFailed: readonly(loadFailed),
    load,
    create,
    revoke,
    clear,
  };
}

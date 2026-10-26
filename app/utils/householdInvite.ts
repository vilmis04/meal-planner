import { z } from "zod";

// Error messages raised by accept_household_invite() (supabase/migrations/20261023000000_add_household_invites.sql).
export const INVITE_NOT_FOUND_ERROR = "invite_not_found";
export const INVITE_USED_ERROR = "invite_used";
export const INVITE_REVOKED_ERROR = "invite_revoked";
export const INVITE_EXPIRED_ERROR = "invite_expired";

// What get_household_invite() reports about a link; anything but "valid" is shown as an error.
export const INVITE_STATUSES = ["valid", "expired", "revoked", "used", "not_found"] as const;

// The invite error each accept failure means, so the page can show the matching view.
export const INVITE_STATUS_BY_ERROR: Partial<Record<string, Exclude<(typeof INVITE_STATUSES)[number], "valid">>> = {
  [INVITE_NOT_FOUND_ERROR]: "not_found",
  [INVITE_USED_ERROR]: "used",
  [INVITE_REVOKED_ERROR]: "revoked",
  [INVITE_EXPIRED_ERROR]: "expired",
};

// The household's live invite. RLS shows members only their own household's rows, never the token hash.
export const LIVE_INVITE_COLUMNS = "expires_at";

export const liveInviteRowsSchema = z.array(z.object({ expires_at: z.string() })).transform((rows) => {
  const [first] = rows;
  return first ? { expiresAt: first.expires_at } : null;
});

// create_household_invite() returns the token once; only its hash is stored.
export const createdInviteRowsSchema = z
  .array(z.object({ invite_token: z.string(), invite_expires_at: z.string() }))
  .transform((rows) => {
    const [first] = rows;
    return first ? { token: first.invite_token, expiresAt: first.invite_expires_at } : null;
  });

export const invitePreviewRowsSchema = z
  .array(
    z.object({
      status: z.enum(INVITE_STATUSES),
      household_name: z.string().nullable(),
      member_count: z.number(),
      inviter_name: z.string().nullable(),
      is_member: z.boolean(),
    }),
  )
  .transform((rows) => {
    const [first] = rows;
    return first
      ? {
          status: first.status,
          householdName: first.household_name,
          memberCount: first.member_count,
          inviterName: first.inviter_name,
          isMember: first.is_member,
        }
      : null;
  });

export const acceptedHouseholdIdSchema = z.guid();

export function getJoinPath(token: string): string {
  return `/join/${token}`;
}

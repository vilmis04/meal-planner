import type { z } from "zod";
import type { INVITE_STATUSES, invitePreviewRowsSchema, liveInviteRowsSchema } from "~/utils/householdInvite";

export type InviteStatus = (typeof INVITE_STATUSES)[number];
export type InviteErrorStatus = Exclude<InviteStatus, "valid">;
export type LiveInvite = NonNullable<z.output<typeof liveInviteRowsSchema>>;
export type InvitePreview = NonNullable<z.output<typeof invitePreviewRowsSchema>>;

export type InviteActionResult = { isDone: true } | { isDone: false; errorKey: string };
export type PreviewInviteResult = { isLoaded: true; preview: InvitePreview } | { isLoaded: false };
export type AcceptInviteResult =
  | { isJoined: true }
  // status is set when the link itself is no longer usable, so the page can show why.
  | { isJoined: false; errorKey: string; status?: InviteErrorStatus; isInOtherHousehold: boolean };

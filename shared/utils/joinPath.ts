// Invite links look like /join/<token>. Used by the auth guard and the auth callback.
const JOIN_PATH_PREFIX = "/join/";

export function isJoinPath(path: string): boolean {
  return path.startsWith(JOIN_PATH_PREFIX);
}

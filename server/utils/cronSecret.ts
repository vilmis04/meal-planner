/*
 * The shared secret of the scheduled endpoints (POST /api/cron/*): the scheduler sends it as
 * "Authorization: Bearer <NUXT_CRON_SECRET>".
 */
import { createHash, timingSafeEqual } from "node:crypto";

// A secret this short could be guessed; `openssl rand -hex 32` makes a good one (64 characters).
export const CRON_SECRET_MIN_LENGTH = 32;

// Both sides are hashed first, so the comparison takes the same time whatever the header holds, its length included.
export function isCronRequestAuthorized(authorizationHeader: string | undefined, cronSecret: string): boolean {
  const bearerPrefix = "Bearer ";
  if (!authorizationHeader?.startsWith(bearerPrefix)) {
    return false;
  }
  const provided = authorizationHeader.slice(bearerPrefix.length);
  return timingSafeEqual(getDigest(provided), getDigest(cronSecret));
}

const getDigest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/*
 * A per-user cap on swap requests that would call the AI (cache misses). Cache hits are never limited.
 * In memory, per server process: enough for one container, and the number of pairs that can ever miss is
 * small (one per recipe and conflicting diet) anyway.
 */
export const SWAP_MISSES_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;

export function createSwapMissLimiter(limit = SWAP_MISSES_PER_HOUR, now: () => number = Date.now) {
  const misses = new Map<string, number[]>();

  // Records a miss and returns true when the user is still under the limit.
  return function allowMiss(userId: string): boolean {
    const since = now() - WINDOW_MS;
    const recent = (misses.get(userId) ?? []).filter((time) => time > since);
    if (recent.length >= limit) {
      misses.set(userId, recent);
      return false;
    }
    recent.push(now());
    misses.set(userId, recent);
    return true;
  };
}

/*
 * A per-user cap on requests that would call the AI: protein swap cache misses (D2) and plan adjustment
 * interpretations (I3). Cached answers are never limited. In memory, per server process: enough for one container.
 */
const WINDOW_MS = 60 * 60 * 1000;

export function createHourlyLimiter(limit: number, now: () => number = Date.now) {
  const calls = new Map<string, number[]>();

  // Records a call and returns true when the user is still under the limit.
  return function allowCall(userId: string): boolean {
    const since = now() - WINDOW_MS;
    const recent = (calls.get(userId) ?? []).filter((time) => time > since);
    if (recent.length >= limit) {
      calls.set(userId, recent);
      return false;
    }
    recent.push(now());
    calls.set(userId, recent);
    return true;
  };
}

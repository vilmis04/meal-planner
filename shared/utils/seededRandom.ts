/*
 * A small seeded random number generator (mulberry32), so the plan generator (E4) gives the same plan for the same
 * seed and inputs: in unit tests with fixed seeds, and when a generation has to be reproduced from its logged seed.
 * Not for anything secret.
 */

// The largest seed plus one: seeds are unsigned 32-bit integers.
export const SEED_LIMIT = 2 ** 32;

// Returns a function that gives numbers in [0, 1), the same sequence for the same seed.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / SEED_LIMIT;
  };
}

// Picks one item with probability proportional to its weight. Items with no positive weight are never picked;
// null when none has one. The caller passes the items in a fixed order, or the same seed gives different picks.
export function pickWeighted<T>(items: readonly T[], getWeight: (item: T) => number, random: () => number): T | null {
  const weights = items.map((item) => Math.max(0, getWeight(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return null;
  }

  let remaining = random() * total;
  for (const [index, item] of items.entries()) {
    remaining -= weights[index] ?? 0;
    if (remaining < 0 && (weights[index] ?? 0) > 0) {
      return item;
    }
  }
  // Rounding can leave a sliver at the very end: it belongs to the last item that has a weight.
  const lastIndex = weights.findLastIndex((weight) => weight > 0);
  return items[lastIndex] ?? null;
}

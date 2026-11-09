// Runs `load` once and shares its promise with every later call. A failed load is forgotten, so the next call tries
// again instead of repeating the failure.
export function memoizeAsync<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

// Sends calls that share a key one after another, each once the one before it settled (whatever its outcome); calls
// with different keys run side by side. The shopping list keys its calls by line (G5), so ticking a line twice quickly
// reaches the database in the order it was tapped.
export function createOrderedSender() {
  // Key → its last call still on the way.
  const pendingCalls = new Map<string, Promise<void>>();

  return <Response>(key: string, send: () => PromiseLike<Response>): Promise<Response> => {
    const call = (pendingCalls.get(key) ?? Promise.resolve()).then(send);
    const settled = call.then(
      () => undefined,
      () => undefined,
    );
    pendingCalls.set(key, settled);
    void settled.then(() => {
      if (pendingCalls.get(key) === settled) {
        pendingCalls.delete(key);
      }
    });
    return call;
  };
}

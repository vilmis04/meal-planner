// Runs a task at most once at a time: asking again while it runs asks for exactly one more run after it, however often
// it was asked. The shopping list (G6) catches up this way, so a burst of reconnects and plan changes reads the list
// once or twice, not once per event, and never with two reads racing each other.
export function createCoalescedRunner(task: () => Promise<void>): () => void {
  let isRunning = false;
  let isQueued = false;

  const start = async (): Promise<void> => {
    isRunning = true;
    try {
      await task();
    } catch (error) {
      console.error("Catching up failed", error);
    } finally {
      isRunning = false;
      if (isQueued) {
        isQueued = false;
        void start();
      }
    }
  };

  return () => {
    if (isRunning) {
      isQueued = true;
      return;
    }
    void start();
  };
}

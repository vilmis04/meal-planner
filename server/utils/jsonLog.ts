/*
 * Structured server logs: one JSON object per line, so Coolify's container logs can be searched by event. An entry
 * with level "error" goes to stderr.
 */
export function writeJsonLog(entry: Record<string, unknown>): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
    return;
  }
  console.info(line);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

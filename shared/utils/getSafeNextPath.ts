// Only same-origin paths: "/reset-password" and "/join/abc" pass; "https://evil.example",
// "//evil.example" and "/\evil.example" (which browsers treat as "//") do not.
export function getSafeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || /^\/[/\\]/.test(next)) {
    return "/";
  }
  return next;
}

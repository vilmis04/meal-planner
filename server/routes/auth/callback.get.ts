const OAUTH_FAILED_REDIRECT = "/login?error=oauth";
const RESET_PASSWORD_PATH = "/reset-password";
const RESET_LINK_FAILED_REDIRECT = "/forgot-password?error=link";

// Only same-origin paths: "/reset-password" passes; "https://evil.example",
// "//evil.example" and "/\evil.example" (which browsers treat as "//") do not.
function getSafeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || /^\/[/\\]/.test(next)) {
    return "/";
  }
  return next;
}

// Exchanging the PKCE code on the server sets the session cookies before the
// redirect, so the SSR render of the next page already sees the signed-in user.
// Used by Google sign-in and by password reset links (next=/reset-password).
export default defineEventHandler(async (event) => {
  const { code, error, next } = getQuery(event);
  const nextPath = getSafeNextPath(next);
  const failedRedirect =
    nextPath === RESET_PASSWORD_PATH ? RESET_LINK_FAILED_REDIRECT : OAUTH_FAILED_REDIRECT;

  if (error || typeof code !== "string") {
    return sendRedirect(event, failedRedirect);
  }

  const { error: exchangeError } = await event.context.supabase.auth.exchangeCodeForSession(code);

  return sendRedirect(event, exchangeError ? failedRedirect : nextPath);
});

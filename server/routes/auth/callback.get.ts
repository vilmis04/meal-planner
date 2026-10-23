const OAUTH_FAILED_REDIRECT = "/login?error=oauth";
const RESET_PASSWORD_PATH = "/reset-password";
const RESET_LINK_FAILED_REDIRECT = "/forgot-password?error=link";

// A failed Google sign-in from an invite link keeps the invite, so the next try still returns to it.
function getFailedRedirect(nextPath: string): string {
  if (nextPath === RESET_PASSWORD_PATH) {
    return RESET_LINK_FAILED_REDIRECT;
  }
  return isJoinPath(nextPath)
    ? `${OAUTH_FAILED_REDIRECT}&next=${encodeURIComponent(nextPath)}`
    : OAUTH_FAILED_REDIRECT;
}

// Exchanging the PKCE code on the server sets the session cookies before the
// redirect, so the SSR render of the next page already sees the signed-in user.
// Used by Google sign-in and by password reset links (next=/reset-password).
export default defineEventHandler(async (event) => {
  const { code, error, next } = getQuery(event);
  const nextPath = getSafeNextPath(next);
  const failedRedirect = getFailedRedirect(nextPath);

  if (error || typeof code !== "string") {
    return sendRedirect(event, failedRedirect);
  }

  const { error: exchangeError } = await event.context.supabase.auth.exchangeCodeForSession(code);

  return sendRedirect(event, exchangeError ? failedRedirect : nextPath);
});

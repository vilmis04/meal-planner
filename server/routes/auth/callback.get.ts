const OAUTH_FAILED_REDIRECT = "/login?error=oauth";

// Exchanging the PKCE code on the server sets the session cookies before the
// redirect, so the SSR render of "/" already sees the signed-in user.
export default defineEventHandler(async (event) => {
  const { code, error } = getQuery(event);

  if (error || typeof code !== "string") {
    return sendRedirect(event, OAUTH_FAILED_REDIRECT);
  }

  const { error: exchangeError } = await event.context.supabase.auth.exchangeCodeForSession(code);

  return sendRedirect(event, exchangeError ? OAUTH_FAILED_REDIRECT : "/");
});

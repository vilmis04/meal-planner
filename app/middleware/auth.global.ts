// /auth/callback is a server route (OAuth and reset-link code exchange), so only pages need listing here.
const GUEST_ONLY_PATHS = new Set(["/login", "/forgot-password"]);
// Reached through a reset link, which signs the user in with a recovery session first.
const RESET_PASSWORD_PATH = "/reset-password";
const LOGIN_PATH = "/login";

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isGuestOnlyPath = GUEST_ONLY_PATHS.has(to.path);

  // Signed in already, but sent to /login?next=...: carry on to where they were going.
  if (user.value && isGuestOnlyPath) {
    return navigateTo(to.path === LOGIN_PATH ? getSafeNextPath(to.query.next) : "/");
  }

  if (!user.value && to.path === RESET_PASSWORD_PATH) {
    return navigateTo("/forgot-password");
  }

  // An invite link survives sign-in and sign-up: the login screens send the user back to it.
  if (!user.value && !isGuestOnlyPath) {
    return navigateTo(isJoinPath(to.path) ? { path: LOGIN_PATH, query: { next: to.path } } : LOGIN_PATH);
  }
});

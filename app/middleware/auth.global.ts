// /auth/callback is a server route (OAuth and reset-link code exchange), so only pages need listing here.
const GUEST_ONLY_PATHS = new Set(["/login", "/forgot-password"]);
// Reached through a reset link, which signs the user in with a recovery session first.
const RESET_PASSWORD_PATH = "/reset-password";

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isGuestOnlyPath = GUEST_ONLY_PATHS.has(to.path);

  if (user.value && isGuestOnlyPath) {
    return navigateTo("/");
  }

  if (!user.value && to.path === RESET_PASSWORD_PATH) {
    return navigateTo("/forgot-password");
  }

  if (!user.value && !isGuestOnlyPath) {
    return navigateTo("/login");
  }
});

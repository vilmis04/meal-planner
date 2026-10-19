// /auth/callback is a server route (OAuth code exchange), so only /login needs listing here.
const GUEST_ONLY_PATHS = new Set(["/login"]);

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isGuestOnlyPath = GUEST_ONLY_PATHS.has(to.path);

  if (user.value && isGuestOnlyPath) {
    return navigateTo("/");
  }

  if (!user.value && !isGuestOnlyPath) {
    return navigateTo("/login");
  }
});

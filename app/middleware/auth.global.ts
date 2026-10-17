const PUBLIC_PAGES = ["/login", "/signup"];

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isPublic = PUBLIC_PAGES.includes(to.path);

  if (!user.value && !isPublic) {
    return navigateTo("/login");
  }

  if (user.value && isPublic) {
    return navigateTo("/");
  }
});

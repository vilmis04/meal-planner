// Where to go after signing in: the same-origin path in ?next=, otherwise the home page.
export function useAuthNextPath() {
  const route = useRoute();
  return computed(() => getSafeNextPath(route.query.next));
}

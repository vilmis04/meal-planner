// The plan list's data (E6), shared by the plan list and the home card under one key, so going from one to the other
// asks for nothing again. It is asked for again when the viewer's date changes (useToday()).
export function useMealPlanOverview() {
  const { loadOverview } = useMealPlans();
  const today = useToday();
  const request = useAsyncData("plans-overview", () => loadOverview(today.value), { watch: [today] });
  return { today, request };
}

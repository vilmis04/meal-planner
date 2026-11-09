// The viewer's date ("YYYY-MM-DD") on their own clock, which decides whether a plan is current, upcoming or past (E6).
// The server renders with its own clock and hands its date to the browser, so the first render matches; once the
// page is mounted the browser's date takes over, which differs only around midnight in another time zone.
export function useToday() {
  const today = useState("today", () => toLocalIsoDate(new Date()));
  onMounted(() => {
    today.value = toLocalIsoDate(new Date());
  });
  return today;
}

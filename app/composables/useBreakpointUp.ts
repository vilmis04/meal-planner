import { useDisplay } from "vuetify";
import type { Breakpoint } from "#shared/utils/layoutBreakpoints";

type UpBreakpoint = Exclude<Breakpoint, "xxl">;

// Whether the window is at least this breakpoint wide (X4). False on the server and until the page is mounted: the
// server cannot know the width, so the first client render matches its HTML. Layout itself is CSS media queries; this
// decides only what is worth mounting at a width, such as a second pane that loads its own data.
export function useBreakpointUp(breakpoint: UpBreakpoint) {
  const display = useDisplay();
  const isMounted = ref(false);
  onMounted(() => {
    isMounted.value = true;
  });
  const isUp = display[`${breakpoint}AndUp`];
  return computed(() => isMounted.value && isUp.value);
}

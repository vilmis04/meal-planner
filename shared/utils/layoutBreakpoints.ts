/*
 * The layout breakpoints, defined once (X4). They are Vuetify's own display thresholds, so a CSS media query, a
 * `useDisplay()` check and Vuetify's components all change at the same widths:
 *
 *   xs  0 – 599 px       phones: one column, bottom navigation, primary actions in reach of the thumb
 *   sm  600 – 959 px     large phones and small tablets: still one column, wider cards
 *   md  960 – 1279 px    tablets in landscape and small laptops: navigation rail, two panes, the week grid
 *   lg  1280 px and up   desktops: a plan beside its shopping list
 *   xl  1920 px and up   large screens: as lg, with the content kept at a readable width
 *
 * CSS cannot read custom properties in media queries, so styles write the number itself: `(min-width: 960px)` from
 * a breakpoint up, `(max-width: 959.98px)` below it. `npm run layout:check` (in `npm run lint`) refuses any other
 * width, and keeps the `--breakpoint-*` tokens in app/assets/css/tokens.css equal to these.
 */

export const BREAKPOINTS = { sm: 600, md: 960, lg: 1280, xl: 1920, xxl: 2560 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

// Vuetify's `display.thresholds`, which also start at xs.
export const DISPLAY_THRESHOLDS = { xs: 0, ...BREAKPOINTS } as const;

// Below a breakpoint ends just short of it, so the two queries never both match (959.98px, as Bootstrap and Vuetify do).
const BELOW_BREAKPOINT_OFFSET = 0.02;

export const getMinWidthQuery = (breakpoint: Breakpoint): string => `(min-width: ${BREAKPOINTS[breakpoint]}px)`;

export const getMaxWidthQuery = (breakpoint: Breakpoint): string =>
  `(max-width: ${BREAKPOINTS[breakpoint] - BELOW_BREAKPOINT_OFFSET}px)`;

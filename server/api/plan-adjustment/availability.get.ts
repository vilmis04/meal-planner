/*
 * GET /api/plan-adjustment/availability: whether plans can be adjusted by text (I3), which needs the AI key on the
 * server. Without it the plan page does not offer the feature; everything else works the same. Says nothing but yes or
 * no, so it needs no sign-in (the plan page asks while it renders on the server).
 *
 *   200 { isAvailable }
 */
export default defineEventHandler((event) => ({ isAvailable: isPlanAdjustmentAvailable(event) }));

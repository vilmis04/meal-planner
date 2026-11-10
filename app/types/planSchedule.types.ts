import type { z } from "zod";
import type { planScheduleRowsSchema } from "~/utils/planSchedule";

// The viewer's schedules by kind (H1): their own and their household's, each only once saved.
export type PlanSchedules = z.output<typeof planScheduleRowsSchema>;
export type PlanSchedulesLoadResult = { status: "loaded"; schedules: PlanSchedules } | { status: "failed" };
export type SavePlanScheduleResult = { isSaved: true } | { isSaved: false; errorKey: string };

export const PLAN_SCHEDULE_SAVE_FAILED_KEY = "plan.schedule.errors.saveFailed";

// Messages raised by save_plan_schedule() (supabase/migrations/20261118000000_create_plan_schedules.sql).
export const PLAN_SCHEDULE_ERROR_KEY_BY_MESSAGE: Readonly<Record<string, string>> = {
  not_in_household: "plan.schedule.errors.notInHousehold",
  not_owner: "plan.schedule.errors.notOwner",
  no_participants: "plan.errors.noParticipants",
  participant_not_member: "plan.errors.participantNotMember",
  invalid_weekday: "plan.schedule.errors.invalidWeekday",
  invalid_day_count: "plan.errors.invalidDayCount",
  invalid_time_zone: "plan.schedule.errors.invalidTimeZone",
};

export function getPlanScheduleErrorKey({ message }: { message: string }): string {
  return PLAN_SCHEDULE_ERROR_KEY_BY_MESSAGE[message] ?? PLAN_SCHEDULE_SAVE_FAILED_KEY;
}

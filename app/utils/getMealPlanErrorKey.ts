export const GENERIC_MEAL_PLAN_ERROR_KEY = "plan.errors.createFailed";
export const PARTICIPANTS_SAVE_FAILED_KEY = "plan.participants.saveFailed";

// Messages raised by create_meal_plan() (supabase/migrations/20261106000000_create_meal_plans.sql) and by the
// participant rules (supabase/migrations/20261107000000_add_meal_plan_participants.sql).
export const MEAL_PLAN_ERROR_KEY_BY_MESSAGE: Readonly<Record<string, string>> = {
  not_in_household: "plan.errors.notInHousehold",
  invalid_day_count: "plan.errors.invalidDayCount",
  invalid_start_date: "plan.errors.invalidStartDate",
  invalid_plan_kind: "plan.errors.invalidKind",
  no_participants: "plan.errors.noParticipants",
  participant_not_member: "plan.errors.participantNotMember",
};

export function getMealPlanErrorKey({ message }: { message: string }): string {
  return MEAL_PLAN_ERROR_KEY_BY_MESSAGE[message] ?? GENERIC_MEAL_PLAN_ERROR_KEY;
}

// The same messages when saving an existing plan's participants, where "could not be created" would be wrong.
export function getParticipantsErrorKey({ message }: { message: string }): string {
  return MEAL_PLAN_ERROR_KEY_BY_MESSAGE[message] ?? PARTICIPANTS_SAVE_FAILED_KEY;
}

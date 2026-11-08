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
  invalid_workdays: "plan.errors.invalidWorkdays",
  invalid_cooldown_days: "plan.errors.invalidCooldownDays",
};

export const SLOT_SAVE_FAILED_KEY = "plan.slot.saveFailed";

// Messages raised by set_meal_plan_slot() (supabase/migrations/20261108000000_add_meal_plan_slot_editing.sql).
export const SLOT_ERROR_KEY_BY_MESSAGE: Readonly<Record<string, string>> = {
  plan_not_found: "plan.errors.notFound",
  recipe_not_found: "plan.slot.errors.recipeNotFound",
  meal_type_mismatch: "plan.slot.errors.mealTypeMismatch",
  beyond_plan_end: "plan.slot.errors.beyondPlanEnd",
  invalid_fill_days: "plan.slot.errors.invalidFillDays",
};

export function getMealPlanErrorKey({ message }: { message: string }): string {
  return MEAL_PLAN_ERROR_KEY_BY_MESSAGE[message] ?? GENERIC_MEAL_PLAN_ERROR_KEY;
}

// The same messages when saving an existing plan's participants, where "could not be created" would be wrong.
export function getParticipantsErrorKey({ message }: { message: string }): string {
  return MEAL_PLAN_ERROR_KEY_BY_MESSAGE[message] ?? PARTICIPANTS_SAVE_FAILED_KEY;
}

// Choosing or clearing a slot's recipe (E3).
export function getSlotErrorKey({ message }: { message: string }): string {
  return SLOT_ERROR_KEY_BY_MESSAGE[message] ?? SLOT_SAVE_FAILED_KEY;
}

export const GENERATION_FAILED_KEY = "plan.generate.errors.failed";

// The 409 answers of POST /api/plans/:id/generate (E4), by status.
export const GENERATION_ERROR_KEY_BY_STATUS: Readonly<Record<string, string>> = {
  "nothing-to-fill": "plan.generate.errors.nothingToFill",
  "no-participants": "plan.generate.errors.noParticipants",
  "plan-changed": "plan.generate.errors.planChanged",
};

// A 404 means the plan is gone or no longer shared with the user; anything else unexpected is a plain failure.
export function getGenerationErrorKey(httpStatus: number | null, status: string | null): string {
  if (status !== null && GENERATION_ERROR_KEY_BY_STATUS[status]) {
    return GENERATION_ERROR_KEY_BY_STATUS[status];
  }
  return httpStatus === 404 ? "plan.errors.notFound" : GENERATION_FAILED_KEY;
}

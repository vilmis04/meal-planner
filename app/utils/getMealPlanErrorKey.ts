export const GENERIC_MEAL_PLAN_ERROR_KEY = "plan.errors.createFailed";

// Messages raised by create_meal_plan() (supabase/migrations/20261106000000_create_meal_plans.sql).
export const MEAL_PLAN_ERROR_KEY_BY_MESSAGE: Readonly<Record<string, string>> = {
  not_in_household: "plan.errors.notInHousehold",
  invalid_day_count: "plan.errors.invalidDayCount",
  invalid_start_date: "plan.errors.invalidStartDate",
  invalid_plan_kind: "plan.errors.invalidKind",
};

export function getMealPlanErrorKey({ message }: { message: string }): string {
  return MEAL_PLAN_ERROR_KEY_BY_MESSAGE[message] ?? GENERIC_MEAL_PLAN_ERROR_KEY;
}

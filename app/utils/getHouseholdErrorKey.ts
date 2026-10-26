export const GENERIC_HOUSEHOLD_ERROR_KEY = "household.errors.generic";

// Messages raised by create_household() (supabase/migrations/20261021000100_add_household_creation.sql).
const ERROR_KEY_BY_MESSAGE: Partial<Record<string, string>> = {
  [ALREADY_IN_HOUSEHOLD_ERROR]: "household.errors.alreadyInHousehold",
  invalid_household_name: "household.errors.invalidName",
};

export function getHouseholdErrorKey({ message }: { message: string }): string {
  return ERROR_KEY_BY_MESSAGE[message] ?? GENERIC_HOUSEHOLD_ERROR_KEY;
}

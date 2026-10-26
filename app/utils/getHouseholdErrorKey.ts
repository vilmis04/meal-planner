export const GENERIC_HOUSEHOLD_ERROR_KEY = "household.errors.generic";

// Messages raised by create_household() (supabase/migrations/20261021000100_add_household_creation.sql)
// and by the member management functions (supabase/migrations/20261026000000_add_household_member_management.sql).
const ERROR_KEY_BY_MESSAGE: Partial<Record<string, string>> = {
  [ALREADY_IN_HOUSEHOLD_ERROR]: "household.errors.alreadyInHousehold",
  invalid_household_name: "household.errors.invalidName",
  [OWNER_MUST_TRANSFER_ERROR]: "household.members.errors.ownerMustTransfer",
  [NOT_OWNER_ERROR]: "household.members.errors.notOwner",
  [MEMBER_NOT_FOUND_ERROR]: "household.members.errors.memberNotFound",
  [NOT_IN_HOUSEHOLD_ERROR]: "household.members.errors.notInHousehold",
  cannot_remove_self: "household.members.errors.cannotRemoveSelf",
  invalid_new_owner: "household.members.errors.invalidNewOwner",
};

export function getHouseholdErrorKey({ message }: { message: string }): string {
  return ERROR_KEY_BY_MESSAGE[message] ?? GENERIC_HOUSEHOLD_ERROR_KEY;
}

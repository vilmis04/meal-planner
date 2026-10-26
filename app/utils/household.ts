import { z } from "zod";

// Must match the households_name_trimmed_length constraint.
export const HOUSEHOLD_NAME_MAX_LENGTH = 50;
// Error message raised by create_household() when the user already has a household.
export const ALREADY_IN_HOUSEHOLD_ERROR = "already_in_household";

// Messages raised by the member management functions (supabase/migrations/20261026000000_add_household_member_management.sql).
export const OWNER_MUST_TRANSFER_ERROR = "owner_must_transfer";
export const NOT_OWNER_ERROR = "not_owner";
export const MEMBER_NOT_FOUND_ERROR = "member_not_found";
export const NOT_IN_HOUSEHOLD_ERROR = "not_in_household";

export const HOUSEHOLD_ROLES = ["owner", "member"] as const;

// One row per member of the user's household (RLS shows only their own), with the household and each member's profile embedded.
export const HOUSEHOLD_MEMBER_COLUMNS =
  "household_id, user_id, role, joined_at, households(name), profiles(display_name)";

const householdMemberRowSchema = z.object({
  household_id: z.guid(),
  user_id: z.guid(),
  role: z.enum(HOUSEHOLD_ROLES),
  joined_at: z.string(),
  households: z.object({ name: z.string() }),
  profiles: z.object({ display_name: z.string() }),
});

// No rows means the user has no household.
export const householdRowsSchema = z.array(householdMemberRowSchema).transform((rows) => {
  const [first] = rows;
  if (!first) {
    return null;
  }
  return {
    id: first.household_id,
    name: first.households.name,
    members: rows.map((row) => ({
      userId: row.user_id,
      displayName: row.profiles.display_name,
      role: row.role,
      joinedAt: row.joined_at,
    })),
  };
});

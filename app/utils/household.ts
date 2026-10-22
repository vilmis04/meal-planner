import { z } from "zod";

// Must match the households_name_trimmed_length constraint.
export const HOUSEHOLD_NAME_MAX_LENGTH = 50;
// Error message raised by create_household() when the user already has a household.
export const ALREADY_IN_HOUSEHOLD_ERROR = "already_in_household";

// One row per member of the user's household (RLS shows only their own), with the household and each member's profile embedded.
export const HOUSEHOLD_MEMBER_COLUMNS =
  "household_id, user_id, joined_at, households(name), profiles(display_name)";

const householdMemberRowSchema = z.object({
  household_id: z.guid(),
  user_id: z.guid(),
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
      joinedAt: row.joined_at,
    })),
  };
});

import type { z } from "zod";
import type { householdRowsSchema } from "~/utils/household";

export type Household = NonNullable<z.output<typeof householdRowsSchema>>;
export type HouseholdMember = Household["members"][number];
export type CreateHouseholdResult = { isCreated: true } | { isCreated: false; errorKey: string };
export type MemberActionResult = { isDone: true } | { isDone: false; errorKey: string };

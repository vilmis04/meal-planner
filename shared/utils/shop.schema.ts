import { z } from "zod";
import { SHOP_NAME_MAX_LENGTH } from "./shop";
import { normaliseItemName } from "./shoppingItemEdit";

// A shop's name as typed: tidied, then 1 to 60 characters (shops_name_length).
export const shopNameSchema = z
  .string()
  .transform(normaliseItemName)
  .pipe(z.string().min(1).max(SHOP_NAME_MAX_LENGTH));

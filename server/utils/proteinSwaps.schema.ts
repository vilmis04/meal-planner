import { z } from "zod";
import { DIETS } from "../../shared/utils/diet";

// Route parameters of GET /api/recipes/:id/swaps/:diet. Kept here because every file under server/api is a route.
export const swapRouteParamsSchema = z.object({
  id: z.guid(),
  diet: z.enum(DIETS),
});

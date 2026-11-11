/*
 * Where plan adjustments (I3) read and cache. The plan and the ingredients are read with the signed-in user's own
 * client, so row level security decides whether they may open the plan; the interpretation cache
 * (plan_adjustment_interpretations) is reachable only with the service role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "../../shared/utils/fetchAllPages";
import { planAdjustmentSchema } from "../../shared/utils/planAdjustment.schema";
import { adjustablePlanRowSchema, adjustmentIngredientRowSchema } from "./planAdjustment.schema";
import type { PlanAdjustmentStore } from "./planAdjustmentStore.types";

// Supabase answers at most 1000 rows per request (silently), so the ingredients are read in pages.
const PAGE_SIZE = 1000;

export function createSupabasePlanAdjustmentStore({
  userClient,
  serviceClient,
}: {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}): PlanAdjustmentStore {
  return {
    async loadPlan(planId) {
      const { data, error } = await userClient
        .from("meal_plans")
        .select("id, start_date, day_count, include_snacks")
        .eq("id", planId)
        .maybeSingle();
      if (error) throw new Error(`Loading plan ${planId} failed: ${error.message}`);
      return data ? adjustablePlanRowSchema.parse(data) : null;
    },

    async loadIngredients() {
      const rows = await fetchAllPages(async (from, to) => {
        const { data, error, count } = await userClient
          .from("ingredients")
          .select("id, name", { count: "exact" })
          .order("name")
          .range(from, to);
        if (error) throw new Error(`Loading ingredients failed: ${error.message}`);
        return { rows: data ?? [], total: count };
      }, PAGE_SIZE);
      return rows.map((row) => adjustmentIngredientRowSchema.parse(row));
    },

    async loadInterpretation(promptHash) {
      const { data, error } = await serviceClient
        .from("plan_adjustment_interpretations")
        .select("adjustment")
        .eq("prompt_hash", promptHash)
        .maybeSingle();
      if (error) throw new Error(`Loading a cached interpretation failed: ${error.message}`);
      const parsed = planAdjustmentSchema.safeParse(data?.adjustment);
      return parsed.success ? parsed.data : null;
    },

    async saveInterpretation(promptHash, model, adjustment) {
      const { error } = await serviceClient
        .from("plan_adjustment_interpretations")
        .upsert({ prompt_hash: promptHash, model, adjustment }, { onConflict: "prompt_hash" });
      if (error) throw new Error(`Caching an interpretation failed: ${error.message}`);
    },
  };
}

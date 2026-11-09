/*
 * Where the plan generator's inputs are read and its plan is written (E4). The plan, recipes and swaps are read and
 * the plan written with the signed-in user's own client, so row level security and apply_meal_plan_generation()
 * decide what they may do. The participants' diets, ratings and other plans are read with the service role, through
 * functions only it may call, once loadPlan() has shown the user can open the plan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Diet } from "../../shared/utils/diet";
import { fetchAllPages } from "../../shared/utils/fetchAllPages";
import type { Page } from "../../shared/utils/fetchAllPages";
import type { GeneratorParticipant } from "../../shared/utils/planGenerator.types";
import type { RecipeRating } from "../../shared/utils/recipeRating";
import {
  GENERATION_PLAN_COLUMNS,
  GENERATION_RECIPE_COLUMNS,
  generationPlanRowSchema,
  generationRecipeRowSchema,
  historyRowsSchema,
  participantRowsSchema,
  ratingRowsSchema,
  swapDietRowSchema,
} from "./planGeneration.schema";
import type { PlanGenerationStore } from "./planGenerationStore.types";

// Supabase answers at most 1000 rows per request (silently), so the recipe library and swaps are read in pages.
const PAGE_SIZE = 1000;

export function createSupabasePlanGenerationStore({
  userClient,
  serviceClient,
}: {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}): PlanGenerationStore {
  const fetchTablePage =
    (table: string, columns: string, filter: Record<string, string> = {}) =>
    async (from: number, to: number): Promise<Page<unknown>> => {
      const { data, error, count } = await userClient
        .from(table)
        .select(columns, { count: "exact" })
        .match(filter)
        .order("id")
        .range(from, to);
      if (error) throw new Error(`Loading ${table} failed: ${error.message}`);
      return { rows: data ?? [], total: count };
    };

  return {
    async loadPlan(planId) {
      const { data, error } = await userClient.from("meal_plans").select(GENERATION_PLAN_COLUMNS).eq("id", planId).maybeSingle();
      if (error) throw new Error(`Loading plan ${planId} failed: ${error.message}`);
      return data ? generationPlanRowSchema.parse(data) : null;
    },

    async loadRecipes() {
      const rows = await fetchAllPages(fetchTablePage("recipes", GENERATION_RECIPE_COLUMNS), PAGE_SIZE);
      return rows.map((row) => generationRecipeRowSchema.parse(row));
    },

    async loadSwapDiets() {
      // Row level security shows ready swaps only; the filter says so too.
      const rows = await fetchAllPages(
        fetchTablePage("recipe_protein_swaps", "id, recipe_id, diet", { status: "ready" }),
        PAGE_SIZE,
      );
      const swapDiets: Record<string, Diet[]> = {};
      for (const row of rows) {
        const { recipe_id: recipeId, diet } = swapDietRowSchema.parse(row);
        const diets = (swapDiets[recipeId] ??= []);
        if (!diets.includes(diet)) {
          diets.push(diet);
        }
      }
      return swapDiets;
    },

    async loadParticipants(planId) {
      const [participants, ratings] = await Promise.all([
        serviceClient.rpc("meal_plan_generation_participants", { target_plan_id: planId }),
        serviceClient.rpc("meal_plan_participant_ratings", { target_plan_id: planId }),
      ]);
      if (participants.error) throw new Error(`Loading the participants of ${planId} failed: ${participants.error.message}`);
      if (ratings.error) throw new Error(`Loading the ratings for ${planId} failed: ${ratings.error.message}`);

      const ratingsByUser = new Map<string, Record<string, RecipeRating>>();
      for (const { user_id: userId, recipe_id: recipeId, rating } of ratingRowsSchema.parse(ratings.data)) {
        const userRatings = ratingsByUser.get(userId) ?? {};
        userRatings[recipeId] = rating;
        ratingsByUser.set(userId, userRatings);
      }
      return participantRowsSchema.parse(participants.data).map(
        ({ user_id: userId, diet }): GeneratorParticipant => ({ userId, diet, ratings: ratingsByUser.get(userId) ?? {} }),
      );
    },

    async loadHistory(planId, lookbackDays) {
      const { data, error } = await serviceClient.rpc("meal_plan_recipe_history", {
        target_plan_id: planId,
        lookback_days: lookbackDays,
      });
      if (error) throw new Error(`Loading the plan history for ${planId} failed: ${error.message}`);
      return historyRowsSchema.parse(data);
    },

    async applyGeneration(planId, writes) {
      const { error } = await userClient.rpc("apply_meal_plan_generation", {
        target_plan_id: planId,
        assignments: writes.map((write) => ({
          day_index: write.dayIndex,
          meal_type: write.mealType,
          recipe_id: write.recipeId,
          note: write.note,
          previous_recipe_id: write.previousRecipeId,
        })),
      });
      if (error?.message === "plan_changed") return "plan-changed";
      if (error) throw new Error(`Saving the generated plan ${planId} failed: ${error.message}`);
      return "applied";
    },
  };
}

import type { GenerationMode } from "#shared/utils/mealPlan";
import type {
  CreateMealPlanResult,
  GeneratePlanResult,
  HatedRecipesResult,
  MealPlanListResult,
  MealPlanLoadResult,
  NewMealPlan,
  SetSlotRecipeResult,
  SetSlotsLockedResult,
  SnackSettings,
  SwapSlotResult,
  UpdateParticipantsResult,
} from "~/types/mealPlan.types";

// Meal plans (E1 to E5). Row level security decides what the user sees: their individual plans and their household's.
export function useMealPlans() {
  const supabase = useSupabaseClient();

  // The household of a household plan is never sent: create_meal_plan() takes it from the caller's membership.
  const create = async (plan: NewMealPlan): Promise<CreateMealPlanResult> => {
    const { data, error } = await supabase.rpc("create_meal_plan", {
      plan_kind: plan.kind,
      plan_start_date: plan.startDate,
      plan_day_count: plan.dayCount,
      plan_include_snacks: plan.includeSnacks,
      plan_snacks_on_list: plan.snacksOnList,
      ...(plan.participantIds ? { plan_participant_ids: plan.participantIds } : {}),
      plan_workdays: plan.workdays,
      plan_cooldown_days: plan.cooldownDays,
    });

    if (error) {
      console.error("Creating the plan failed", error);
      return { isCreated: false, errorKey: getMealPlanErrorKey(error) };
    }

    const id = mealPlanIdSchema.safeParse(data);
    if (!id.success) {
      console.error("Unexpected answer from create_meal_plan", data);
      return { isCreated: false, errorKey: GENERIC_MEAL_PLAN_ERROR_KEY };
    }
    return { isCreated: true, id: id.data };
  };

  const loadList = async (): Promise<MealPlanListResult> => {
    const { data, error } = await supabase
      .from("meal_plans")
      .select(MEAL_PLAN_COLUMNS)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MEAL_PLAN_LIST_LIMIT);

    const result = error ? null : mealPlanListRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the plans failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", plans: result.data };
  };

  // Someone else's individual plan and another household's plan are "not found": RLS returns no row for either.
  const loadPlan = async (id: string): Promise<MealPlanLoadResult> => {
    if (!mealPlanIdSchema.safeParse(id).success) {
      return { status: "not-found" };
    }

    const { data, error } = await supabase.from("meal_plans").select(MEAL_PLAN_DETAIL_COLUMNS).eq("id", id).maybeSingle();

    if (error) {
      console.error("Loading the plan failed", error);
      return { status: "failed" };
    }
    if (!data) {
      return { status: "not-found" };
    }

    const result = mealPlanDetailRowSchema.safeParse(data);
    if (!result.success) {
      console.error("Unexpected plan row", result.error);
      return { status: "failed" };
    }
    return { status: "found", plan: result.data };
  };

  // Resolves to false when nothing was saved, including when the user has lost access to the plan meanwhile.
  const updateSnackSettings = async (id: string, settings: Partial<SnackSettings>): Promise<boolean> => {
    const { data, error } = await supabase
      .from("meal_plans")
      .update({
        ...(settings.includeSnacks === undefined ? {} : { include_snacks: settings.includeSnacks }),
        ...(settings.snacksOnList === undefined ? {} : { snacks_on_list: settings.snacksOnList }),
      })
      .eq("id", id)
      .select("id");

    if (error || !data?.length) {
      console.error("Saving the snack options failed", error ?? "no plan was changed");
      return false;
    }
    return true;
  };

  // Replaces a household plan's participants. The database keeps at least one and allows current members only.
  const updateParticipants = async (id: string, participantIds: string[]): Promise<UpdateParticipantsResult> => {
    const { error } = await supabase.rpc("set_meal_plan_participants", {
      target_plan_id: id,
      participant_ids: participantIds,
    });

    if (error) {
      console.error("Saving the participants failed", error);
      return { isSaved: false, errorKey: getParticipantsErrorKey(error) };
    }
    return { isSaved: true };
  };

  // Puts a recipe in a slot (null empties it). fillDays > 1 also fills the same meal on the following days,
  // for a batch recipe; the database writes all of them or none (E3).
  const setSlotRecipe = async (
    slotId: string,
    recipeId: string | null,
    fillDays = 1,
  ): Promise<SetSlotRecipeResult> => {
    const { error } = await supabase.rpc("set_meal_plan_slot", {
      target_slot_id: slotId,
      new_recipe_id: recipeId,
      fill_days: fillDays,
    });

    if (error) {
      console.error("Saving the slot failed", error);
      return { isSaved: false, errorKey: getSlotErrorKey(error) };
    }
    return { isSaved: true };
  };

  // The recipes the plan's participants hate, by recipe. Other ratings stay private (E3).
  const loadHatedRecipes = async (planId: string): Promise<HatedRecipesResult> => {
    const { data, error } = await supabase.rpc("meal_plan_hated_recipes", { target_plan_id: planId });

    const result = error ? null : hatedRecipeRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the hated recipes failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", hated: result.data };
  };

  // Fills the plan's empty slots (E4), or replaces every unlocked one (E5), on the server, which reads everyone's
  // ratings and plan history there.
  const generate = async (planId: string, mode: GenerationMode = "fill_empty"): Promise<GeneratePlanResult> => {
    const response = await $fetch
      .raw(`/api/plans/${planId}/generate`, { method: "POST", body: { mode }, ignoreResponseError: true, retry: 0 })
      .catch((error: unknown) => {
        console.error("Generating the plan failed", error);
        return null;
      });

    const body = generatePlanResponseSchema.safeParse(response?._data);
    if (!body.success) {
      console.error("Generating the plan failed", response?.status ?? "no response");
      return { isGenerated: false, errorKey: getGenerationErrorKey(response?.status ?? null, null) };
    }
    if (body.data.status !== "generated") {
      return { isGenerated: false, errorKey: getGenerationErrorKey(response?.status ?? null, body.data.status) };
    }
    return { isGenerated: true, summary: body.data };
  };

  // Replaces a slot's recipe (and its batch's other days) with another one the generator's rules allow (E5).
  const swapSlot = async (planId: string, slotId: string): Promise<SwapSlotResult> => {
    const response = await $fetch
      .raw(`/api/plans/${planId}/slots/${slotId}/swap`, { method: "POST", ignoreResponseError: true, retry: 0 })
      .catch((error: unknown) => {
        console.error("Swapping the slot failed", error);
        return null;
      });

    const body = swapSlotResponseSchema.safeParse(response?._data);
    if (!body.success) {
      console.error("Swapping the slot failed", response?.status ?? "no response");
      return { isSwapped: false, errorKey: getSwapErrorKey(response?.status ?? null, null) };
    }
    if (body.data.status !== "swapped") {
      return { isSwapped: false, errorKey: getSwapErrorKey(response?.status ?? null, body.data.status) };
    }
    return { isSwapped: true };
  };

  // Locks or unlocks slots of one plan together, such as the days of a batch (E5).
  const setSlotsLocked = async (slotIds: string[], isLocked: boolean): Promise<SetSlotsLockedResult> => {
    const { error } = await supabase.rpc("set_meal_plan_slots_locked", {
      target_slot_ids: slotIds,
      should_lock: isLocked,
    });

    if (error) {
      console.error("Saving the lock failed", error);
      return { isSaved: false, errorKey: getLockErrorKey(error) };
    }
    return { isSaved: true };
  };

  return {
    create,
    loadList,
    loadPlan,
    updateSnackSettings,
    updateParticipants,
    setSlotRecipe,
    loadHatedRecipes,
    generate,
    swapSlot,
    setSlotsLocked,
  };
}

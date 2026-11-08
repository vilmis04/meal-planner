-- Manual slot editing (E3): choose a recipe for a slot, and see which recipes the plan's participants hate.
-- Slots are still never written directly: set_meal_plan_slot() checks access, the meal type and the batch
-- span in one place. meal_plan_hated_recipes() is the one way to read other people's ratings from the app,
-- and it returns only "hate", only for the plan's current participants, only to someone who can open the plan;
-- user_recipe_preferences keeps its owner-only row level security.
-- Additive and safe for the previous app version, so run it before deploying the code that uses it.

-- Puts a recipe in a slot, or empties it with a null recipe. fill_days > 1 also puts the recipe in the same
-- meal of the following days, for a recipe cooked once for several days (recipes.portion_days); all of them
-- are written together or none is. The plan row is locked so two changes at once take turns, and updated_at
-- moves so the shopping list (G2) can tell it is out of date. Someone else's plan reads as plan_not_found.
create or replace function public.set_meal_plan_slot(
  target_slot_id uuid,
  new_recipe_id uuid,
  fill_days integer default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  slot_plan_id uuid;
  slot_day_index smallint;
  slot_meal_type public.meal_type;
  plan_day_count smallint;
  recipe_meal_type public.meal_type;
  recipe_portion_days smallint;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select plan_id, day_index, meal_type into slot_plan_id, slot_day_index, slot_meal_type
  from public.meal_plan_slots
  where id = target_slot_id;

  if slot_plan_id is null or not public.can_access_meal_plan(slot_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  select day_count into plan_day_count
  from public.meal_plans
  where id = slot_plan_id
  for update;

  if fill_days is null or fill_days < 1 then
    raise exception 'invalid_fill_days' using errcode = '22023';
  end if;

  -- Emptying a slot empties that slot only.
  if new_recipe_id is null then
    if fill_days <> 1 then
      raise exception 'invalid_fill_days' using errcode = '22023';
    end if;
  else
    select meal_type, portion_days into recipe_meal_type, recipe_portion_days
    from public.recipes
    where id = new_recipe_id;

    if recipe_meal_type is null then
      raise exception 'recipe_not_found' using errcode = 'P0001';
    end if;

    if recipe_meal_type <> slot_meal_type then
      raise exception 'meal_type_mismatch' using errcode = '22023';
    end if;

    if fill_days > recipe_portion_days then
      raise exception 'invalid_fill_days' using errcode = '22023';
    end if;
  end if;

  if slot_day_index + fill_days > plan_day_count then
    raise exception 'beyond_plan_end' using errcode = '22023';
  end if;

  update public.meal_plan_slots
  set recipe_id = new_recipe_id
  where plan_id = slot_plan_id
    and meal_type = slot_meal_type
    and day_index between slot_day_index and slot_day_index + fill_days - 1;

  update public.meal_plans set updated_at = now() where id = slot_plan_id;
end;
$$;

revoke execute on function public.set_meal_plan_slot(uuid, uuid, integer) from public, anon;
grant execute on function public.set_meal_plan_slot(uuid, uuid, integer) to authenticated;

-- Every recipe a current participant of the plan rated "hate", one row per person and recipe. Empty for a plan
-- the caller cannot open. No other rating leaves user_recipe_preferences this way.
create or replace function public.meal_plan_hated_recipes(target_plan_id uuid)
returns table (recipe_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select preferences.recipe_id, preferences.user_id
  from public.meal_plan_participants as participants
  join public.user_recipe_preferences as preferences on preferences.user_id = participants.user_id
  where participants.plan_id = target_plan_id
    and preferences.rating = 'hate'
    and public.can_access_meal_plan(target_plan_id)
  order by preferences.recipe_id, preferences.user_id;
$$;

revoke execute on function public.meal_plan_hated_recipes(uuid) from public, anon;
grant execute on function public.meal_plan_hated_recipes(uuid) to authenticated;

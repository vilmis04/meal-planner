-- Plan generation (E4): the server fills a plan's empty slots with the pure generator in shared/utils/planGenerator.ts.
--   * meal_plans gains workdays (whose lunch and dinner get batch recipes first) and cooldown_days (how long a planned
--     recipe rests), both chosen when the plan is created.
--   * meal_plan_slots gains fill_note: why the generator left a slot empty or filled it in a compromised way.
--   * apply_meal_plan_generation() writes a generated plan as the signed-in user, after the same access and recipe
--     checks as set_meal_plan_slot(), and only into slots that are still empty.
--   * meal_plan_generation_participants(), meal_plan_participant_ratings() and meal_plan_recipe_history() are the
--     generator's inputs that people must not read themselves (everyone's ratings, the participants' other plans).
--     They are for the service role only; the server checks the caller can open the plan first.
-- Additive and safe for the previous app version (create_meal_plan() keeps its first six arguments), so run it before
-- deploying the code that uses it. Every statement can run again.

alter table public.meal_plans
  add column if not exists workdays smallint[] not null default '{1,2,3,4,5}',
  add column if not exists cooldown_days smallint not null default 14;

-- ISO weekdays, Monday = 1. Must match WEEKDAYS and COOLDOWN_DAYS_MAX in shared/utils/mealPlan.ts.
alter table public.meal_plans drop constraint if exists meal_plans_workdays_supported;
alter table public.meal_plans
  add constraint meal_plans_workdays_supported check (workdays <@ '{1,2,3,4,5,6,7}'::smallint[]);
alter table public.meal_plans drop constraint if exists meal_plans_cooldown_days_range;
alter table public.meal_plans
  add constraint meal_plans_cooldown_days_range check (cooldown_days between 0 and 60);

-- Null for a slot filled the ideal way, or by hand. Must match SLOT_FILL_NOTES in shared/utils/planGenerator.ts.
alter table public.meal_plan_slots add column if not exists fill_note text;
alter table public.meal_plan_slots drop constraint if exists meal_plan_slots_fill_note_supported;
alter table public.meal_plan_slots
  add constraint meal_plan_slots_fill_note_supported check (
    fill_note in ('no_recipe_fits_diets', 'all_recipes_hated', 'recently_planned', 'repeated_in_plan', 'no_batch_recipe')
  );

-- E2's create_meal_plan() with workdays and cooldown. The six-argument version is replaced, not overloaded, so a call
-- by name always finds exactly one function. Null workdays = Monday to Friday, null cooldown = 14 days.
drop function if exists public.create_meal_plan(text, date, integer, boolean, boolean, uuid[]);

create or replace function public.create_meal_plan(
  plan_kind text,
  plan_start_date date,
  plan_day_count integer,
  plan_include_snacks boolean default true,
  plan_snacks_on_list boolean default true,
  plan_participant_ids uuid[] default null,
  plan_workdays integer[] default null,
  plan_cooldown_days integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
  participant_ids uuid[];
  checked_workdays smallint[];
  new_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if plan_kind is null or plan_kind not in ('individual', 'household') then
    raise exception 'invalid_plan_kind' using errcode = '22023';
  end if;

  if plan_start_date is null then
    raise exception 'invalid_start_date' using errcode = '22023';
  end if;

  if plan_day_count is null or plan_day_count not between 1 and 14 then
    raise exception 'invalid_day_count' using errcode = '22023';
  end if;

  if plan_workdays is not null and exists (
    select 1 from unnest(plan_workdays) as weekday where weekday is null or weekday not between 1 and 7
  ) then
    raise exception 'invalid_workdays' using errcode = '22023';
  end if;
  -- Stored sorted and without repeats, so the same choice is always the same value.
  select coalesce(array_agg(distinct weekday::smallint order by weekday::smallint), '{}') into checked_workdays
  from unnest(coalesce(plan_workdays, array[1, 2, 3, 4, 5])) as weekday;

  if plan_cooldown_days is not null and plan_cooldown_days not between 0 and 60 then
    raise exception 'invalid_cooldown_days' using errcode = '22023';
  end if;

  if plan_kind = 'individual' then
    if plan_participant_ids is not null then
      raise exception 'participants_not_allowed' using errcode = '22023';
    end if;
    participant_ids := array[current_user_id];
  else
    select household_id into my_household_id
    from public.household_members
    where user_id = current_user_id;

    if my_household_id is null then
      raise exception 'not_in_household' using errcode = 'P0001';
    end if;

    if plan_participant_ids is null then
      select array_agg(user_id) into participant_ids
      from public.household_members
      where household_id = my_household_id;
    else
      participant_ids := public.check_meal_plan_participants(my_household_id, plan_participant_ids);
    end if;
  end if;

  insert into public.meal_plans (
    kind, user_id, household_id, created_by, start_date, day_count, include_snacks, snacks_on_list,
    workdays, cooldown_days
  )
  values (
    plan_kind,
    case when plan_kind = 'individual' then current_user_id end,
    my_household_id,
    current_user_id,
    plan_start_date,
    plan_day_count,
    coalesce(plan_include_snacks, true),
    coalesce(plan_snacks_on_list, true),
    checked_workdays,
    coalesce(plan_cooldown_days, 14)
  )
  returning id into new_plan_id;

  -- Every meal type of every day, snacks included even when they are skipped.
  insert into public.meal_plan_slots (plan_id, day_index, meal_type)
  select new_plan_id, day_index, meal_type
  from generate_series(0, plan_day_count - 1) as day_index
  cross join unnest(enum_range(null::public.meal_type)) as meal_type;

  insert into public.meal_plan_participants (plan_id, user_id)
  select new_plan_id, participant_id
  from unnest(participant_ids) as participant_id;

  return new_plan_id;
end;
$$;

revoke execute on function public.create_meal_plan(text, date, integer, boolean, boolean, uuid[], integer[], integer)
  from public, anon;
grant execute on function public.create_meal_plan(text, date, integer, boolean, boolean, uuid[], integer[], integer)
  to authenticated;

-- E3's set_meal_plan_slot(), unchanged except that a slot chosen by hand loses the generator's note about it.
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
  set recipe_id = new_recipe_id, fill_note = null
  where plan_id = slot_plan_id
    and meal_type = slot_meal_type
    and day_index between slot_day_index and slot_day_index + fill_days - 1;

  update public.meal_plans set updated_at = now() where id = slot_plan_id;
end;
$$;

revoke execute on function public.set_meal_plan_slot(uuid, uuid, integer) from public, anon;
grant execute on function public.set_meal_plan_slot(uuid, uuid, integer) to authenticated;

-- Writes a generated plan: a JSON array of {day_index, meal_type, recipe_id (or null), note (or null)}, one per slot.
-- Every named slot must still be empty, so a choice someone made meanwhile is never overwritten: the whole
-- generation is refused with plan_changed instead, and the app generates again from what is there now. The plan row
-- is locked for the length of it and updated_at moves, as for set_meal_plan_slot(). Returns how many slots got a
-- recipe. Someone else's plan reads as plan_not_found.
create or replace function public.apply_meal_plan_generation(target_plan_id uuid, assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  plan_day_count smallint;
  assignment_count integer;
  distinct_count integer;
  filled_count integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select day_count into plan_day_count
  from public.meal_plans
  where id = target_plan_id
  for update;

  if plan_day_count is null or not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  if assignments is null or jsonb_typeof(assignments) <> 'array' or exists (
    select 1 from jsonb_array_elements(assignments) as item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'day_index') <> 'number'
      or jsonb_typeof(item -> 'meal_type') <> 'string'
      or jsonb_typeof(coalesce(item -> 'recipe_id', 'null')) not in ('string', 'null')
      or jsonb_typeof(coalesce(item -> 'note', 'null')) not in ('string', 'null')
  ) then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;

  -- Read straight from the JSON each time, not through a temporary table: a caller could plant a temporary table
  -- of the same name (with triggers) in their session, and this function runs with its owner's rights.
  select count(*), count(distinct (generated.day_index, generated.meal_type)) into assignment_count, distinct_count
  from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text);

  if assignment_count <> distinct_count or exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
    where generated.day_index not between 0 and plan_day_count - 1
      or generated.meal_type not in (select unnest(enum_range(null::public.meal_type))::text)
  ) then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
    left join public.recipes as recipes on recipes.id = generated.recipe_id
    where generated.recipe_id is not null and recipes.id is null
  ) then
    raise exception 'recipe_not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
    join public.recipes as recipes on recipes.id = generated.recipe_id
    where recipes.meal_type::text <> generated.meal_type
  ) then
    raise exception 'meal_type_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
    join public.meal_plan_slots as slots
      on slots.plan_id = target_plan_id
      and slots.day_index = generated.day_index
      and slots.meal_type::text = generated.meal_type
    where slots.recipe_id is not null
  ) then
    raise exception 'plan_changed' using errcode = 'P0001';
  end if;

  update public.meal_plan_slots as slots
  set recipe_id = generated.recipe_id, fill_note = generated.note
  from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
  where slots.plan_id = target_plan_id
    and slots.day_index = generated.day_index
    and slots.meal_type::text = generated.meal_type;

  select count(*) into filled_count
  from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
  where generated.recipe_id is not null;

  update public.meal_plans set updated_at = now() where id = target_plan_id;
  return filled_count;
end;
$$;

revoke execute on function public.apply_meal_plan_generation(uuid, jsonb) from public, anon;
grant execute on function public.apply_meal_plan_generation(uuid, jsonb) to authenticated;

-- The plan's participants and their diets, for the generator's hard filter.
create or replace function public.meal_plan_generation_participants(target_plan_id uuid)
returns table (user_id uuid, diet text)
language sql
stable
security definer
set search_path = ''
as $$
  select participants.user_id, profiles.diet
  from public.meal_plan_participants as participants
  join public.profiles as profiles on profiles.id = participants.user_id
  where participants.plan_id = target_plan_id
  order by participants.user_id;
$$;

revoke execute on function public.meal_plan_generation_participants(uuid) from public, anon, authenticated;
grant execute on function public.meal_plan_generation_participants(uuid) to service_role;

-- Every rating of the plan's participants. Ratings are private (C3): this goes to the generator on the server only,
-- which turns them into weights and never returns them.
create or replace function public.meal_plan_participant_ratings(target_plan_id uuid)
returns table (user_id uuid, recipe_id uuid, rating text)
language sql
stable
security definer
set search_path = ''
as $$
  select preferences.user_id, preferences.recipe_id, preferences.rating
  from public.meal_plan_participants as participants
  join public.user_recipe_preferences as preferences on preferences.user_id = participants.user_id
  where participants.plan_id = target_plan_id
  order by preferences.user_id, preferences.recipe_id;
$$;

revoke execute on function public.meal_plan_participant_ratings(uuid) from public, anon, authenticated;
grant execute on function public.meal_plan_participant_ratings(uuid) to service_role;

-- The cooldown's plan history: for each recipe, the last day it was planned in another plan any of this plan's
-- participants eats from (household or individual), within lookback_days before this plan starts. Hidden snack
-- slots do not count.
create or replace function public.meal_plan_recipe_history(target_plan_id uuid, lookback_days integer)
returns table (recipe_id uuid, last_planned_on date)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select start_date from public.meal_plans where id = target_plan_id
  ),
  related_plans as (
    select distinct plans.id, plans.start_date, plans.include_snacks
    from public.meal_plans as plans
    join public.meal_plan_participants as related on related.plan_id = plans.id
    join public.meal_plan_participants as own
      on own.user_id = related.user_id and own.plan_id = target_plan_id
    where plans.id <> target_plan_id
  )
  select slots.recipe_id, max(related_plans.start_date + slots.day_index) as last_planned_on
  from related_plans
  join public.meal_plan_slots as slots on slots.plan_id = related_plans.id
  cross join target
  where slots.recipe_id is not null
    and (slots.meal_type <> 'snack' or related_plans.include_snacks)
    and related_plans.start_date + slots.day_index < target.start_date
    and related_plans.start_date + slots.day_index >= target.start_date - greatest(lookback_days, 0)
  group by slots.recipe_id
  order by slots.recipe_id;
$$;

revoke execute on function public.meal_plan_recipe_history(uuid, integer) from public, anon, authenticated;
grant execute on function public.meal_plan_recipe_history(uuid, integer) to service_role;

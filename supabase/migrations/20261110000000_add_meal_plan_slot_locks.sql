-- Lock, swap and regenerate (E5).
--   * meal_plan_slots gains is_locked: "regenerate" and "swap" leave a locked slot as it is. A recipe chosen by hand
--     is locked (set_meal_plan_slot()); a generated one is not. A slot is locked only while it holds a recipe: one
--     whose recipe was deleted from the library counts as open again.
--   * set_meal_plan_slots_locked() locks or unlocks slots of one plan together (the app sends both days of a batch).
--   * apply_meal_plan_generation() may now replace a generated recipe: each assignment names the recipe the server
--     read for that slot (previous_recipe_id), and the whole generation is refused with plan_changed when a slot
--     holds something else by now or was locked meanwhile.
-- Additive and safe for the previous app version: E4's app sends no previous_recipe_id, which reads as "the slot was
-- empty", E4's own rule. Run it before deploying the code that uses it. Every statement can run again.

-- Before E5 every filled slot was kept as if locked, so slots filled by then start locked: a regeneration never
-- replaces a recipe someone may have chosen by hand. Only when the column is first added, so a second run does
-- not lock slots the generator filled since.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meal_plan_slots' and column_name = 'is_locked'
  ) then
    alter table public.meal_plan_slots add column is_locked boolean not null default false;
    update public.meal_plan_slots set is_locked = true where recipe_id is not null;
  end if;
end;
$$;

-- E3's set_meal_plan_slot() as E4 left it, except that a recipe chosen by hand is locked, in every day it fills,
-- and an emptied slot is unlocked.
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
  set recipe_id = new_recipe_id, fill_note = null, is_locked = new_recipe_id is not null
  where plan_id = slot_plan_id
    and meal_type = slot_meal_type
    and day_index between slot_day_index and slot_day_index + fill_days - 1;

  update public.meal_plans set updated_at = now() where id = slot_plan_id;
end;
$$;

revoke execute on function public.set_meal_plan_slot(uuid, uuid, integer) from public, anon;
grant execute on function public.set_meal_plan_slot(uuid, uuid, integer) to authenticated;

-- Locks or unlocks the given slots, which must all be in one plan the caller can open (plan_not_found otherwise,
-- also for an unknown slot) and, to be locked, hold a recipe (slot_empty). Unlocking an empty slot is allowed, so
-- a slot whose recipe was deleted can always be set straight. The plan row is locked so this takes turns with a
-- generation; updated_at does not move, as what the plan holds does not change.
create or replace function public.set_meal_plan_slots_locked(target_slot_ids uuid[], should_lock boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  slot_plan_id uuid;
  known_count integer;
  plan_count integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_slot_ids is null or cardinality(target_slot_ids) = 0 or should_lock is null
    or array_position(target_slot_ids, null) is not null then
    raise exception 'invalid_slots' using errcode = '22023';
  end if;

  select count(*), count(distinct plan_id), min(plan_id::text)::uuid into known_count, plan_count, slot_plan_id
  from public.meal_plan_slots
  where id = any (target_slot_ids);

  if plan_count > 1 then
    raise exception 'invalid_slots' using errcode = '22023';
  end if;

  if slot_plan_id is null
    or known_count <> (select count(distinct slot_id) from unnest(target_slot_ids) as slot_id)
    or not public.can_access_meal_plan(slot_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  perform 1 from public.meal_plans where id = slot_plan_id for update;

  if should_lock and exists (
    select 1 from public.meal_plan_slots where id = any (target_slot_ids) and recipe_id is null
  ) then
    raise exception 'slot_empty' using errcode = 'P0001';
  end if;

  update public.meal_plan_slots set is_locked = should_lock where id = any (target_slot_ids);
end;
$$;

revoke execute on function public.set_meal_plan_slots_locked(uuid[], boolean) from public, anon;
grant execute on function public.set_meal_plan_slots_locked(uuid[], boolean) to authenticated;

-- Writes a generated plan: a JSON array of {day_index, meal_type, recipe_id (or null), note (or null),
-- previous_recipe_id (or null/missing)}, one per slot. Each named slot must still hold previous_recipe_id (missing:
-- still be empty) and must not be locked, so a choice someone made meanwhile is never overwritten: the whole
-- generation is refused with plan_changed instead, and the app generates again from what is there now. Written
-- slots are unlocked: a generated recipe is a suggestion until someone locks it. The plan row is locked for the
-- length of it and updated_at moves, as for set_meal_plan_slot(). Returns how many slots got a recipe. Someone
-- else's plan reads as plan_not_found.
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
      or jsonb_typeof(coalesce(item -> 'previous_recipe_id', 'null')) not in ('string', 'null')
  ) then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;

  -- Read straight from the JSON each time, not through a temporary table: a caller could plant a temporary table
  -- of the same name (with triggers) in their session, and this function runs with its owner's rights.
  select count(*), count(distinct (generated.day_index, generated.meal_type)) into assignment_count, distinct_count
  from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text);

  if assignment_count <> distinct_count or exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text)
    where generated.day_index not between 0 and plan_day_count - 1
      or generated.meal_type not in (select unnest(enum_range(null::public.meal_type))::text)
  ) then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(recipe_id uuid)
    left join public.recipes as recipes on recipes.id = generated.recipe_id
    where generated.recipe_id is not null and recipes.id is null
  ) then
    raise exception 'recipe_not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(meal_type text, recipe_id uuid)
    join public.recipes as recipes on recipes.id = generated.recipe_id
    where recipes.meal_type::text <> generated.meal_type
  ) then
    raise exception 'meal_type_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, previous_recipe_id uuid)
    join public.meal_plan_slots as slots
      on slots.plan_id = target_plan_id
      and slots.day_index = generated.day_index
      and slots.meal_type::text = generated.meal_type
    where slots.recipe_id is distinct from generated.previous_recipe_id
      or (slots.is_locked and slots.recipe_id is not null)
  ) then
    raise exception 'plan_changed' using errcode = 'P0001';
  end if;

  update public.meal_plan_slots as slots
  set recipe_id = generated.recipe_id, fill_note = generated.note, is_locked = false
  from jsonb_to_recordset(assignments) as generated(day_index integer, meal_type text, recipe_id uuid, note text)
  where slots.plan_id = target_plan_id
    and slots.day_index = generated.day_index
    and slots.meal_type::text = generated.meal_type;

  select count(*) into filled_count
  from jsonb_to_recordset(assignments) as generated(recipe_id uuid)
  where generated.recipe_id is not null;

  update public.meal_plans set updated_at = now() where id = target_plan_id;
  return filled_count;
end;
$$;

revoke execute on function public.apply_meal_plan_generation(uuid, jsonb) from public, anon;
grant execute on function public.apply_meal_plan_generation(uuid, jsonb) to authenticated;

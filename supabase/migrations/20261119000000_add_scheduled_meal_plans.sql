-- Scheduled plans (H2): the job behind POST /api/cron/create-plans makes each enabled schedule's next plan on its run
-- day, generates it (E4) and builds its shopping list (G2), all as the service role, since no one is signed in.
--   * meal_plans gains schedule_id, the schedule that made the plan (null for a plan made by hand), and a unique key on
--     (schedule_id, start_date), so one schedule makes one plan per period however often the job runs.
--   * create_scheduled_meal_plan() makes that plan, or returns the one already made, by H1's rules (see
--     20261118000000_create_plan_schedules.sql): every current member of the household, or the chosen ones; the
--     schedule's length and snacks_on_list; create_meal_plan()'s defaults for the rest.
--   * apply_meal_plan_generation() and apply_shopping_list_generation() are split into the access check, which stays
--     with them, and the write, which moves to write_meal_plan_generation() and write_shopping_list_generation() so the
--     service role can call it without a signed-in user. People keep calling the apply_ functions exactly as before.
-- All three new functions are for the service role only; the server decides which plan they write.
-- Additive and safe for the previous app version (no signature changes, the same errors), so run it before deploying
-- the code that uses it. Every statement can run again.

alter table public.meal_plans
  add column if not exists schedule_id uuid references public.plan_schedules (id) on delete set null;

-- Nulls are distinct, so plans made by hand never clash.
create unique index if not exists meal_plans_schedule_id_start_date_key on public.meal_plans (schedule_id, start_date);

-- Makes the schedule's plan starting on plan_start_date, or finds the one it made already: is_created says which.
-- A plan already there is returned as it is, whatever happened to it since. The schedule row is locked for share, so
-- a save meanwhile waits and the plan follows one version of the settings; two runs at once meet on the unique key
-- and the second gets the first one's plan. The plan has no created_by: schedule_id says who made it.
create or replace function public.create_scheduled_meal_plan(target_schedule_id uuid, plan_start_date date)
returns table (meal_plan_id uuid, is_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.plan_schedules%rowtype;
  participant_ids uuid[];
  new_plan_id uuid;
begin
  if plan_start_date is null then
    raise exception 'invalid_start_date' using errcode = '22023';
  end if;

  select * into schedule
  from public.plan_schedules
  where id = target_schedule_id
  for share;

  if not found then
    raise exception 'schedule_not_found' using errcode = 'P0001';
  end if;

  -- Turned off after the job read it.
  if not schedule.is_enabled then
    raise exception 'schedule_disabled' using errcode = 'P0001';
  end if;

  select plans.id into new_plan_id
  from public.meal_plans as plans
  where plans.schedule_id = target_schedule_id and plans.start_date = plan_start_date;

  if new_plan_id is not null then
    return query select new_plan_id, false;
    return;
  end if;

  if schedule.kind = 'individual' then
    participant_ids := array[schedule.user_id];
  elsif schedule.includes_all_members then
    select array_agg(members.user_id) into participant_ids
    from public.household_members as members
    where members.household_id = schedule.household_id;
  else
    select array_agg(chosen.user_id) into participant_ids
    from public.plan_schedule_participants as chosen
    join public.household_members as members
      on members.household_id = schedule.household_id and members.user_id = chosen.user_id
    where chosen.schedule_id = target_schedule_id;
  end if;

  if participant_ids is null then
    raise exception 'no_participants' using errcode = 'P0001';
  end if;

  insert into public.meal_plans (
    kind, user_id, household_id, created_by, start_date, day_count, snacks_on_list, schedule_id
  )
  values (
    schedule.kind,
    schedule.user_id,
    schedule.household_id,
    null,
    plan_start_date,
    schedule.day_count,
    schedule.snacks_on_list,
    target_schedule_id
  )
  on conflict (schedule_id, start_date) do nothing
  returning id into new_plan_id;

  -- Another run made it between the look above and the insert.
  if new_plan_id is null then
    return query
      select plans.id, false
      from public.meal_plans as plans
      where plans.schedule_id = target_schedule_id and plans.start_date = plan_start_date;
    return;
  end if;

  -- Every meal type of every day, snacks included even when they are skipped, as create_meal_plan() does.
  insert into public.meal_plan_slots (plan_id, day_index, meal_type)
  select new_plan_id, day_index, meal_type
  from generate_series(0, schedule.day_count - 1) as day_index
  cross join unnest(enum_range(null::public.meal_type)) as meal_type;

  insert into public.meal_plan_participants (plan_id, user_id)
  select new_plan_id, participant_id
  from unnest(participant_ids) as participant_id;

  return query select new_plan_id, true;
end;
$$;

revoke execute on function public.create_scheduled_meal_plan(uuid, date) from public, anon, authenticated;
grant execute on function public.create_scheduled_meal_plan(uuid, date) to service_role;

-- E5's apply_meal_plan_generation() without the signed-in user's access check: everything else it checked and wrote,
-- unchanged. For the service role (scheduled plans), and for apply_meal_plan_generation() once it has checked access.
-- A plan that does not exist reads as plan_not_found.
create or replace function public.write_meal_plan_generation(target_plan_id uuid, assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_day_count smallint;
  assignment_count integer;
  distinct_count integer;
  filled_count integer;
begin
  select day_count into plan_day_count
  from public.meal_plans
  where id = target_plan_id
  for update;

  if plan_day_count is null then
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

revoke execute on function public.write_meal_plan_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.write_meal_plan_generation(uuid, jsonb) to service_role;

-- E5's apply_meal_plan_generation(), same arguments, result and errors: the signed-in user's check, then the write.
-- Someone else's plan reads as plan_not_found.
create or replace function public.apply_meal_plan_generation(target_plan_id uuid, assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  return public.write_meal_plan_generation(target_plan_id, assignments);
end;
$$;

revoke execute on function public.apply_meal_plan_generation(uuid, jsonb) from public, anon;
grant execute on function public.apply_meal_plan_generation(uuid, jsonb) to authenticated;

-- G2's apply_shopping_list_generation() without the signed-in user's access check: everything else it checked and
-- wrote, unchanged. For the service role (scheduled plans), and for apply_shopping_list_generation() once it has
-- checked access. A plan without a list reads as plan_not_found.
create or replace function public.write_shopping_list_generation(
  target_plan_id uuid,
  based_on_version bigint,
  items jsonb,
  missing_swaps integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_list_id uuid;
  current_version bigint;
begin
  select id, source_version into target_list_id, current_version
  from public.shopping_lists
  where plan_id = target_plan_id
  for update;

  if target_list_id is null then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
  if based_on_version is null or based_on_version <> current_version then
    raise exception 'list_changed' using errcode = 'P0001';
  end if;
  -- A plan of 14 days with four meals and a few dozen ingredients stays far below this.
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 2000 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if missing_swaps is null or missing_swaps < 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- The caller's lines, parsed once. Named in pg_temp explicitly, and dropped first in case an earlier call in the same
  -- transaction left it.
  if to_regclass('pg_temp.generated_lines') is not null then
    drop table pg_temp.generated_lines;
  end if;
  create temporary table pg_temp.generated_lines on commit drop as
  select
    line.key,
    line.ingredient_id,
    line.name,
    line.category,
    line.amount,
    line.unit,
    coalesce(line.is_extra, false) as is_extra,
    coalesce(array_remove(line.swapped_for, null), '{}') as swapped_for
  from jsonb_to_recordset(items) as line (
    key text,
    ingredient_id uuid,
    name text,
    category text,
    amount numeric,
    unit text,
    is_extra boolean,
    swapped_for uuid[]
  );

  if exists (select 1 from pg_temp.generated_lines where key is null or btrim(key) = '')
    or (select count(*) from pg_temp.generated_lines) <> (select count(distinct key) from pg_temp.generated_lines) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- The plan still needs these: insert new lines, update changed ones in place (people's columns stay).
  insert into public.shopping_items as items_table (
    list_id, source, generated_key, ingredient_id, name, category, amount, unit, is_extra, swapped_for, in_plan
  )
  select
    target_list_id, 'generated', lines.key, lines.ingredient_id, lines.name, lines.category,
    round(lines.amount, 2), lines.unit, lines.is_extra, lines.swapped_for, true
  from pg_temp.generated_lines as lines
  on conflict (list_id, generated_key) where generated_key is not null do update
  set ingredient_id = excluded.ingredient_id,
      name = excluded.name,
      category = excluded.category,
      amount = excluded.amount,
      unit = excluded.unit,
      is_extra = excluded.is_extra,
      swapped_for = excluded.swapped_for,
      in_plan = true
  where (items_table.ingredient_id, items_table.name, items_table.category, items_table.amount, items_table.unit,
         items_table.is_extra, items_table.swapped_for, items_table.in_plan)
    is distinct from
        (excluded.ingredient_id, excluded.name, excluded.category, excluded.amount, excluded.unit,
         excluded.is_extra, excluded.swapped_for, true);

  -- No longer needed and untouched: gone.
  delete from public.shopping_items as stored
  where stored.list_id = target_list_id
    and stored.source = 'generated'
    and stored.state = 'to_buy'
    and not stored.is_removed
    and stored.amount_override is null
    and not exists (select 1 from pg_temp.generated_lines as lines where lines.key = stored.generated_key);

  -- No longer needed but changed by someone: kept out of the plan, so the change comes back with the line.
  update public.shopping_items as stored
  set in_plan = false
  where stored.list_id = target_list_id
    and stored.source = 'generated'
    and stored.in_plan
    and not exists (select 1 from pg_temp.generated_lines as lines where lines.key = stored.generated_key);

  update public.shopping_lists
  set generated_version = current_version,
      generated_at = now(),
      missing_swap_count = missing_swaps
  where id = target_list_id;

  drop table pg_temp.generated_lines;
end;
$$;

revoke execute on function public.write_shopping_list_generation(uuid, bigint, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.write_shopping_list_generation(uuid, bigint, jsonb, integer) to service_role;

-- G2's apply_shopping_list_generation(), same arguments and errors: the signed-in user's check, then the write.
-- Someone else's plan reads as plan_not_found.
create or replace function public.apply_shopping_list_generation(
  target_plan_id uuid,
  based_on_version bigint,
  items jsonb,
  missing_swaps integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  perform public.write_shopping_list_generation(target_plan_id, based_on_version, items, missing_swaps);
end;
$$;

revoke execute on function public.apply_shopping_list_generation(uuid, bigint, jsonb, integer) from public, anon;
grant execute on function public.apply_shopping_list_generation(uuid, bigint, jsonb, integer) to authenticated;

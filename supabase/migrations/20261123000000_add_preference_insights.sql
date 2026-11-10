-- Preference insights (I2): the viewer's most liked and most skipped meals, over a chosen range.
--
-- Nothing recorded a skip before, so this adds the record, kept small:
--   * meal_plan_skips: one row each time a person takes a recipe out of a slot of a plan: swapped it for another
--     suggestion ("Suggest another", E5), or replaced or cleared it in the slot picker (E3). Generating or
--     regenerating a plan is not a skip: nobody turned that one meal down. Rows are written only by the two functions
--     below and read through row level security with their plan (can_access_meal_plan()), like the plan's slots.
--   * set_meal_plan_slot() records the recipes it replaces (other than the one it puts in).
--   * apply_meal_plan_swap() is apply_meal_plan_generation() for a swap: the same check and write, and it records the
--     recipes the swap replaced, in the same transaction.
--   * get_preference_insights(range_days) sums it up for the viewer (security invoker).
--
-- Additive and safe for the previous app version: set_meal_plan_slot() keeps its arguments, result and errors; the
-- previous app swaps through apply_meal_plan_generation(), which records nothing, so only swaps made after the app
-- deploy count. Run it before deploying the code that uses it. Every statement can run again.

create table if not exists public.meal_plan_skips (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.meal_plans (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  -- Who took it out. Kept for history only: the insights count a plan's skips whoever made them.
  skipped_by  uuid references auth.users (id) on delete set null,
  skipped_at  timestamptz not null default now()
);

-- "The skips of these plans", by time: get_preference_insights().
create index if not exists meal_plan_skips_plan_id_skipped_at_idx on public.meal_plan_skips (plan_id, skipped_at);
create index if not exists meal_plan_skips_recipe_id_idx on public.meal_plan_skips (recipe_id);

alter table public.meal_plan_skips enable row level security;

drop policy if exists "skips are readable with their plan" on public.meal_plan_skips;
create policy "skips are readable with their plan"
  on public.meal_plan_skips for select to authenticated
  using (public.can_access_meal_plan(plan_id));

-- Written only by set_meal_plan_slot() and apply_meal_plan_swap().
revoke all on public.meal_plan_skips from anon, authenticated;
grant select on public.meal_plan_skips to authenticated;

-- E5's set_meal_plan_slot(), unchanged except that the recipes it takes out of the slots it writes are recorded as
-- skipped (each once, and not the recipe it puts in, so choosing the same recipe again is not a skip).
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

  insert into public.meal_plan_skips (plan_id, recipe_id, skipped_by)
  select distinct slot_plan_id, slots.recipe_id, current_user_id
  from public.meal_plan_slots as slots
  where slots.plan_id = slot_plan_id
    and slots.meal_type = slot_meal_type
    and slots.day_index between slot_day_index and slot_day_index + fill_days - 1
    and slots.recipe_id is not null
    and slots.recipe_id is distinct from new_recipe_id;

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

-- A swap (E5, POST /api/plans/:id/slots/:slotId/swap): apply_meal_plan_generation()'s check and write, with the same
-- arguments, result and errors, and then each recipe the assignments replaced (previous_recipe_id, when the slot now
-- holds another recipe or none) is recorded as skipped, once. A refused write (plan_changed and the rest) records
-- nothing. Someone else's plan reads as plan_not_found.
create or replace function public.apply_meal_plan_swap(target_plan_id uuid, assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  filled_count integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  filled_count := public.write_meal_plan_generation(target_plan_id, assignments);

  -- The write has checked the assignments' shape, and that each slot held its previous_recipe_id.
  insert into public.meal_plan_skips (plan_id, recipe_id, skipped_by)
  select distinct target_plan_id, swapped.previous_recipe_id, current_user_id
  from jsonb_to_recordset(assignments) as swapped(recipe_id uuid, previous_recipe_id uuid)
  join public.recipes on recipes.id = swapped.previous_recipe_id
  where swapped.recipe_id is distinct from swapped.previous_recipe_id;

  return filled_count;
end;
$$;

revoke execute on function public.apply_meal_plan_swap(uuid, jsonb) from public, anon;
grant execute on function public.apply_meal_plan_swap(uuid, jsonb) to authenticated;

-- The viewer's most liked and most skipped meals, over the last range_days days (null: all time):
--   * liked: the recipes the viewer rated enjoy (their own ratings only, as ratings are private), each with how many
--     meals of it are on the plans the viewer eats from, dated from the range's start on (upcoming meals count too);
--     the most planned first, then the most recently rated. liked_count is every enjoy rating, whatever the range.
--   * skipped: the recipes taken out of slots (meal_plan_skips) of the plans the viewer eats from, in the range; the
--     most skipped first, then the most recently skipped. skip_count is every skip in the range.
-- Each list holds at most top_count recipes. Plans the viewer eats from are those they are a participant of; row level
-- security (security invoker) also keeps them to plans the viewer can open. A hidden snack slot (include_snacks off)
-- is not a planned meal.
create or replace function public.get_preference_insights(range_days integer default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- The recipes in each list. PREFERENCE_INSIGHT_TOP_COUNT in app/utils/preferenceInsights.ts.
  top_count constant integer := 5;
  current_user_id uuid := (select auth.uid());
  range_start timestamptz;
  result jsonb;
begin
  -- As get_shop_insights() (I1): ten years is plenty for "all time" to be null instead.
  if range_days is not null and range_days not between 1 and 3660 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  if range_days is not null then
    range_start := now() - make_interval(days => range_days);
  end if;

  with eaten_plans as (
    select plans.id, plans.start_date, plans.include_snacks
    from public.meal_plans as plans
    where exists (
      select 1 from public.meal_plan_participants as participants
      where participants.plan_id = plans.id and participants.user_id = current_user_id
    )
  ),
  planned_counts as (
    select slots.recipe_id, count(*) as planned_count
    from eaten_plans
    join public.meal_plan_slots as slots on slots.plan_id = eaten_plans.id
    where slots.recipe_id is not null
      and (slots.meal_type <> 'snack' or eaten_plans.include_snacks)
      and (range_start is null or eaten_plans.start_date + slots.day_index >= range_start::date)
    group by slots.recipe_id
  ),
  liked as (
    select
      recipes.id,
      recipes.name,
      recipes.meal_type,
      coalesce(planned_counts.planned_count, 0) as planned_count,
      row_number() over (
        order by coalesce(planned_counts.planned_count, 0) desc, ratings.updated_at desc, recipes.name, recipes.id
      ) as liked_rank
    from public.user_recipe_preferences as ratings
    join public.recipes on recipes.id = ratings.recipe_id
    left join planned_counts on planned_counts.recipe_id = ratings.recipe_id
    where ratings.user_id = current_user_id and ratings.rating = 'enjoy'
  ),
  visible_skips as (
    select skips.recipe_id, skips.skipped_at
    from public.meal_plan_skips as skips
    join eaten_plans on eaten_plans.id = skips.plan_id
    where range_start is null or skips.skipped_at >= range_start
  ),
  skipped as (
    select
      recipes.id,
      recipes.name,
      recipes.meal_type,
      count(*) as skip_count,
      row_number() over (order by count(*) desc, max(visible_skips.skipped_at) desc, recipes.name, recipes.id)
        as skipped_rank
    from visible_skips
    join public.recipes on recipes.id = visible_skips.recipe_id
    group by recipes.id, recipes.name, recipes.meal_type
  )
  select jsonb_build_object(
    'liked', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', id, 'name', name, 'meal_type', meal_type, 'planned_count', planned_count)
          order by liked_rank
        )
        from liked
        where liked_rank <= top_count
      ),
      '[]'::jsonb
    ),
    'liked_count', (select count(*) from liked),
    'skipped', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', id, 'name', name, 'meal_type', meal_type, 'skip_count', skip_count)
          order by skipped_rank
        )
        from skipped
        where skipped_rank <= top_count
      ),
      '[]'::jsonb
    ),
    'skip_count', (select count(*) from visible_skips)
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.get_preference_insights(integer) from public, anon;
grant execute on function public.get_preference_insights(integer) to authenticated;

comment on table public.meal_plan_skips is
  'Preference insights (I2): a recipe someone took out of a slot of a plan (swapped, replaced or cleared by hand).';
comment on function public.get_preference_insights(integer) is
  'Preference insights (I2): the caller''s enjoy-rated recipes by how often they are on their plans, and the recipes '
  'most often skipped on their plans, over the last range_days days (null: all).';

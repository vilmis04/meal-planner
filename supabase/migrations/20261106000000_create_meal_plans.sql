-- Meal plans (E1): an empty plan for a date range, for one user or for their household.
-- A plan has four slots per day (breakfast, lunch, dinner, snack); E3 and E4 fill them.
-- Plans are created only by create_meal_plan(), which writes the plan and all its slots in one
-- transaction and takes the household from the caller's own membership. The two snack options
-- are the only columns anyone can change afterwards.
-- Additive and safe for the previous app version, so run it before deploying the code that uses it.

create table public.meal_plans (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,
  -- The individual plan's owner, and its only reader. Null for a household plan.
  user_id         uuid references auth.users (id) on delete cascade,
  -- The household plan's household. Null for an individual plan.
  household_id    uuid references public.households (id) on delete cascade,
  -- Who made it. Kept for history only: a household plan outlives its creator's account.
  created_by      uuid references auth.users (id) on delete set null,
  start_date      date not null,
  day_count       smallint not null,
  -- False skips snack slots: they stay in the table, hidden, so switching back loses nothing.
  include_snacks  boolean not null default true,
  -- False leaves snack ingredients off the shopping list (G2).
  snacks_on_list  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Must match PLAN_KINDS and PLAN_DAY_COUNT_MIN/MAX in shared/utils/mealPlan.ts.
  constraint meal_plans_kind_supported check (kind in ('individual', 'household')),
  constraint meal_plans_kind_owner check (
    (kind = 'individual' and user_id is not null and household_id is null)
    or (kind = 'household' and household_id is not null and user_id is null)
  ),
  constraint meal_plans_day_count_range check (day_count between 1 and 14)
);

-- "This household's plans" and "my individual plans", by date: the plan list (E6) and plan history (E4).
create index meal_plans_household_id_start_date_idx on public.meal_plans (household_id, start_date);
create index meal_plans_user_id_start_date_idx on public.meal_plans (user_id, start_date);

create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

-- One slot per meal per day. The slot's date is start_date + day_index, so it cannot drift from the plan.
create table public.meal_plan_slots (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.meal_plans (id) on delete cascade,
  day_index  smallint not null,
  meal_type  public.meal_type not null,
  -- Empty in E1; E3 and E4 fill it.
  recipe_id  uuid references public.recipes (id) on delete set null,
  constraint meal_plan_slots_day_index_range check (day_index between 0 and 13),
  constraint meal_plan_slots_plan_day_meal_key unique (plan_id, day_index, meal_type)
);

create index meal_plan_slots_recipe_id_idx on public.meal_plan_slots (recipe_id);

-- Who can see and change a plan: the owner of an individual plan, any member of a household plan.
-- Security definer so the slot policies can ask without going through meal_plans' own RLS.
create or replace function public.can_access_meal_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meal_plans as plans
    where plans.id = target_plan_id
      and (
        (plans.kind = 'individual' and plans.user_id = (select auth.uid()))
        or (plans.kind = 'household' and public.is_household_member(plans.household_id))
      )
  );
$$;

revoke execute on function public.can_access_meal_plan(uuid) from public, anon;
grant execute on function public.can_access_meal_plan(uuid) to authenticated;

alter table public.meal_plans enable row level security;
alter table public.meal_plan_slots enable row level security;

-- No insert or delete policies: plans are created by create_meal_plan() and not deleted in E1.
create policy "plans are readable by their owner or household"
  on public.meal_plans for select to authenticated
  using (
    (kind = 'individual' and user_id = (select auth.uid()))
    or (kind = 'household' and public.is_household_member(household_id))
  );
create policy "plans are updatable by their owner or household"
  on public.meal_plans for update to authenticated
  using (
    (kind = 'individual' and user_id = (select auth.uid()))
    or (kind = 'household' and public.is_household_member(household_id))
  )
  with check (
    (kind = 'individual' and user_id = (select auth.uid()))
    or (kind = 'household' and public.is_household_member(household_id))
  );

create policy "slots are readable with their plan"
  on public.meal_plan_slots for select to authenticated
  using (public.can_access_meal_plan(plan_id));

-- Only the snack options can change: the kind, owner, household and dates are fixed once made.
revoke all on public.meal_plans from anon, authenticated;
revoke all on public.meal_plan_slots from anon, authenticated;
grant select on public.meal_plans to authenticated;
grant update (include_snacks, snacks_on_list) on public.meal_plans to authenticated;
grant select on public.meal_plan_slots to authenticated;

-- The only way to create a plan. A household plan is always for the caller's own household (a user
-- belongs to at most one), so a client can never name another household. Returns the new plan's id.
create or replace function public.create_meal_plan(
  plan_kind text,
  plan_start_date date,
  plan_day_count integer,
  plan_include_snacks boolean default true,
  plan_snacks_on_list boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
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

  if plan_kind = 'household' then
    select household_id into my_household_id
    from public.household_members
    where user_id = current_user_id;

    if my_household_id is null then
      raise exception 'not_in_household' using errcode = 'P0001';
    end if;
  end if;

  insert into public.meal_plans (
    kind, user_id, household_id, created_by, start_date, day_count, include_snacks, snacks_on_list
  )
  values (
    plan_kind,
    case when plan_kind = 'individual' then current_user_id end,
    my_household_id,
    current_user_id,
    plan_start_date,
    plan_day_count,
    coalesce(plan_include_snacks, true),
    coalesce(plan_snacks_on_list, true)
  )
  returning id into new_plan_id;

  -- Every meal type of every day, snacks included even when they are skipped.
  insert into public.meal_plan_slots (plan_id, day_index, meal_type)
  select new_plan_id, day_index, meal_type
  from generate_series(0, plan_day_count - 1) as day_index
  cross join unnest(enum_range(null::public.meal_type)) as meal_type;

  return new_plan_id;
end;
$$;

revoke execute on function public.create_meal_plan(text, date, integer, boolean, boolean) from public, anon;
grant execute on function public.create_meal_plan(text, date, integer, boolean, boolean) to authenticated;

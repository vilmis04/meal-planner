-- Meal plan participants (E2): who eats from a plan. Quantities scale to their number (G2 reads it).
-- A household plan starts with every current member and can be changed later; an individual plan has
-- exactly one participant, its owner. Rows are written only by create_meal_plan() and
-- set_meal_plan_participants(), which allow current members of the plan's household only and never
-- leave a plan without a participant. A member who leaves or is removed is taken off that
-- household's plans by a trigger, which can leave a plan with no one in it until someone is ticked.
-- Additive and safe for the previous app version: create_meal_plan() keeps its first five arguments,
-- and a call without participants gets everyone. Run it before deploying the code that uses it.

create table if not exists public.meal_plan_participants (
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (plan_id, user_id)
);

-- "The plans this person eats from": the member-left trigger and, later, plan history (E4).
create index if not exists meal_plan_participants_user_id_idx on public.meal_plan_participants (user_id);

alter table public.meal_plan_participants enable row level security;

drop policy if exists "participants are readable with their plan" on public.meal_plan_participants;
create policy "participants are readable with their plan"
  on public.meal_plan_participants for select to authenticated
  using (public.can_access_meal_plan(plan_id));

revoke all on public.meal_plan_participants from anon, authenticated;
grant select on public.meal_plan_participants to authenticated;

-- The one rule for a household plan's participants, shared by both writers: at least one, and every one
-- a current member of the household. Returns the ids without repeats or nulls. Not callable by clients.
create or replace function public.check_meal_plan_participants(target_household_id uuid, participant_ids uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  unique_ids uuid[];
begin
  select coalesce(array_agg(distinct participant_id), '{}') into unique_ids
  from unnest(coalesce(participant_ids, '{}')) as participant_id
  where participant_id is not null;

  if cardinality(unique_ids) = 0 then
    raise exception 'no_participants' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(unique_ids) as participant_id
    where not exists (
      select 1 from public.household_members
      where household_id = target_household_id and user_id = participant_id
    )
  ) then
    raise exception 'participant_not_member' using errcode = 'P0001';
  end if;

  return unique_ids;
end;
$$;

revoke execute on function public.check_meal_plan_participants(uuid, uuid[]) from public, anon, authenticated;

-- E1's create_meal_plan() with participants. The five-argument version is replaced, not overloaded, so a
-- call by name always finds exactly one function. Null participants = every current member (household)
-- or the caller (individual); an individual plan takes no list.
drop function if exists public.create_meal_plan(text, date, integer, boolean, boolean);

create or replace function public.create_meal_plan(
  plan_kind text,
  plan_start_date date,
  plan_day_count integer,
  plan_include_snacks boolean default true,
  plan_snacks_on_list boolean default true,
  plan_participant_ids uuid[] default null
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

  insert into public.meal_plan_participants (plan_id, user_id)
  select new_plan_id, participant_id
  from unnest(participant_ids) as participant_id;

  return new_plan_id;
end;
$$;

revoke execute on function public.create_meal_plan(text, date, integer, boolean, boolean, uuid[]) from public, anon;
grant execute on function public.create_meal_plan(text, date, integer, boolean, boolean, uuid[]) to authenticated;

-- Replaces a household plan's participants with the given members. The plan row is locked so two
-- changes at once take turns, and updated_at moves so the shopping list (G2) can tell it is out of date.
-- Someone else's plan reads as plan_not_found, as it does for the plan page.
create or replace function public.set_meal_plan_participants(target_plan_id uuid, participant_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  plan_kind text;
  plan_household_id uuid;
  checked_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select kind, household_id into plan_kind, plan_household_id
  from public.meal_plans
  where id = target_plan_id
  for update;

  if plan_kind is null or not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  if plan_kind <> 'household' then
    raise exception 'participants_not_allowed' using errcode = '22023';
  end if;

  checked_ids := public.check_meal_plan_participants(plan_household_id, participant_ids);

  delete from public.meal_plan_participants
  where plan_id = target_plan_id and user_id <> all (checked_ids);

  insert into public.meal_plan_participants (plan_id, user_id)
  select target_plan_id, participant_id
  from unnest(checked_ids) as participant_id
  on conflict (plan_id, user_id) do nothing;

  update public.meal_plans set updated_at = now() where id = target_plan_id;
end;
$$;

revoke execute on function public.set_meal_plan_participants(uuid, uuid[]) from public, anon;
grant execute on function public.set_meal_plan_participants(uuid, uuid[]) to authenticated;

-- Someone who leaves or is removed from a household no longer eats from its plans. Deleting the whole
-- household removes its plans by cascade, so there is nothing left for this to do then.
create or replace function public.remove_departed_meal_plan_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.meal_plan_participants as participants
  using public.meal_plans as plans
  where plans.id = participants.plan_id
    and plans.household_id = old.household_id
    and participants.user_id = old.user_id;
  return old;
end;
$$;

revoke execute on function public.remove_departed_meal_plan_participant() from public, anon, authenticated;

drop trigger if exists household_members_remove_plan_participant on public.household_members;
create trigger household_members_remove_plan_participant
  after delete on public.household_members
  for each row execute function public.remove_departed_meal_plan_participant();

-- Plans made before E2: household plans get every current member, individual plans their owner.
insert into public.meal_plan_participants (plan_id, user_id)
select plans.id, members.user_id
from public.meal_plans as plans
join public.household_members as members on members.household_id = plans.household_id
where plans.kind = 'household'
on conflict (plan_id, user_id) do nothing;

insert into public.meal_plan_participants (plan_id, user_id)
select id, user_id
from public.meal_plans
where kind = 'individual'
on conflict (plan_id, user_id) do nothing;

-- Schedule settings (H1): automatic plan creation, one schedule per person (individual) and one per household.
--
-- A schedule says on which weekday the next plan is made and what it looks like. Nothing here creates plans: the
-- scheduled job (H2) reads enabled schedules and makes each period's draft with the generator (E4) and its shopping
-- list (G2). The rules it follows, also in getScheduleRun() (shared/utils/planSchedule.ts), which the settings screen
-- uses for its "Next:" preview:
--   * the run day is a date, on the schedule's time_zone clock, whose ISO weekday (Monday = 1) is create_weekday;
--   * the plan starts on the first start_weekday after the run day (a week later when they are the same weekday) and
--     is day_count days long, so a Saturday run with a Monday start makes the Monday to Sunday plan two days later;
--   * a household plan is for every current member when includes_all_members is true, otherwise for the members in
--     plan_schedule_participants; an individual plan is for its owner;
--   * snacks_on_list becomes the plan's snacks_on_list; the plan's other options take create_meal_plan()'s defaults.
-- time_zone is the IANA zone of the browser that saved the schedule last, so "Saturday" is the saver's Saturday.
--
-- Anyone reads the schedules they could read the plans of: their own individual one and their household's. Only
-- save_plan_schedule() writes them: a person their own, the household's owner the household's. A member who leaves
-- or is removed is taken off the household schedule's participants; when no chosen participant is left the schedule
-- goes back to everyone, so an enabled schedule always has someone to plan for.
--
-- Additive and re-runnable: tables and indexes are created if missing, functions are replaced, policies and the
-- trigger are dropped and created. It can run before the app deploy.

create table if not exists public.plan_schedules (
  id                   uuid primary key default gen_random_uuid(),
  -- As meal_plans.kind: an individual schedule has user_id, a household schedule household_id.
  kind                 text not null,
  user_id              uuid references auth.users (id) on delete cascade,
  household_id         uuid references public.households (id) on delete cascade,
  is_enabled           boolean not null default false,
  -- ISO weekdays, Monday = 1 to Sunday = 7, as meal_plans.workdays. WEEKDAYS in shared/utils/mealPlan.ts.
  create_weekday       smallint not null default 6,
  start_weekday        smallint not null default 1,
  -- PLAN_DAY_COUNT_MIN/MAX in shared/utils/mealPlan.ts, as meal_plans_day_count_range.
  day_count            smallint not null default 7,
  snacks_on_list       boolean not null default true,
  -- True: every member at the time the plan is made, newcomers included. False: plan_schedule_participants.
  includes_all_members boolean not null default true,
  time_zone            text not null,
  -- Kept for history only, as meal_plans.created_by.
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint plan_schedules_kind_supported check (kind in ('individual', 'household')),
  constraint plan_schedules_kind_owner check (
    (kind = 'individual' and user_id is not null and household_id is null)
    or (kind = 'household' and household_id is not null and user_id is null)
  ),
  constraint plan_schedules_create_weekday_range check (create_weekday between 1 and 7),
  constraint plan_schedules_start_weekday_range check (start_weekday between 1 and 7),
  constraint plan_schedules_day_count_range check (day_count between 1 and 14),
  -- An individual schedule is always for its owner.
  constraint plan_schedules_individual_everyone check (kind = 'household' or includes_all_members),
  -- One schedule per person and one per household. Nulls are distinct, so the other kind's null never clashes.
  constraint plan_schedules_user_id_key unique (user_id),
  constraint plan_schedules_household_id_key unique (household_id)
);

-- What the scheduled job (H2) looks for every day: the enabled schedules of a weekday.
create index if not exists plan_schedules_enabled_create_weekday_idx
  on public.plan_schedules (create_weekday)
  where is_enabled;

drop trigger if exists plan_schedules_set_updated_at on public.plan_schedules;
create trigger plan_schedules_set_updated_at
  before update on public.plan_schedules
  for each row execute function public.set_updated_at();

comment on table public.plan_schedules is
  'Automatic plan creation (H1): when the next plan is made and what it looks like. One per person and per household.';

-- The chosen members of a household schedule that is not for everyone.
create table if not exists public.plan_schedule_participants (
  schedule_id uuid not null references public.plan_schedules (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  primary key (schedule_id, user_id)
);

-- The member-left trigger finds a person's rows by user.
create index if not exists plan_schedule_participants_user_id_idx on public.plan_schedule_participants (user_id);

alter table public.plan_schedules enable row level security;
alter table public.plan_schedule_participants enable row level security;

drop policy if exists "schedules are readable by their owner or household" on public.plan_schedules;
create policy "schedules are readable by their owner or household"
  on public.plan_schedules for select to authenticated
  using (
    (kind = 'individual' and user_id = (select auth.uid()))
    or (kind = 'household' and public.is_household_member(household_id))
  );

-- The schedule's own policy decides: a row is readable when its schedule is.
drop policy if exists "schedule participants are readable with their schedule" on public.plan_schedule_participants;
create policy "schedule participants are readable with their schedule"
  on public.plan_schedule_participants for select to authenticated
  using (exists (select 1 from public.plan_schedules as schedules where schedules.id = schedule_id));

revoke all on public.plan_schedules from anon, authenticated;
revoke all on public.plan_schedule_participants from anon, authenticated;
grant select on public.plan_schedules to authenticated;
grant select on public.plan_schedule_participants to authenticated;

-- Creates or replaces the caller's schedule of the given kind with these settings, and returns its id. A household
-- schedule is always the caller's own household's (the client never names one) and only its owner may save it.
-- Null participants = everyone in the household; a list names the members (at least one, current members only, as
-- for a plan). The row is locked by the upsert, so two saves at once take turns and the last one wins whole.
create or replace function public.save_plan_schedule(
  schedule_kind text,
  schedule_is_enabled boolean,
  schedule_create_weekday integer,
  schedule_start_weekday integer,
  schedule_day_count integer,
  schedule_snacks_on_list boolean,
  schedule_time_zone text,
  schedule_participant_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
  my_role text;
  participant_ids uuid[];
  saved_schedule_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if schedule_kind is null or schedule_kind not in ('individual', 'household') then
    raise exception 'invalid_schedule_kind' using errcode = '22023';
  end if;

  if schedule_create_weekday is null or schedule_create_weekday not between 1 and 7
    or schedule_start_weekday is null or schedule_start_weekday not between 1 and 7 then
    raise exception 'invalid_weekday' using errcode = '22023';
  end if;

  if schedule_day_count is null or schedule_day_count not between 1 and 14 then
    raise exception 'invalid_day_count' using errcode = '22023';
  end if;

  -- An IANA name the database knows, so the job (H2) can always read the schedule's clock.
  if schedule_time_zone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = schedule_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;

  if schedule_kind = 'individual' then
    if schedule_participant_ids is not null then
      raise exception 'participants_not_allowed' using errcode = '22023';
    end if;

    insert into public.plan_schedules as schedules (
      kind, user_id, is_enabled, create_weekday, start_weekday, day_count, snacks_on_list, time_zone, created_by
    )
    values (
      'individual', current_user_id, coalesce(schedule_is_enabled, false), schedule_create_weekday,
      schedule_start_weekday, schedule_day_count, coalesce(schedule_snacks_on_list, true), schedule_time_zone,
      current_user_id
    )
    on conflict (user_id) do update set
      is_enabled = excluded.is_enabled,
      create_weekday = excluded.create_weekday,
      start_weekday = excluded.start_weekday,
      day_count = excluded.day_count,
      snacks_on_list = excluded.snacks_on_list,
      time_zone = excluded.time_zone
    returning schedules.id into saved_schedule_id;

    return saved_schedule_id;
  end if;

  select household_id, role into my_household_id, my_role
  from public.household_members
  where user_id = current_user_id;

  if my_household_id is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  if my_role <> 'owner' then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  if schedule_participant_ids is not null then
    participant_ids := public.check_meal_plan_participants(my_household_id, schedule_participant_ids);
  end if;

  insert into public.plan_schedules as schedules (
    kind, household_id, is_enabled, create_weekday, start_weekday, day_count, snacks_on_list,
    includes_all_members, time_zone, created_by
  )
  values (
    'household', my_household_id, coalesce(schedule_is_enabled, false), schedule_create_weekday,
    schedule_start_weekday, schedule_day_count, coalesce(schedule_snacks_on_list, true), participant_ids is null,
    schedule_time_zone, current_user_id
  )
  on conflict (household_id) do update set
    is_enabled = excluded.is_enabled,
    create_weekday = excluded.create_weekday,
    start_weekday = excluded.start_weekday,
    day_count = excluded.day_count,
    snacks_on_list = excluded.snacks_on_list,
    includes_all_members = excluded.includes_all_members,
    time_zone = excluded.time_zone
  returning schedules.id into saved_schedule_id;

  delete from public.plan_schedule_participants
  where schedule_id = saved_schedule_id
    and (participant_ids is null or user_id <> all (participant_ids));

  if participant_ids is not null then
    insert into public.plan_schedule_participants (schedule_id, user_id)
    select saved_schedule_id, participant_id
    from unnest(participant_ids) as participant_id
    on conflict (schedule_id, user_id) do nothing;
  end if;

  return saved_schedule_id;
end;
$$;

revoke execute on function public.save_plan_schedule(text, boolean, integer, integer, integer, boolean, text, uuid[])
  from public, anon;
grant execute on function public.save_plan_schedule(text, boolean, integer, integer, integer, boolean, text, uuid[])
  to authenticated;

-- Someone who leaves or is removed from a household is no longer chosen for its schedule. If no one chosen is left,
-- the schedule is for everyone again rather than for no one. Deleting the household removes the schedule by cascade.
create or replace function public.remove_departed_plan_schedule_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.plan_schedule_participants as participants
  using public.plan_schedules as schedules
  where schedules.id = participants.schedule_id
    and schedules.household_id = old.household_id
    and participants.user_id = old.user_id;

  update public.plan_schedules as schedules
  set includes_all_members = true
  where schedules.household_id = old.household_id
    and not schedules.includes_all_members
    and not exists (
      select 1 from public.plan_schedule_participants as participants where participants.schedule_id = schedules.id
    );

  return old;
end;
$$;

revoke execute on function public.remove_departed_plan_schedule_participant() from public, anon, authenticated;

drop trigger if exists household_members_remove_schedule_participant on public.household_members;
create trigger household_members_remove_schedule_participant
  after delete on public.household_members
  for each row execute function public.remove_departed_plan_schedule_participant();

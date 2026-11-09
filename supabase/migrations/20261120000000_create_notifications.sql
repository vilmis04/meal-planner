-- Plan created notifications (H3): when the scheduled job (H2) makes a plan, the people it is for get an in-app
-- notice linking to it ("Your next draft is ready" on the home screen). Email is not part of it.
--   * notifications holds one row per person and plan: kind 'plan_created' is the only kind so far. The unique key
--     (meal_plan_id, user_id, kind) means a plan notifies a person once, however often the job runs.
--   * Who hears about a plan: the owner of an individual plan; every current member of the household for a household
--     plan, participants or not, since every member sees and can change the household's plans.
--   * create_plan_created_notifications() writes them, for the service role only (the job; no one is signed in).
--   * People read their own notices, and only while they can still open the plan (a member who left no longer sees
--     the household's), and mark them read with mark_plan_notifications_read(). There are no direct writes.
-- Additive and re-runnable: the table and index are created if missing, functions are replaced, the policy is
-- dropped and created. It can run before the app deploy.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null,
  -- The plan the notice is about. A deleted plan takes its notices along.
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- Null while unread.
  read_at      timestamptz,
  constraint notifications_kind_supported check (kind in ('plan_created')),
  constraint notifications_meal_plan_id_user_id_kind_key unique (meal_plan_id, user_id, kind)
);

-- The home screen's read: a person's unread notices, newest first.
create index if not exists notifications_user_id_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

comment on table public.notifications is
  'In-app notices (H3): a plan the scheduled job made, for each person it concerns. Written by the job only.';

alter table public.notifications enable row level security;

drop policy if exists "notifications are readable by their recipient" on public.notifications;
create policy "notifications are readable by their recipient"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.can_access_meal_plan(meal_plan_id));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Tells the people a plan concerns that it was made, and returns how many were told now. Someone already told about
-- this plan is not told again (and a notice they read stays read), so calling it twice is safe.
create or replace function public.create_plan_created_notifications(target_plan_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_plan public.meal_plans%rowtype;
  notified_count integer;
begin
  select * into target_plan
  from public.meal_plans
  where id = target_plan_id;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  insert into public.notifications (user_id, kind, meal_plan_id)
  select recipient_id, 'plan_created', target_plan_id
  from (
    select target_plan.user_id as recipient_id
    where target_plan.kind = 'individual'
    union
    select members.user_id
    from public.household_members as members
    where target_plan.kind = 'household' and members.household_id = target_plan.household_id
  ) as recipients
  on conflict (meal_plan_id, user_id, kind) do nothing;

  get diagnostics notified_count = row_count;
  return notified_count;
end;
$$;

revoke execute on function public.create_plan_created_notifications(uuid) from public, anon, authenticated;
grant execute on function public.create_plan_created_notifications(uuid) to service_role;

-- Marks the caller's unread notices about a plan read, and returns how many there were. Opening the plan does this.
create or replace function public.mark_plan_notifications_read(target_plan_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid()) and meal_plan_id = target_plan_id and read_at is null;

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

revoke execute on function public.mark_plan_notifications_read(uuid) from public, anon;
grant execute on function public.mark_plan_notifications_read(uuid) to authenticated;

-- An individual plan alongside a household plan (E7): a member taken off a household plan makes their own plan for
-- the same days; both plans exist side by side, each with its own slots and participants, each seen by its own people.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member');

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, service_role;

create function pg_temp.plan_id(plan_label text) returns uuid language sql stable as $$
  select id from created_plans where label = plan_label
$$;

-- What the plan page asks for (useMealPlans().loadOverlappingPlans()): the other plans the caller can see that share a
-- day with the plan.
create function pg_temp.overlapping_plans(plan_label text) returns setof text language sql stable as $$
  select created_plans.label
  from public.meal_plans as plans
  join created_plans on created_plans.id = plans.id
  cross join (select start_date, end_date from public.meal_plans where id = pg_temp.plan_id(plan_label)) as target
  where plans.id <> pg_temp.plan_id(plan_label)
    and plans.start_date <= target.end_date
    and plans.end_date >= target.start_date
  order by plans.start_date, created_plans.label
$$;

-- Ana makes the household plan for 16–22 November; everyone takes part
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created_plans values ('home', public.create_meal_plan('household', '2026-11-16', 7));

-- Monika takes herself off it (E2) and makes her own plan for the same days (AC1)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_meal_plan_participants(pg_temp.plan_id('home'), array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  'Monika unticks herself on the household plan');
select lives_ok(
  $$ insert into created_plans values ('monika', public.create_meal_plan('individual', '2026-11-16', 7)) $$,
  'Monika creates an individual plan for the same days');

-- Both plans exist side by side, each its own (AC2)
reset role;
select results_eq(
  $$ select created_plans.label, plans.kind, plans.start_date, plans.end_date
     from public.meal_plans as plans join created_plans on created_plans.id = plans.id order by created_plans.label $$,
  $$ values ('home'::text, 'household'::text, '2026-11-16'::date, '2026-11-22'::date),
            ('monika', 'individual', '2026-11-16', '2026-11-22') $$,
  'a household plan and an individual plan cover the same days');
select results_eq(
  $$ select created_plans.label, participants.user_id
     from public.meal_plan_participants as participants join created_plans on created_plans.id = participants.plan_id
     order by created_plans.label $$,
  $$ values ('home'::text, '00000000-0000-0000-0000-000000000001'::uuid),
            ('monika', '00000000-0000-0000-0000-000000000002'::uuid) $$,
  'Ana eats from the household plan and Monika from her own, so each scales to one person');
select results_eq(
  $$ select created_plans.label, count(*)::int
     from public.meal_plan_slots as slots join created_plans on created_plans.id = slots.plan_id
     group by created_plans.label order by created_plans.label $$,
  $$ values ('home'::text, 28), ('monika', 28) $$,
  'each plan has its own slots for every day and meal');

-- Who sees which: the plan page's query for the same days, and the plan list on 9 November
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select pg_temp.overlapping_plans('home') $$,
  $$ values ('monika'::text) $$,
  'on the household plan, Monika sees her own plan for those days');
select results_eq(
  $$ select pg_temp.overlapping_plans('monika') $$,
  $$ values ('home'::text) $$,
  'on her own plan, Monika sees the household plan beside it');
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date >= '2026-11-09' order by plans.start_date, created_plans.label $$,
  $$ values ('home'::text), ('monika') $$,
  'Monika''s plan list has both');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from pg_temp.overlapping_plans('home')), 0,
  'Ana does not see Monika''s individual plan beside the household plan');
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date >= '2026-11-09' $$,
  $$ values ('home'::text) $$,
  'Ana''s plan list has the household plan only');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = pg_temp.plan_id('monika')), 0,
  'nor its slots');
select lives_ok(
  $$ select public.set_meal_plan_slot(
       (select id from public.meal_plan_slots where plan_id = pg_temp.plan_id('home') and day_index = 0
          and meal_type = 'dinner'),
       (select id from public.recipes where meal_type = 'dinner' order by id limit 1)) $$,
  'Ana fills a dinner in the household plan');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = pg_temp.plan_id('monika') and recipe_id is not null), 0,
  'Monika''s plan is untouched by the household plan''s changes');
select lives_ok(
  $$ select public.set_meal_plan_slot(
       (select id from public.meal_plan_slots where plan_id = pg_temp.plan_id('monika') and day_index = 0
          and meal_type = 'dinner'),
       (select id from public.recipes where meal_type = 'dinner' order by id desc limit 1)) $$,
  'Monika fills the same dinner in her own plan with something else');

-- The generator's cooldown reads plans before the start only, so neither plan for the same days counts for the other
set local role service_role;
select is(
  (select count(*)::int from public.meal_plan_recipe_history(pg_temp.plan_id('monika'), 28)), 0,
  'the household plan for the same days is not in the history of Monika''s plan');
select is(
  (select count(*)::int from public.meal_plan_recipe_history(pg_temp.plan_id('home'), 28)), 0,
  'nor is Monika''s plan in the household plan''s history');

-- Plans for the same days are never refused: someone may still eat from the household plan and have their own
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ insert into created_plans values ('ana', public.create_meal_plan('individual', '2026-11-20', 3)) $$,
  'Ana makes her own plan for some of the household plan''s days while she eats from it');
select results_eq(
  $$ select pg_temp.overlapping_plans('home') $$,
  $$ values ('ana'::text) $$,
  'Ana sees her own plan beside the household plan, still not Monika''s');

-- Ticking Monika back in or her leaving the household leaves her own plan as it is
select lives_ok(
  $$ select public.set_meal_plan_participants(pg_temp.plan_id('home'),
       array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid]) $$,
  'Ana ticks Monika back in on the household plan');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok($$ select public.leave_household() $$, 'Monika leaves the household');
select results_eq(
  $$ select pg_temp.overlapping_plans('monika') $$,
  $$ values (null::text) limit 0 $$,
  'Monika no longer sees the household plan beside her own');
reset role;
select results_eq(
  $$ select participants.user_id, (select count(*)::int from public.meal_plan_slots where plan_id = pg_temp.plan_id('monika'))
     from public.meal_plan_participants as participants where participants.plan_id = pg_temp.plan_id('monika') $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid, 28) $$,
  'her individual plan is still hers, with all its slots');

select * from finish();
rollback;

-- Meal plans (E1): creating a plan shell, who can see it, and what can change afterwards.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Other: Ola (owner)     Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}'),
  ('00000000-0000-0000-0000-000000000007', 'ola@example.com', '{"full_name": "Ola"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f3', 'Other');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000007', 'owner');

-- A member (not the owner) creates a household plan with the defaults (AC1 to AC4, AC7)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select ok(
  public.create_meal_plan('household', '2026-11-09', 7) is not null,
  'a household member creates a 7-day household plan');
select is(
  (select count(*)::int from public.meal_plans where kind = 'household'), 1,
  'one household plan exists');
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = (select id from public.meal_plans where kind = 'household')), 28,
  'a 7-day plan has 28 slots');
select results_eq(
  $$ select meal_type::text as meal, count(*)::int from public.meal_plan_slots
     where plan_id = (select id from public.meal_plans where kind = 'household')
     group by meal_type order by meal_type $$,
  $$ values ('breakfast'::text, 7), ('lunch', 7), ('dinner', 7), ('snack', 7) $$,
  'every day has a breakfast, lunch, dinner and snack slot');
select results_eq(
  $$ select distinct day_index::int from public.meal_plan_slots
     where plan_id = (select id from public.meal_plans where kind = 'household') order by 1 $$,
  $$ select generate_series(0, 6) $$,
  'the slots cover days 0 to 6');
select results_eq(
  $$ select household_id, user_id, created_by, start_date, day_count::int, include_snacks, snacks_on_list
     from public.meal_plans where kind = 'household' $$,
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, null::uuid, '00000000-0000-0000-0000-000000000002'::uuid,
             '2026-11-09'::date, 7, true, true) $$,
  'the plan belongs to the caller''s household, and snacks are included and on the list by default');

-- Length limits (AC1) and invalid input
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 0) $$,
  '22023', 'invalid_day_count', 'a plan cannot have 0 days');
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 15) $$,
  '22023', 'invalid_day_count', 'a plan cannot have 15 days');
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', null) $$,
  '22023', 'invalid_day_count', 'a plan needs a length');
select throws_ok(
  $$ select public.create_meal_plan('team', '2026-11-09', 7) $$,
  '22023', 'invalid_plan_kind', 'a plan is individual or household');
select throws_ok(
  $$ select public.create_meal_plan('individual', null, 7) $$,
  '22023', 'invalid_start_date', 'a plan needs a start date');

-- Individual plans with the snack options switched (AC2, AC4, AC5)
select ok(
  public.create_meal_plan('individual', '2026-11-16', 14, false, false) is not null,
  'a member creates a 14-day individual plan with snacks skipped and off the list');
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = (select id from public.meal_plans where day_count = 14)), 56,
  'a 14-day plan has 56 slots: skipped snack slots are kept');
select results_eq(
  $$ select user_id, household_id, include_snacks, snacks_on_list from public.meal_plans where day_count = 14 $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid, null::uuid, false, false) $$,
  'the individual plan belongs to its creator alone and keeps the chosen snack options');
select ok(
  public.create_meal_plan('individual', '2026-11-09', 1) is not null,
  'a 1-day plan can be created');
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = (select id from public.meal_plans where day_count = 1)), 4,
  'a 1-day plan has 4 slots');

-- Household plans need a household (AC7)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 7) $$,
  'P0001', 'not_in_household', 'someone without a household cannot create a household plan');
select ok(
  public.create_meal_plan('individual', '2026-11-09', 3) is not null,
  'someone without a household creates an individual plan');

-- Who sees what (AC7, AC8)
select results_eq(
  $$ select kind, day_count::int from public.meal_plans order by day_count $$,
  $$ values ('individual'::text, 3) $$,
  'Jonas sees only his own plan');
select is(
  (select count(*)::int from public.meal_plan_slots), 12, 'Jonas sees only his own plan''s slots');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq(
  $$ select kind, day_count::int from public.meal_plans order by day_count $$,
  $$ values ('household'::text, 7) $$,
  'another member sees the household plan but not Monika''s individual plans');
select is(
  (select count(*)::int from public.meal_plan_slots), 28, 'and only the household plan''s slots');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select kind, day_count::int from public.meal_plans order by day_count $$,
  $$ values ('individual'::text, 1), ('household', 7), ('individual', 14) $$,
  'Monika sees her individual plans and her household''s plan');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is_empty($$ select id from public.meal_plans $$, 'another household sees no plans');
select is_empty($$ select id from public.meal_plan_slots $$, 'another household sees no slots');

-- Changing the snack options later (AC6), and nothing else
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ update public.meal_plans set include_snacks = false, snacks_on_list = false where kind = 'household' $$,
  'a member changes the household plan''s snack options');
select results_eq(
  $$ select include_snacks, snacks_on_list from public.meal_plans where kind = 'household' $$,
  $$ values (false, false) $$,
  'the snack options are saved');
select throws_ok(
  $$ update public.meal_plans set start_date = '2026-12-01' where kind = 'household' $$,
  '42501', 'permission denied for table meal_plans', 'the start date cannot be changed');
select throws_ok(
  $$ update public.meal_plans set kind = 'individual' where kind = 'household' $$,
  '42501', 'permission denied for table meal_plans', 'the plan kind cannot be changed');
select throws_ok(
  $$ update public.meal_plans set household_id = '00000000-0000-0000-0000-0000000000f3' $$,
  '42501', 'permission denied for table meal_plans', 'a plan cannot be moved to another household');
select is_empty(
  $$ update public.meal_plans set include_snacks = true where kind = 'individual' returning id $$,
  'a member cannot change another member''s individual plan');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is_empty(
  $$ update public.meal_plans set include_snacks = true returning id $$,
  'another household cannot change the plan');

-- Plans and slots are written only by create_meal_plan() and not deleted in E1
select throws_ok(
  $$ insert into public.meal_plans (kind, user_id, start_date, day_count)
     values ('individual', '00000000-0000-0000-0000-000000000007', '2026-11-09', 7) $$,
  '42501', 'permission denied for table meal_plans', 'plans cannot be inserted directly');
select throws_ok(
  $$ insert into public.meal_plan_slots (plan_id, day_index, meal_type)
     select id, 7, 'snack' from public.meal_plans $$,
  '42501', 'permission denied for table meal_plan_slots', 'slots cannot be inserted directly');
select throws_ok(
  $$ delete from public.meal_plans $$,
  '42501', 'permission denied for table meal_plans', 'plans cannot be deleted');
select throws_ok(
  $$ update public.meal_plan_slots set recipe_id = null $$,
  '42501', 'permission denied for table meal_plan_slots', 'slots cannot be changed in E1');

reset role;
set local role anon;
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-09', 7) $$,
  '42501', 'permission denied for function create_meal_plan', 'a signed-out visitor cannot create a plan');

-- Leaving the household ends access to its plans at once (AC7)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok($$ select public.leave_household() $$, 'Monika leaves the household');
select results_eq(
  $$ select kind, day_count::int from public.meal_plans order by day_count $$,
  $$ values ('individual'::text, 1), ('individual', 14) $$,
  'after leaving, Monika keeps her individual plans and no longer sees the household plan');
select is(
  (select count(*)::int from public.meal_plan_slots), 60, 'and sees only her own plans'' slots');

-- Deleting the household deletes its plans and slots
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.delete_household() $$, 'Ana deletes the household');
reset role;
select is(
  (select count(*)::int from public.meal_plans where kind = 'household'), 0, 'the household plan is gone');
select is(
  (select count(*)::int from public.meal_plan_slots), 72, 'its slots are gone; individual plans keep theirs');

-- Table rules hold for any writer
select throws_ok(
  $$ insert into public.meal_plans (kind, start_date, day_count) values ('household', '2026-11-09', 7) $$,
  '23514', 'new row for relation "meal_plans" violates check constraint "meal_plans_kind_owner"',
  'a household plan needs a household');
select throws_ok(
  $$ insert into public.meal_plans (kind, user_id, household_id, start_date, day_count)
     values ('individual', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000f3', '2026-11-09', 7) $$,
  '23514', 'new row for relation "meal_plans" violates check constraint "meal_plans_kind_owner"',
  'an individual plan has no household');
select throws_ok(
  $$ insert into public.meal_plans (kind, user_id, start_date, day_count)
     values ('individual', '00000000-0000-0000-0000-000000000004', '2026-11-09', 15) $$,
  '23514', 'new row for relation "meal_plans" violates check constraint "meal_plans_day_count_range"',
  'a plan has at most 14 days');

-- Deleting an account deletes that person's individual plans
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-000000000004' $$, 'Jonas deletes his account');
select is(
  (select count(*)::int from public.meal_plans where day_count = 3), 0, 'Jonas''s plan is gone with his account');

select * from finish();
rollback;

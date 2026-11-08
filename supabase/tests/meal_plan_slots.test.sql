-- Manual slot editing (E3): set_meal_plan_slot() and meal_plan_hated_recipes().
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika, Petras     Jonas has no household.
--   A 3-day household plan for Ana and Monika (Petras left out), and Jonas's own 2-day plan.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'petras@example.com', '{"full_name": "Petras"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'member');

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'E3 test stew', 'dinner', '', 2, '{plant}'),
  ('00000000-0000-0000-0000-0000000000e2', 'E3 test salmon', 'dinner', '', 1, '{fish}'),
  ('00000000-0000-0000-0000-0000000000e3', 'E3 test porridge', 'breakfast', '', 1, '{egg_dairy}');

-- Ratings: Monika hates the stew and enjoys the salmon, Petras (not in the plan) hates the salmon,
-- Jonas hates the porridge.
insert into public.user_recipe_preferences (user_id, recipe_id, rating) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1', 'hate'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2', 'enjoy'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e2', 'hate'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000e3', 'hate');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select ok(
  public.create_meal_plan('household', '2026-11-09', 3, true, true, array[
    '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid]) is not null,
  'Ana creates a 3-day plan for herself and Monika');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select ok(public.create_meal_plan('individual', '2026-11-09', 2) is not null, 'Jonas creates his own 2-day plan');
reset role;

-- Slot ids by plan, day and meal, read as the owner so the tests below can name them.
create temporary table slot_ids on commit drop as
select slots.id, plans.kind, slots.day_index, slots.meal_type::text as meal_type, plans.id as plan_id
from public.meal_plan_slots as slots
join public.meal_plans as plans on plans.id = slots.plan_id;
grant select on slot_ids to authenticated;

create function pg_temp.slot(plan_kind text, day integer, meal text) returns uuid language sql stable as $$
  select id from slot_ids where kind = plan_kind and day_index = day and meal_type = meal
$$;
create function pg_temp.plan_of(plan_kind text) returns uuid language sql stable as $$
  select distinct plan_id from slot_ids where kind = plan_kind
$$;
create function pg_temp.recipe_in(plan_kind text, day integer, meal text) returns uuid language sql stable as $$
  select recipe_id from public.meal_plan_slots where id = pg_temp.slot(plan_kind, day, meal)
$$;

-- Choosing a recipe (AC1)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e2') $$,
  'Monika puts a dinner in a dinner slot');
select is(pg_temp.recipe_in('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e2'::uuid,
  'the slot holds the recipe');
select is(pg_temp.recipe_in('household', 1, 'dinner'), null, 'a one-day recipe fills one slot');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'lunch'), '00000000-0000-0000-0000-0000000000e2') $$,
  '22023', 'meal_type_mismatch', 'a dinner cannot go in a lunch slot');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'recipe_not_found', 'an unknown recipe is refused');
select is(pg_temp.recipe_in('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e2'::uuid,
  'a refused change leaves the slot as it was');

-- A 2-day recipe fills the next day's matching slot when asked (AC3)
select lives_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 1, 'dinner'), '00000000-0000-0000-0000-0000000000e1', 2) $$,
  'a 2-day recipe placed on day 2 with fill_days 2');
select results_eq(
  $$ select recipe_id from public.meal_plan_slots
     where plan_id = pg_temp.plan_of('household') and meal_type = 'dinner' order by day_index $$,
  $$ values ('00000000-0000-0000-0000-0000000000e2'::uuid), ('00000000-0000-0000-0000-0000000000e1'::uuid),
            ('00000000-0000-0000-0000-0000000000e1'::uuid) $$,
  'it fills that day and the next, and leaves the day before alone');
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = pg_temp.plan_of('household') and meal_type <> 'dinner' and recipe_id is not null), 0,
  'only the matching meal is filled');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 2, 'dinner'), '00000000-0000-0000-0000-0000000000e1', 2) $$,
  '22023', 'beyond_plan_end', 'the last day cannot fill a day after the plan');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e2', 2) $$,
  '22023', 'invalid_fill_days', 'a one-day recipe cannot fill two days');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e1', 0) $$,
  '22023', 'invalid_fill_days', 'fill_days is at least 1');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e1', null) $$,
  '22023', 'invalid_fill_days', 'fill_days cannot be null');
select is(
  (select count(*)::int from public.meal_plan_slots
   where plan_id = pg_temp.plan_of('household') and meal_type = 'dinner' and recipe_id is not null), 3,
  'refused batch changes write nothing');

-- Clearing a slot
select lives_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 2, 'dinner'), null) $$,
  'Monika empties a slot');
select is(pg_temp.recipe_in('household', 2, 'dinner'), null, 'the slot is empty');
select is(pg_temp.recipe_in('household', 1, 'dinner'), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'emptying one day of a batch leaves the other day');
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), null, 2) $$,
  '22023', 'invalid_fill_days', 'emptying covers one slot only');

-- Changing a slot moves the plan's updated_at, for the shopping list (G2)
reset role;
update public.meal_plans set updated_at = '2000-01-01' where id = pg_temp.plan_of('household');
set local role authenticated;
select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'breakfast'), '00000000-0000-0000-0000-0000000000e3');
select ok(
  (select updated_at > '2000-01-01' from public.meal_plans where id = pg_temp.plan_of('household')),
  'updated_at moves');

-- Who can change slots
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'breakfast'), null) $$,
  'Petras, a member who is not a participant, can still edit the household plan');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_meal_plan_slot(pg_temp.slot('household', 0, 'dinner'), null) $$,
  'P0001', 'plan_not_found', 'Jonas cannot change another household''s plan');
select throws_ok(
  $$ select public.set_meal_plan_slot('00000000-0000-0000-0000-0000000000ff', null) $$,
  'P0001', 'plan_not_found', 'an unknown slot reads as plan_not_found');
select throws_ok(
  $$ update public.meal_plan_slots set recipe_id = null $$,
  '42501', null, 'slots cannot be updated directly');

-- Hate warnings (AC2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq(
  $$ select recipe_id, user_id from public.meal_plan_hated_recipes(pg_temp.plan_of('household')) $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, '00000000-0000-0000-0000-000000000002'::uuid) $$,
  'Ana sees Monika''s hate, not her enjoy, and not Petras''s hate (he is not a participant)');
select is(
  (select count(*)::int from public.user_recipe_preferences), 0,
  'the ratings table itself stays private');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plan_hated_recipes(pg_temp.plan_of('household'))), 1,
  'a member who is not a participant sees the participants'' hates too');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plan_hated_recipes(pg_temp.plan_of('household'))), 0,
  'someone outside the household gets nothing');
select results_eq(
  $$ select recipe_id, user_id from public.meal_plan_hated_recipes(pg_temp.plan_of('individual')) $$,
  $$ values ('00000000-0000-0000-0000-0000000000e3'::uuid, '00000000-0000-0000-0000-000000000004'::uuid) $$,
  'an individual plan lists its owner''s own hates');

-- Taking someone out of the plan takes their hates out of the warnings
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select public.set_meal_plan_participants(pg_temp.plan_of('household'), array['00000000-0000-0000-0000-000000000001'::uuid]);
select is(
  (select count(*)::int from public.meal_plan_hated_recipes(pg_temp.plan_of('household'))), 0,
  'Monika''s hates go once she is no longer a participant');

-- Not callable signed out
reset role;
set local role anon;
select throws_ok(
  $$ select public.set_meal_plan_slot('00000000-0000-0000-0000-0000000000ff', null) $$,
  '42501', null, 'anon cannot change a slot');
select throws_ok(
  $$ select * from public.meal_plan_hated_recipes('00000000-0000-0000-0000-0000000000ff') $$,
  '42501', null, 'anon cannot read hates');

reset role;
select * from finish();
rollback;

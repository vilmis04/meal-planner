-- Plan overview and history (E6): meal_plans.end_date, the queries the plan list sends for its current, upcoming and
-- past sections, and who sees which plan in them: every member sees the household's plans, past ones too, and only
-- the owner sees an individual plan.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Other: Ola (owner)     Jonas joins Home later.
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

select has_column('public', 'meal_plans', 'end_date', 'plans have an end date');
select col_type_is('public', 'meal_plans', 'end_date', 'date', 'the end date is a date');
select has_index('public', 'meal_plans', 'meal_plans_household_id_end_date_idx', 'household plans are indexed by end date');
select has_index('public', 'meal_plans', 'meal_plans_user_id_end_date_idx', 'individual plans are indexed by end date');

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created_plans values
  ('home past', public.create_meal_plan('household', '2026-10-19', 7)),
  ('home current', public.create_meal_plan('household', '2026-11-02', 7)),
  ('home upcoming', public.create_meal_plan('household', '2026-11-16', 14)),
  ('ana past', public.create_meal_plan('individual', '2026-10-26', 1));

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into created_plans values
  ('monika past', public.create_meal_plan('individual', '2026-10-12', 3)),
  ('monika upcoming', public.create_meal_plan('individual', '2026-11-09', 7));

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
insert into created_plans values ('other current', public.create_meal_plan('household', '2026-11-05', 7));

-- The end date is the last day of the plan, and nobody writes it
reset role;
select results_eq(
  $$ select created_plans.label, plans.end_date from public.meal_plans as plans
     join created_plans on created_plans.id = plans.id order by plans.start_date, created_plans.label $$,
  $$ values ('monika past'::text, '2026-10-14'::date), ('home past', '2026-10-25'), ('ana past', '2026-10-26'),
            ('home current', '2026-11-08'), ('other current', '2026-11-11'), ('monika upcoming', '2026-11-15'),
            ('home upcoming', '2026-11-29') $$,
  'end_date is start_date + day_count - 1, a one-day plan ending on the day it starts');
select throws_ok(
  $$ update public.meal_plans set end_date = '2027-01-01' $$,
  '428C9', null, 'not even the migration owner can set the end date');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ update public.meal_plans set end_date = '2027-01-01' $$,
  '428C9', null, 'a member cannot set the end date either');

-- The plan list's queries on 8 November: current and upcoming (end_date >= today), then past (end_date < today)
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date >= '2026-11-08' order by plans.start_date $$,
  $$ values ('home current'::text), ('home upcoming') $$,
  'Ana''s current and upcoming plans: her household''s, a plan ending today included, not Monika''s individual one');
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date < '2026-11-08' order by plans.start_date desc $$,
  $$ values ('ana past'::text), ('home past') $$,
  'Ana''s past plans, newest first: her own and her household''s');
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date < '2026-11-08' order by plans.start_date desc limit 1 offset 1 $$,
  $$ values ('home past'::text) $$,
  'past plans page by offset');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date >= '2026-11-08' order by plans.start_date $$,
  $$ values ('home current'::text), ('monika upcoming'), ('home upcoming') $$,
  'Monika''s current and upcoming plans: the household''s beside her own individual plan');
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     where plans.end_date < '2026-11-08' order by plans.start_date desc $$,
  $$ values ('home past'::text), ('monika past') $$,
  'Monika''s past plans: the household''s and her own, not Ana''s');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = (select id from created_plans where label = 'ana past')),
  0, 'Monika cannot read the slots of Ana''s past individual plan');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = (select id from created_plans where label = 'home past')),
  28, 'Monika reads every slot of the household''s past plan');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id $$,
  $$ values ('other current'::text) $$,
  'another household sees only its own plan, in any section');

-- Someone who joins later sees the household's history; someone removed loses it at once
reset role;
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000004', 'member');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select results_eq(
  $$ select created_plans.label from public.meal_plans as plans join created_plans on created_plans.id = plans.id
     order by plans.start_date $$,
  $$ values ('home past'::text), ('home current'), ('home upcoming') $$,
  'a new member sees the household''s plans from before they joined, and no one''s individual plans');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = (select id from created_plans where label = 'home past')),
  28, 'and the slots of its past plans');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000004') $$, 'Ana removes Jonas');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is_empty($$ select id from public.meal_plans $$, 'a removed member sees none of the household''s plans');
select is_empty($$ select id from public.meal_plan_slots $$, 'nor their slots');

-- Signed-out visitors see nothing
reset role;
set local role anon;
select throws_ok(
  $$ select id from public.meal_plans where end_date < '2026-11-08' $$,
  '42501', 'permission denied for table meal_plans', 'a signed-out visitor cannot list plans');

select * from finish();
rollback;

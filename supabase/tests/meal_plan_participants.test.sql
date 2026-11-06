-- Meal plan participants (E2): defaults, the at-least-one and members-only rules, editing, and departures.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(46);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika, Petras     Other: Ola (owner)     Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'petras@example.com', '{"full_name": "Petras"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}'),
  ('00000000-0000-0000-0000-000000000007', 'ola@example.com', '{"full_name": "Ola"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f3', 'Other');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'member'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000007', 'owner');

-- Creating a household plan: everyone by default, or the members chosen (AC1)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select ok(
  public.create_meal_plan('household', '2026-11-09', 7) is not null,
  'Monika creates a household plan without choosing participants');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 7) order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'::uuid),
            ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'every current member takes part by default');
select ok(
  public.create_meal_plan('household', '2026-11-09', 5, true, true, array['00000000-0000-0000-0000-000000000002'::uuid])
    is not null,
  'Monika creates a household plan for herself only');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 5) $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'only the ticked member takes part');
select ok(
  public.create_meal_plan('household', '2026-11-09', 4, true, true, array[
    '00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, null]) is not null,
  'a repeated or empty id is ignored');
select is(
  (select count(*)::int from public.meal_plan_participants
   where plan_id = (select id from public.meal_plans where day_count = 4)), 1,
  'a member is a participant once');

-- At least one participant (AC2), members only (AC5)
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 3, true, true, '{}') $$,
  '22023', 'no_participants', 'a household plan cannot be created for no one');
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 3, true, true, array[null::uuid]) $$,
  '22023', 'no_participants', 'a list of nothing but empty ids is no one');
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 3, true, true,
       array['00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000007'::uuid]) $$,
  'P0001', 'participant_not_member', 'someone from another household cannot take part');
select throws_ok(
  $$ select public.create_meal_plan('household', '2026-11-09', 3, true, true, array['00000000-0000-0000-0000-000000000004'::uuid]) $$,
  'P0001', 'participant_not_member', 'someone with no household cannot take part');
select is(
  (select count(*)::int from public.meal_plans where day_count = 3), 0, 'a refused plan is not created');

-- Individual plans have their owner as the only participant (AC6)
select ok(
  public.create_meal_plan('individual', '2026-11-09', 2) is not null, 'Monika creates an individual plan');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 2) $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'the owner is the individual plan''s participant');
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-09', 3, true, true, array['00000000-0000-0000-0000-000000000002'::uuid]) $$,
  '22023', 'participants_not_allowed', 'an individual plan takes no participant list');
select throws_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 2), array['00000000-0000-0000-0000-000000000002'::uuid]) $$,
  '22023', 'participants_not_allowed', 'an individual plan''s participant cannot be changed');

-- Who sees the participants (AC4)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plan_participants), 5,
  'Ana sees the participants of the household plans, not of Monika''s individual plan');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is_empty($$ select plan_id from public.meal_plan_participants $$, 'another household sees no participants');

-- Changing the participants of an existing plan (AC3)
reset role;
update public.meal_plans set updated_at = '2026-01-01' where day_count = 7;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 7),
       array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid]) $$,
  'Ana unticks Monika');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 7) order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'the plan now has Ana and Petras');
select ok(
  (select updated_at > '2026-01-01' from public.meal_plans where day_count = 7),
  'the plan is marked as changed, so the shopping list can be refreshed');
select lives_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 7), array['00000000-0000-0000-0000-000000000003'::uuid]) $$,
  'Ana takes herself off the plan');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 7) $$,
  $$ values ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'only Petras is left');
select is(
  (select count(*)::int from public.meal_plans where day_count = 7), 1,
  'Ana still sees the plan she is not eating from');
select throws_ok(
  $$ select public.set_meal_plan_participants((select id from public.meal_plans where day_count = 7), '{}') $$,
  '22023', 'no_participants', 'the last participant cannot be unticked');
select throws_ok(
  $$ select public.set_meal_plan_participants((select id from public.meal_plans where day_count = 7), null) $$,
  '22023', 'no_participants', 'no list is no one');
select throws_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 7), array['00000000-0000-0000-0000-000000000007'::uuid]) $$,
  'P0001', 'participant_not_member', 'someone from another household cannot be ticked');
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 7) $$,
  $$ values ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'a refused change changes nothing');

-- Someone else's plan cannot be changed
select throws_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 2), array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  'P0001', 'plan_not_found', 'Ana cannot change Monika''s individual plan');
select throws_ok(
  $$ select public.set_meal_plan_participants(
       '00000000-0000-0000-0000-00000000dead', array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  'P0001', 'plan_not_found', 'a plan that does not exist is not found');

-- Ola cannot see Home's plans, so she passes their id in from outside.
reset role;
create temporary table home_plan as select id from public.meal_plans where day_count = 7;
grant select on home_plan to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_meal_plan_participants(
       (select id from home_plan), array['00000000-0000-0000-0000-000000000007'::uuid]) $$,
  'P0001', 'plan_not_found', 'another household cannot change the plan');

set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok(
  $$ select public.set_meal_plan_participants((select id from home_plan), array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  '28000', 'not_authenticated', 'a request without a user is refused');

-- Participants are written only by the two functions
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.meal_plan_participants (plan_id, user_id)
     select id, '00000000-0000-0000-0000-000000000001' from public.meal_plans where day_count = 7 $$,
  '42501', 'permission denied for table meal_plan_participants', 'participants cannot be inserted directly');
select throws_ok(
  $$ delete from public.meal_plan_participants $$,
  '42501', 'permission denied for table meal_plan_participants', 'participants cannot be deleted directly');
select throws_ok(
  $$ update public.meal_plan_participants set user_id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', 'permission denied for table meal_plan_participants', 'participants cannot be changed directly');
select throws_ok(
  $$ select public.check_meal_plan_participants('00000000-0000-0000-0000-0000000000f1', '{}') $$,
  '42501', 'permission denied for function check_meal_plan_participants', 'the shared check is not callable');

reset role;
set local role anon;
select throws_ok(
  $$ select public.set_meal_plan_participants(
       '00000000-0000-0000-0000-00000000dead', array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  '42501', 'permission denied for function set_meal_plan_participants', 'a signed-out visitor cannot change participants');

-- Leaving or being removed takes a member off the household's plans
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 7),
       array['00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid]) $$,
  'Ana ticks Monika and Petras');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select lives_ok($$ select public.leave_household() $$, 'Petras leaves the household');
reset role;
select results_eq(
  $$ select user_id from public.meal_plan_participants
     where plan_id = (select id from public.meal_plans where day_count = 7) $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'Petras is no longer in the plan; Monika still is');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000002') $$, 'Ana removes Monika');
reset role;
select is(
  (select count(*)::int from public.meal_plan_participants
   where plan_id in (select id from public.meal_plans where kind = 'household')
     and user_id = '00000000-0000-0000-0000-000000000002'), 0,
  'Monika is in none of the household''s plans');
select is(
  (select count(*)::int from public.meal_plan_participants
   where plan_id = (select id from public.meal_plans where day_count = 7)), 0,
  'a plan whose last participant left has no one in it');
select is(
  (select count(*)::int from public.meal_plan_participants
   where plan_id = (select id from public.meal_plans where day_count = 2)), 1,
  'Monika keeps her individual plan''s participation');

-- A plan with no one in it gets participants again by the usual route
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_meal_plan_participants(
       (select id from public.meal_plans where day_count = 7), array['00000000-0000-0000-0000-000000000001'::uuid]) $$,
  'Ana ticks herself on the empty plan');

-- Deleting the household deletes its plans' participants
select lives_ok($$ select public.delete_household() $$, 'Ana deletes the household');
reset role;
select is(
  (select count(*)::int from public.meal_plan_participants), 1,
  'only the individual plan''s participant is left');

select * from finish();
rollback;

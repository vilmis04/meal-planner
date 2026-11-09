-- Schedule settings (H1): one schedule per person and per household, who reads and saves them, the rules a schedule
-- is checked against, and what a member leaving does to its participants.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(60);

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

-- Shape
select has_table('public', 'plan_schedules', 'plan_schedules exists');
select has_table('public', 'plan_schedule_participants', 'plan_schedule_participants exists');
select col_default_is('public', 'plan_schedules', 'is_enabled', 'false', 'a schedule starts switched off');
select col_default_is('public', 'plan_schedules', 'create_weekday', '6', 'plans are made on Saturday by default');
select col_default_is('public', 'plan_schedules', 'start_weekday', '1', 'and start on the following Monday');
select col_default_is('public', 'plan_schedules', 'day_count', '7', 'for a week');
select throws_ok(
  $$ insert into public.plan_schedules (kind, user_id, create_weekday, time_zone)
     values ('individual', '00000000-0000-0000-0000-000000000004', 8, 'UTC') $$,
  '23514', null, 'a weekday is 1 to 7');
select throws_ok(
  $$ insert into public.plan_schedules (kind, household_id, user_id, time_zone)
     values ('household', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000004', 'UTC') $$,
  '23514', null, 'a household schedule has no owner person');
select throws_ok(
  $$ insert into public.plan_schedules (kind, user_id, includes_all_members, time_zone)
     values ('individual', '00000000-0000-0000-0000-000000000004', false, 'UTC') $$,
  '23514', null, 'an individual schedule is always for its owner');

-- The owner saves the household schedule (AC1, AC2)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.plan_schedules), 0, 'there is no schedule until one is saved');
select ok(
  public.save_plan_schedule('household', true, 6, 1, 7, false, 'Europe/Vilnius') is not null,
  'Ana, the owner, saves the household schedule');
select results_eq(
  $$ select kind, household_id, user_id, is_enabled, create_weekday::int, start_weekday::int, day_count::int,
            snacks_on_list, includes_all_members, time_zone, created_by
     from public.plan_schedules $$,
  $$ values ('household'::text, '00000000-0000-0000-0000-0000000000f1'::uuid, null::uuid, true, 6, 1, 7, false, true,
             'Europe/Vilnius'::text, '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'it is the household''s, for everyone, with the settings given');
select is(
  (select count(*)::int from public.plan_schedule_participants), 0, 'everyone needs no participant rows');

select is(
  public.save_plan_schedule('household', true, 5, 3, 10, true, 'Europe/London',
    array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid,
          '00000000-0000-0000-0000-000000000002'::uuid, null]),
  (select id from public.plan_schedules),
  'saving again changes the same schedule');
select is((select count(*)::int from public.plan_schedules), 1, 'a household has one schedule');
select results_eq(
  $$ select create_weekday::int, start_weekday::int, day_count::int, snacks_on_list, includes_all_members, time_zone
     from public.plan_schedules $$,
  $$ values (5, 3, 10, true, false, 'Europe/London'::text) $$,
  'every setting is replaced');
select results_eq(
  $$ select user_id from public.plan_schedule_participants order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'the chosen members are kept once each');

select ok(
  public.save_plan_schedule('household', true, 5, 3, 10, true, 'Europe/London',
    array['00000000-0000-0000-0000-000000000003'::uuid]) is not null,
  'Ana chooses only Petras');
select results_eq(
  $$ select user_id from public.plan_schedule_participants $$,
  $$ values ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'the participants are replaced, not added to');

-- The rules a schedule is checked against
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, 'UTC', '{}') $$,
  '22023', 'no_participants', 'a schedule is not for no one');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, 'UTC',
       array['00000000-0000-0000-0000-000000000007'::uuid]) $$,
  'P0001', 'participant_not_member', 'someone from another household cannot take part');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 0, 1, 7, true, 'UTC') $$,
  '22023', 'invalid_weekday', 'a run weekday below Monday is refused');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 8, 7, true, 'UTC') $$,
  '22023', 'invalid_weekday', 'a start weekday after Sunday is refused');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, null, 1, 7, true, 'UTC') $$,
  '22023', 'invalid_weekday', 'a missing weekday is refused');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 0, true, 'UTC') $$,
  '22023', 'invalid_day_count', 'a plan is at least a day');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 15, true, 'UTC') $$,
  '22023', 'invalid_day_count', 'and at most 14 days');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, 'Mars/Olympus') $$,
  '22023', 'invalid_time_zone', 'an unknown time zone is refused');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, null) $$,
  '22023', 'invalid_time_zone', 'a missing time zone is refused');
select throws_ok(
  $$ select public.save_plan_schedule('weekly', true, 6, 1, 7, true, 'UTC') $$,
  '22023', 'invalid_schedule_kind', 'a schedule is individual or household');
select results_eq(
  $$ select create_weekday::int, day_count::int, time_zone from public.plan_schedules $$,
  $$ values (5, 10, 'Europe/London'::text) $$,
  'a refused save changes nothing');

-- Members read the household schedule but only the owner saves it (AC1)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select results_eq(
  $$ select kind, create_weekday::int from public.plan_schedules $$,
  $$ values ('household'::text, 5) $$,
  'Monika reads the household schedule');
select results_eq(
  $$ select user_id from public.plan_schedule_participants $$,
  $$ values ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'and who it is for');
select throws_ok(
  $$ select public.save_plan_schedule('household', false, 6, 1, 7, true, 'UTC') $$,
  'P0001', 'not_owner', 'Monika cannot change it');

-- Individual users have their own schedule (AC2)
select ok(
  public.save_plan_schedule('individual', true, 7, 1, 5, true, 'Europe/Vilnius') is not null,
  'Monika saves her own schedule');
select results_eq(
  $$ select kind, user_id, household_id, day_count::int, includes_all_members
     from public.plan_schedules where kind = 'individual' $$,
  $$ values ('individual'::text, '00000000-0000-0000-0000-000000000002'::uuid, null::uuid, 5, true) $$,
  'it is hers alone, for her');
select is(
  public.save_plan_schedule('individual', false, 7, 1, 5, true, 'Europe/Vilnius'),
  (select id from public.plan_schedules where kind = 'individual'),
  'saving it again changes the same one');
select is(
  (select is_enabled from public.plan_schedules where kind = 'individual'), false, 'she switches it off');
select throws_ok(
  $$ select public.save_plan_schedule('individual', true, 7, 1, 5, true, 'UTC',
       array['00000000-0000-0000-0000-000000000002'::uuid]) $$,
  '22023', 'participants_not_allowed', 'an individual schedule takes no participants');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq(
  $$ select kind from public.plan_schedules $$,
  $$ values ('household'::text) $$,
  'Ana does not see Monika''s own schedule');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select ok(
  public.save_plan_schedule('individual', true, 6, 1, 7, true, 'UTC') is not null,
  'Jonas, with no household, has a schedule of his own');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, 'UTC') $$,
  'P0001', 'not_in_household', 'but no household schedule');
select is((select count(*)::int from public.plan_schedules), 1, 'Jonas sees only his own');

-- Another household sees nothing, and nobody writes the tables directly
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is((select count(*)::int from public.plan_schedules), 0, 'Ola reads no schedule of Home');
select is((select count(*)::int from public.plan_schedule_participants), 0, 'nor its participants');
select throws_ok(
  $$ insert into public.plan_schedules (kind, user_id, time_zone)
     values ('individual', '00000000-0000-0000-0000-000000000007', 'UTC') $$,
  '42501', null, 'a schedule cannot be inserted directly');
select throws_ok(
  $$ update public.plan_schedules set is_enabled = true $$,
  '42501', null, 'nor updated');
select throws_ok(
  $$ delete from public.plan_schedules $$,
  '42501', null, 'nor deleted');
select throws_ok(
  $$ insert into public.plan_schedule_participants (schedule_id, user_id)
     select id, '00000000-0000-0000-0000-000000000007' from public.plan_schedules $$,
  '42501', null, 'participants cannot be written directly');

set local role anon;
select throws_ok(
  $$ select public.save_plan_schedule('individual', true, 6, 1, 7, true, 'UTC') $$,
  '42501', null, 'an anonymous caller cannot save a schedule');
set local role authenticated;

-- A new owner saves it, the old one no longer can
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000002') $$,
  'Ana makes Monika the owner');
select throws_ok(
  $$ select public.save_plan_schedule('household', true, 6, 1, 7, true, 'UTC') $$,
  'P0001', 'not_owner', 'Ana can no longer change the schedule');

-- Departures: the chosen member who leaves is no longer chosen; no one chosen left means everyone
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select ok(
  public.save_plan_schedule('household', true, 6, 1, 7, true, 'UTC',
    array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid]) is not null,
  'Monika, the new owner, chooses Ana and Petras');
select lives_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000003') $$,
  'Monika removes Petras');
select results_eq(
  $$ select user_id from public.plan_schedule_participants $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid) $$,
  'Petras is no longer chosen');
select is(
  (select includes_all_members from public.plan_schedules where kind = 'household'), false,
  'the schedule is still for the ones chosen');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.leave_household() $$, 'Ana leaves');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select includes_all_members, (select count(*)::int from public.plan_schedule_participants)
     from public.plan_schedules where kind = 'household' $$,
  $$ values (true, 0) $$,
  'with no one chosen left the schedule is for everyone again');

-- Deleting the household or the account takes the schedule along
select lives_ok($$ select public.delete_household() $$, 'Monika deletes the household');
select is(
  (select count(*)::int from public.plan_schedules where kind = 'household'), 0,
  'its schedule is gone');

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000004';
select is(
  (select count(*)::int from public.plan_schedules where kind = 'individual'), 1,
  'a deleted account takes its own schedule along, and Monika''s stays');

select * from finish();
rollback;

-- Plan created notifications (H3): who create_plan_created_notifications() tells about a plan, once per person, who
-- reads the notices, and mark_plan_notifications_read().
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(32);

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

create temporary table created (label text primary key, id uuid) on commit drop;
grant all on created to anon, authenticated, service_role;
create function pg_temp.id_of(item_label text) returns uuid language sql stable as $$
  select id from created where label = item_label
$$;
create function pg_temp.read_at_of(target_user_id uuid) returns timestamptz language sql stable as $$
  select read_at from public.notifications
  where user_id = target_user_id and meal_plan_id = pg_temp.id_of('home-plan')
$$;

-- Schedules, saved by their owners as the app does: Home for Ana and Monika only (not Petras), and Jonas's own.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created values ('home', public.save_plan_schedule(
  'household', true, 6, 1, 7, false, 'Europe/Vilnius',
  array['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']::uuid[]));
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into created values ('jonas', public.save_plan_schedule('individual', true, 7, 1, 3, true, 'America/New_York'));

-- The job's plans
set local role service_role;
insert into created
  select 'home-plan', meal_plan_id from public.create_scheduled_meal_plan(pg_temp.id_of('home'), '2026-11-16');
insert into created
  select 'jonas-plan', meal_plan_id from public.create_scheduled_meal_plan(pg_temp.id_of('jonas'), '2026-11-16');
reset role;

-- Shape
select has_table('public', 'notifications', 'notifications exist');
select has_index('public', 'notifications', 'notifications_user_id_unread_idx', 'unread notices are found by person');

-- Only the service role writes notifications
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  format($$ select public.create_plan_created_notifications(%L) $$, pg_temp.id_of('home-plan')),
  '42501', null, 'a signed-in user cannot notify');
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  format($$ select public.create_plan_created_notifications(%L) $$, pg_temp.id_of('home-plan')),
  '42501', null, 'nor can an anonymous caller');

-- A household plan tells every member, not only those it is for (AC1)
set local role service_role;
select is(public.create_plan_created_notifications(pg_temp.id_of('home-plan')), 3, 'three members are told');
select results_eq(
  format($$ select user_id, kind, read_at is null from public.notifications where meal_plan_id = %L order by user_id $$,
         pg_temp.id_of('home-plan')),
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 'plan_created', true),
            ('00000000-0000-0000-0000-000000000002'::uuid, 'plan_created', true),
            ('00000000-0000-0000-0000-000000000003'::uuid, 'plan_created', true) $$,
  'Ana, Monika and Petras, who is not eating from it, each have an unread notice');

-- Once per person and plan
select is(public.create_plan_created_notifications(pg_temp.id_of('home-plan')), 0, 'a second call tells no one');
select is(
  (select count(*)::int from public.notifications where meal_plan_id = pg_temp.id_of('home-plan')),
  3, 'and adds no notices');
reset role;
select throws_ok(
  format($$ insert into public.notifications (user_id, kind, meal_plan_id) values (%L, 'plan_created', %L) $$,
         '00000000-0000-0000-0000-000000000001', pg_temp.id_of('home-plan')),
  '23505', null, 'the unique key refuses a duplicate');
select throws_ok(
  format($$ insert into public.notifications (user_id, kind, meal_plan_id) values (%L, 'plan_deleted', %L) $$,
         '00000000-0000-0000-0000-000000000004', pg_temp.id_of('home-plan')),
  '23514', null, 'and the kind is checked');

-- An individual plan tells its owner
set local role service_role;
select is(public.create_plan_created_notifications(pg_temp.id_of('jonas-plan')), 1, 'Jonas is told about his plan');
select results_eq(
  format($$ select user_id from public.notifications where meal_plan_id = %L $$, pg_temp.id_of('jonas-plan')),
  $$ values ('00000000-0000-0000-0000-000000000004'::uuid) $$,
  'and only Jonas');
select throws_ok(
  $$ select public.create_plan_created_notifications(gen_random_uuid()) $$,
  'P0001', 'plan_not_found', 'an unknown plan');

-- Everyone reads their own notices only
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select user_id, meal_plan_id from public.notifications $$,
  format($$ values ('00000000-0000-0000-0000-000000000002'::uuid, %L::uuid) $$, pg_temp.id_of('home-plan')),
  'Monika reads her notice, not Ana''s or Petras''s');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select results_eq(
  $$ select meal_plan_id from public.notifications $$,
  format($$ values (%L::uuid) $$, pg_temp.id_of('jonas-plan')),
  'Jonas reads his own');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is_empty($$ select * from public.notifications $$, 'another household reads nothing');
set local role anon;
set local request.jwt.claims = '';
select throws_ok($$ select * from public.notifications $$, '42501', null, 'anonymous callers read nothing');

-- No direct writes
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  format($$ insert into public.notifications (user_id, kind, meal_plan_id) values (%L, 'plan_created', %L) $$,
         '00000000-0000-0000-0000-000000000001', pg_temp.id_of('jonas-plan')),
  '42501', null, 'no one adds notices');
select throws_ok(
  $$ update public.notifications set read_at = now() $$, '42501', null, 'nor changes them directly');
select throws_ok($$ delete from public.notifications $$, '42501', null, 'nor deletes them');

-- Marking read
select is(public.mark_plan_notifications_read(pg_temp.id_of('home-plan')), 1, 'Ana marks her notice read');
select is(
  public.mark_plan_notifications_read(pg_temp.id_of('home-plan')), 0, 'marking it again changes nothing');
select is(
  public.mark_plan_notifications_read(pg_temp.id_of('jonas-plan')), 0, 'she cannot mark Jonas''s notice');
reset role;
select isnt(pg_temp.read_at_of('00000000-0000-0000-0000-000000000001'), null, 'her notice is read');
select is(pg_temp.read_at_of('00000000-0000-0000-0000-000000000002'), null, 'Monika''s is still unread');
select is(
  (select read_at from public.notifications where user_id = '00000000-0000-0000-0000-000000000004'),
  null, 'and so is Jonas''s');
set local role service_role;
select is(public.create_plan_created_notifications(pg_temp.id_of('home-plan')), 0, 'notifying again later');
reset role;
select isnt(pg_temp.read_at_of('00000000-0000-0000-0000-000000000001'), null, 'leaves a read notice read');
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  format($$ select public.mark_plan_notifications_read(%L) $$, pg_temp.id_of('home-plan')),
  '42501', null, 'anonymous callers cannot mark notices');
set local role authenticated;
select throws_ok(
  format($$ select public.mark_plan_notifications_read(%L) $$, pg_temp.id_of('home-plan')),
  '28000', 'not_authenticated', 'nor can a session without a user');

-- A member who leaves no longer sees the household's notices
reset role;
delete from public.household_members where user_id = '00000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is_empty($$ select * from public.notifications $$, 'Petras no longer reads the household''s notice');

-- A deleted plan takes its notices along
reset role;
delete from public.meal_plans where id = pg_temp.id_of('home-plan');
select is(
  (select count(*)::int from public.notifications where meal_plan_id = pg_temp.id_of('home-plan')),
  0, 'the plan''s notices are gone');

select * from finish();
rollback;

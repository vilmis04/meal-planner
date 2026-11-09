-- Scheduled plans (H2): create_scheduled_meal_plan() and its one plan per schedule and period, who eats from the plan,
-- and the service role's write_meal_plan_generation() and write_shopping_list_generation() beside the users' own
-- apply_ functions.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);

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

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'H2 test stew', 'dinner', '', 1, '{plant}');

create temporary table created (label text primary key, id uuid) on commit drop;
grant all on created to anon, authenticated, service_role;
create function pg_temp.id_of(item_label text) returns uuid language sql stable as $$
  select id from created where label = item_label
$$;
create function pg_temp.source_version(target_plan_id uuid) returns bigint language sql stable as $$
  select source_version from public.shopping_lists where plan_id = target_plan_id
$$;

-- Schedules, saved by their owners as the app does: Home for Ana and Monika (not Petras), Jonas's own, Other's off.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created values ('home', public.save_plan_schedule(
  'household', true, 6, 1, 7, false, 'Europe/Vilnius',
  array['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']::uuid[]));
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into created values ('jonas', public.save_plan_schedule('individual', true, 7, 1, 3, true, 'America/New_York'));
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
insert into created values ('other', public.save_plan_schedule('household', false, 6, 1, 7, true, 'UTC'));
reset role;

-- Shape
select has_column('public', 'meal_plans', 'schedule_id', 'a plan knows the schedule that made it');
select col_is_null('public', 'meal_plans', 'schedule_id', 'a plan made by hand has none');
select has_index('public', 'meal_plans', 'meal_plans_schedule_id_start_date_key', 'one plan per schedule and start');

-- Only the service role makes scheduled plans and writes without a signed-in user
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  format($$ select * from public.create_scheduled_meal_plan(%L, '2026-11-16') $$, pg_temp.id_of('home')),
  '42501', null, 'a signed-in user cannot make a scheduled plan');
select throws_ok(
  $$ select public.write_meal_plan_generation(gen_random_uuid(), '[]') $$,
  '42501', null, 'nor write a generation without the access check');
select throws_ok(
  $$ select public.write_shopping_list_generation(gen_random_uuid(), 1, '[]') $$,
  '42501', null, 'nor write a shopping list without the access check');
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  format($$ select * from public.create_scheduled_meal_plan(%L, '2026-11-16') $$, pg_temp.id_of('home')),
  '42501', null, 'nor can an anonymous caller');

-- The household schedule's plan (AC1)
set local role service_role;
select results_eq(
  format($$ select is_created from public.create_scheduled_meal_plan(%L, '2026-11-16') $$, pg_temp.id_of('home')),
  $$ values (true) $$,
  'the first run makes the plan');
insert into created
  select 'home-plan', id from public.meal_plans where schedule_id = pg_temp.id_of('home') and start_date = '2026-11-16';
select results_eq(
  $$ select kind, household_id, user_id, created_by, start_date, day_count::int, end_date, include_snacks,
            snacks_on_list, workdays, cooldown_days::int, schedule_id
     from public.meal_plans where id = pg_temp.id_of('home-plan') $$,
  format($$ values ('household', '00000000-0000-0000-0000-0000000000f1'::uuid, null::uuid, null::uuid,
                    '2026-11-16'::date, 7, '2026-11-22'::date, true, false, '{1,2,3,4,5}'::smallint[], 14, %L::uuid) $$,
         pg_temp.id_of('home')),
  'a draft for the household, with the schedule''s length and snacks_on_list and create_meal_plan()''s defaults');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = pg_temp.id_of('home-plan') and recipe_id is null),
  28, 'every slot of every day, empty for the generator');
select results_eq(
  $$ select user_id from public.meal_plan_participants where plan_id = pg_temp.id_of('home-plan') order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'the chosen members eat from it, not Petras');
select results_eq(
  $$ select source_version > generated_version from public.shopping_lists where plan_id = pg_temp.id_of('home-plan') $$,
  $$ values (true) $$,
  'the plan has its shopping list, waiting to be built');

-- Idempotent (AC2)
select results_eq(
  format($$ select meal_plan_id, is_created from public.create_scheduled_meal_plan(%L, '2026-11-16') $$,
         pg_temp.id_of('home')),
  format($$ values (%L::uuid, false) $$, pg_temp.id_of('home-plan')),
  'a second run returns the same plan and makes nothing');
select is(
  (select count(*)::int from public.meal_plans where schedule_id = pg_temp.id_of('home')), 1,
  'there is still one plan for the period');
select is(
  (select count(*)::int from public.meal_plan_slots where plan_id = pg_temp.id_of('home-plan')), 28,
  'and no extra slots');
reset role;
select throws_ok(
  format($$ insert into public.meal_plans (kind, household_id, start_date, day_count, schedule_id)
            values ('household', '00000000-0000-0000-0000-0000000000f1', '2026-11-16', 7, %L) $$,
         pg_temp.id_of('home')),
  '23505', null, 'the database itself refuses a second plan for the schedule and start');
select lives_ok(
  $$ insert into public.meal_plans (kind, household_id, start_date, day_count)
     values ('household', '00000000-0000-0000-0000-0000000000f1', '2026-11-16', 7) $$,
  'plans made by hand for the same days are not affected');

-- A plan already there is left as it is
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e1'
where plan_id = pg_temp.id_of('home-plan') and day_index = 0 and meal_type = 'dinner';
set local role service_role;
select results_eq(
  format($$ select is_created from public.create_scheduled_meal_plan(%L, '2026-11-16') $$, pg_temp.id_of('home')),
  $$ values (false) $$,
  'running again after someone changed the plan');
select is(
  (select recipe_id from public.meal_plan_slots
   where plan_id = pg_temp.id_of('home-plan') and day_index = 0 and meal_type = 'dinner'),
  '00000000-0000-0000-0000-0000000000e1'::uuid,
  'keeps their change');

select results_eq(
  format($$ select is_created from public.create_scheduled_meal_plan(%L, '2026-11-23') $$, pg_temp.id_of('home')),
  $$ values (true) $$,
  'the next period gets its own plan');

-- Everyone, and an individual schedule
reset role;
update public.plan_schedules set includes_all_members = true where id = pg_temp.id_of('home');
delete from public.plan_schedule_participants where schedule_id = pg_temp.id_of('home');
set local role service_role;
insert into created
  select 'everyone-plan', meal_plan_id from public.create_scheduled_meal_plan(pg_temp.id_of('home'), '2026-11-30');
select is(
  (select count(*)::int from public.meal_plan_participants where plan_id = pg_temp.id_of('everyone-plan')), 3,
  'a schedule for everyone plans for every current member');

insert into created
  select 'jonas-plan', meal_plan_id from public.create_scheduled_meal_plan(pg_temp.id_of('jonas'), '2026-11-16');
select results_eq(
  $$ select kind, user_id, household_id, day_count::int, snacks_on_list from public.meal_plans
     where id = pg_temp.id_of('jonas-plan') $$,
  $$ values ('individual', '00000000-0000-0000-0000-000000000004'::uuid, null::uuid, 3, true) $$,
  'an individual schedule makes its owner''s plan');
select results_eq(
  $$ select user_id from public.meal_plan_participants where plan_id = pg_temp.id_of('jonas-plan') $$,
  $$ values ('00000000-0000-0000-0000-000000000004'::uuid) $$,
  'with its owner as the only participant');

-- Refusals
select throws_ok(
  format($$ select * from public.create_scheduled_meal_plan(%L, '2026-11-16') $$, pg_temp.id_of('other')),
  'P0001', 'schedule_disabled', 'a schedule turned off makes nothing');
select is(
  (select count(*)::int from public.meal_plans where household_id = '00000000-0000-0000-0000-0000000000f3'), 0,
  'and the other household has no plan');
select throws_ok(
  $$ select * from public.create_scheduled_meal_plan(gen_random_uuid(), '2026-11-16') $$,
  'P0001', 'schedule_not_found', 'an unknown schedule');
select throws_ok(
  format($$ select * from public.create_scheduled_meal_plan(%L, null) $$, pg_temp.id_of('home')),
  '22023', 'invalid_start_date', 'a start date is needed');

-- Who sees the scheduled plan: as any plan of its owner
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select results_eq(
  format($$ select schedule_id from public.meal_plans where id = %L $$, pg_temp.id_of('home-plan')),
  format($$ values (%L::uuid) $$, pg_temp.id_of('home')),
  'Petras, a member who does not eat from it, sees the household''s plan and that a schedule made it');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plans where schedule_id is not null), 0,
  'Ola, in another household, sees none of them');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from public.meal_plans where id = pg_temp.id_of('jonas-plan')), 0,
  'and Jonas''s plan is his alone');
select throws_ok(
  format($$ update public.meal_plans set schedule_id = null where id = %L $$, pg_temp.id_of('home-plan')),
  '42501', null, 'nobody changes which schedule made a plan');

-- The service role's generation write (E4 for scheduled plans)
set local role service_role;
select is(
  public.write_meal_plan_generation(
    pg_temp.id_of('jonas-plan'),
    '[{"day_index": 0, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e1", "note": null}]'),
  1, 'the service role writes a generated plan without a signed-in user');
select results_eq(
  $$ select recipe_id, is_locked from public.meal_plan_slots
     where plan_id = pg_temp.id_of('jonas-plan') and day_index = 0 and meal_type = 'dinner' $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, false) $$,
  'as a suggestion, unlocked');
select throws_ok(
  format($$ select public.write_meal_plan_generation(%L,
    '[{"day_index": 0, "meal_type": "dinner", "recipe_id": null, "note": null}]') $$, pg_temp.id_of('jonas-plan')),
  'P0001', 'plan_changed', 'the same check against changes made meanwhile');
select throws_ok(
  $$ select public.write_meal_plan_generation(gen_random_uuid(), '[]') $$,
  'P0001', 'plan_not_found', 'an unknown plan');
select throws_ok(
  format($$ select public.write_meal_plan_generation(%L, '[{"day_index": 5, "meal_type": "dinner"}]') $$,
         pg_temp.id_of('jonas-plan')),
  '22023', 'invalid_assignments', 'and the same checks on what is written');

-- The service role's shopping list write (G2 for scheduled plans)
select lives_ok(
  format($$ select public.write_shopping_list_generation(%L, %s, %L) $$,
         pg_temp.id_of('jonas-plan'), pg_temp.source_version(pg_temp.id_of('jonas-plan')),
         '[{"key": "item:Beans|g", "name": "Beans", "category": "fruit_and_vegetables", "amount": 200, "unit": "g"}]'),
  'the service role writes the list without a signed-in user');
select results_eq(
  $$ select lists.generated_version = lists.source_version, items.name
     from public.shopping_lists as lists join public.shopping_items as items on items.list_id = lists.id
     where lists.plan_id = pg_temp.id_of('jonas-plan') $$,
  $$ values (true, 'Beans') $$,
  'the list is up to date with its line');
select throws_ok(
  format($$ select public.write_shopping_list_generation(%L, %s, '[]') $$,
         pg_temp.id_of('jonas-plan'), pg_temp.source_version(pg_temp.id_of('jonas-plan')) - 1),
  'P0001', 'list_changed', 'the same check against an out of date build');
select throws_ok(
  $$ select public.write_shopping_list_generation(gen_random_uuid(), 1, '[]') $$,
  'P0001', 'plan_not_found', 'an unknown plan');

-- The users' apply_ functions behave as before
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  public.apply_meal_plan_generation(
    pg_temp.id_of('home-plan'),
    '[{"day_index": 1, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e1", "note": null}]'),
  1, 'Ana still generates her household''s plan');
select throws_ok(
  format($$ select public.apply_meal_plan_generation(%L, '[]') $$, pg_temp.id_of('jonas-plan')),
  'P0001', 'plan_not_found', 'but not Jonas''s');
select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, 1, '[]') $$, pg_temp.id_of('jonas-plan')),
  'P0001', 'plan_not_found', 'nor write his list');
select lives_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, '[]') $$,
         pg_temp.id_of('home-plan'), pg_temp.source_version(pg_temp.id_of('home-plan'))),
  'she still writes her household''s list');
select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, '[]') $$,
         pg_temp.id_of('home-plan'), pg_temp.source_version(pg_temp.id_of('home-plan')) - 1),
  'P0001', 'list_changed', 'and an out of date build is still refused');
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  format($$ select public.apply_meal_plan_generation(%L, '[]') $$, pg_temp.id_of('home-plan')),
  '42501', null, 'anonymous callers cannot generate');
set local role authenticated;
select throws_ok(
  format($$ select public.apply_meal_plan_generation(%L, '[]') $$, pg_temp.id_of('home-plan')),
  '28000', 'not_authenticated', 'nor can a session without a user');

-- A household that is deleted takes its schedule and its plans along
reset role;
delete from public.households where id = '00000000-0000-0000-0000-0000000000f1';
select is(
  (select count(*)::int from public.meal_plans where id in (pg_temp.id_of('home-plan'), pg_temp.id_of('everyone-plan'))),
  0, 'its scheduled plans are gone');

select * from finish();
rollback;

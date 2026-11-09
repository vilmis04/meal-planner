-- Plan generation (E4): workdays and cooldown on create_meal_plan(), apply_meal_plan_generation(), fill notes, and
-- the service-role-only generator inputs.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(41);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner, vegetarian), Monika (full)     Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}');
update public.profiles set diet = 'vegetarian' where id = '00000000-0000-0000-0000-000000000001';

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member');

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'E4 test stew', 'dinner', '', 2, '{plant}'),
  ('00000000-0000-0000-0000-0000000000e2', 'E4 test salmon', 'dinner', '', 1, '{fish}'),
  ('00000000-0000-0000-0000-0000000000e3', 'E4 test porridge', 'breakfast', '', 1, '{egg_dairy}'),
  ('00000000-0000-0000-0000-0000000000e4', 'E4 test apple', 'snack', '', 1, '{plant}');

insert into public.user_recipe_preferences (user_id, recipe_id, rating) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'enjoy'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2', 'hate'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000e3', 'enjoy_less');

-- Workdays and cooldown when creating a plan
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, service_role;

insert into created_plans values ('defaults', public.create_meal_plan('household', '2026-11-09', 3));
insert into created_plans values
  ('custom', public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, array[7, 1, 1, 6], 0));
-- The plan the generator fills below: a 2-day household plan with snacks skipped.
insert into created_plans values ('target', public.create_meal_plan('household', '2026-11-23', 2, false, true));

create function pg_temp.plan_id(plan_label text) returns uuid language sql stable as $$
  select id from created_plans where label = plan_label
$$;
create function pg_temp.recipe_in(plan_label text, day integer, meal text) returns uuid language sql stable as $$
  select recipe_id from public.meal_plan_slots
  where plan_id = pg_temp.plan_id(plan_label) and day_index = day and meal_type::text = meal
$$;
create function pg_temp.note_in(plan_label text, day integer, meal text) returns text language sql stable as $$
  select fill_note from public.meal_plan_slots
  where plan_id = pg_temp.plan_id(plan_label) and day_index = day and meal_type::text = meal
$$;

select results_eq(
  $$ select workdays, cooldown_days from public.meal_plans where id = pg_temp.plan_id('defaults') $$,
  $$ values ('{1,2,3,4,5}'::smallint[], 14::smallint) $$,
  'a plan made without them works Monday to Friday and rests recipes for 14 days');
select results_eq(
  $$ select workdays, cooldown_days from public.meal_plans where id = pg_temp.plan_id('custom') $$,
  $$ values ('{1,6,7}'::smallint[], 0::smallint) $$,
  'chosen workdays are stored sorted without repeats, and the cooldown can be off');
select ok(
  public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, '{}') is not null,
  'a plan can have no workdays');
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, array[0, 1]) $$,
  '22023', 'invalid_workdays', 'a weekday is 1 to 7');
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, array[1, null]) $$,
  '22023', 'invalid_workdays', 'a weekday cannot be null');
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, null, 61) $$,
  '22023', 'invalid_cooldown_days', 'the cooldown is at most 60 days');
select throws_ok(
  $$ select public.create_meal_plan('individual', '2026-11-16', 2, true, true, null, null, -1) $$,
  '22023', 'invalid_cooldown_days', 'the cooldown cannot be negative');
select throws_ok(
  $$ update public.meal_plans set workdays = '{1}' $$,
  '42501', null, 'workdays cannot be changed directly');
select throws_ok(
  $$ update public.meal_plans set cooldown_days = 1 $$,
  '42501', null, 'the cooldown cannot be changed directly');

-- Writing a generated plan
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  public.apply_meal_plan_generation(pg_temp.plan_id('target'), $$[
    {"day_index": 0, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e1", "note": null},
    {"day_index": 1, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e1", "note": null},
    {"day_index": 0, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e3", "note": "repeated_in_plan"},
    {"day_index": 0, "meal_type": "lunch", "recipe_id": null, "note": "no_recipe_fits_diets"}
  ]$$::jsonb),
  3,
  'Monika writes a generated plan; it returns how many slots got a recipe');
select is(pg_temp.recipe_in('target', 1, 'dinner'), '00000000-0000-0000-0000-0000000000e1'::uuid, 'the slots hold the recipes');
select is(pg_temp.note_in('target', 0, 'breakfast'), 'repeated_in_plan', 'a compromised slot keeps its note');
select is(pg_temp.recipe_in('target', 0, 'lunch'), null, 'an empty slot stays empty');
select is(pg_temp.note_in('target', 0, 'lunch'), 'no_recipe_fits_diets', 'and says why');
select is(pg_temp.note_in('target', 0, 'dinner'), null, 'a slot filled the ideal way has no note');
select is(pg_temp.recipe_in('target', 1, 'breakfast'), null, 'slots that are not named are left alone');

select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e3", "note": null},
    {"day_index": 0, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e2", "note": null}
  ]$j$::jsonb) $$,
  'P0001', 'plan_changed', 'a slot that is no longer empty refuses the whole generation');
select is(pg_temp.recipe_in('target', 1, 'breakfast'), null, 'and nothing of it is written');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "lunch", "recipe_id": "00000000-0000-0000-0000-0000000000e3", "note": null}
  ]$j$::jsonb) $$,
  '22023', 'meal_type_mismatch', 'a breakfast cannot go in a lunch slot');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "lunch", "recipe_id": "00000000-0000-0000-0000-0000000000ff", "note": null}
  ]$j$::jsonb) $$,
  'P0001', 'recipe_not_found', 'an unknown recipe is refused');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 2, "meal_type": "lunch", "recipe_id": null, "note": null}
  ]$j$::jsonb) $$,
  '22023', 'invalid_assignments', 'a day after the plan is refused');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "lunch", "recipe_id": null, "note": null},
    {"day_index": 1, "meal_type": "lunch", "recipe_id": null, "note": null}
  ]$j$::jsonb) $$,
  '22023', 'invalid_assignments', 'a slot named twice is refused');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "brunch", "recipe_id": null, "note": null}
  ]$j$::jsonb) $$,
  '22023', 'invalid_assignments', 'an unknown meal type is refused');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), '{"day_index": 1}'::jsonb) $$,
  '22023', 'invalid_assignments', 'the assignments must be a list');
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), $j$[
    {"day_index": 1, "meal_type": "lunch", "recipe_id": null, "note": "too_tired"}
  ]$j$::jsonb) $$,
  '23514', null, 'only known notes are stored');

-- Choosing a recipe by hand drops the generator's note
select public.set_meal_plan_slot(
  (select id from public.meal_plan_slots where plan_id = pg_temp.plan_id('target') and day_index = 0 and meal_type = 'breakfast'),
  '00000000-0000-0000-0000-0000000000e3');
select is(pg_temp.note_in('target', 0, 'breakfast'), null, 'a slot chosen by hand has no note');

-- Who can write a generated plan
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.apply_meal_plan_generation(pg_temp.plan_id('target'), '[]'::jsonb) $$,
  'P0001', 'plan_not_found', 'Jonas cannot fill another household''s plan');
select throws_ok(
  $$ select public.apply_meal_plan_generation('00000000-0000-0000-0000-0000000000ff', '[]'::jsonb) $$,
  'P0001', 'plan_not_found', 'an unknown plan reads as plan_not_found');
select throws_ok(
  $$ update public.meal_plan_slots set fill_note = null $$,
  '42501', null, 'notes cannot be changed directly');

-- The generator's private inputs are not for signed-in users
select throws_ok(
  $$ select * from public.meal_plan_participant_ratings(pg_temp.plan_id('target')) $$,
  '42501', null, 'a user cannot read the participants'' ratings');
select throws_ok(
  $$ select * from public.meal_plan_recipe_history(pg_temp.plan_id('target'), 28) $$,
  '42501', null, 'a user cannot read the plan history');
select throws_ok(
  $$ select * from public.meal_plan_generation_participants(pg_temp.plan_id('target')) $$,
  '42501', null, 'a user cannot call the participant list for the generator');
reset role;
set local role anon;
select throws_ok(
  $$ select public.apply_meal_plan_generation('00000000-0000-0000-0000-0000000000ff', '[]'::jsonb) $$,
  '42501', null, 'anon cannot write a generated plan');
select throws_ok(
  $$ select * from public.meal_plan_participant_ratings('00000000-0000-0000-0000-0000000000ff') $$,
  '42501', null, 'anon cannot read ratings');

-- The service role reads them for the generator
reset role;
-- History: the household's "defaults" plan (9–11 Nov) and Ana's "custom" plan (16–17 Nov, snacks hidden) get
-- recipes, and so does Jonas's own plan, which no participant eats from.
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e2'
where plan_id = pg_temp.plan_id('defaults') and day_index in (0, 2) and meal_type = 'dinner';
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e4'
where plan_id = pg_temp.plan_id('defaults') and day_index = 1 and meal_type = 'snack';
update public.meal_plans set include_snacks = false where id = pg_temp.plan_id('custom');
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e3'
where plan_id = pg_temp.plan_id('custom') and day_index = 0 and meal_type = 'breakfast';
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e4'
where plan_id = pg_temp.plan_id('custom') and day_index = 1 and meal_type = 'snack';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into created_plans values ('jonas', public.create_meal_plan('individual', '2026-11-20', 1));
reset role;
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e1'
where plan_id = pg_temp.plan_id('jonas') and meal_type = 'dinner';

set local role service_role;
select results_eq(
  $$ select user_id, diet from public.meal_plan_generation_participants(pg_temp.plan_id('target')) $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 'vegetarian'), ('00000000-0000-0000-0000-000000000002'::uuid, 'full') $$,
  'the participants come with their diets');
select results_eq(
  $$ select user_id, recipe_id, rating from public.meal_plan_participant_ratings(pg_temp.plan_id('target')) $$,
  $$ values
    ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 'enjoy'),
    ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-0000000000e2'::uuid, 'hate') $$,
  'every rating of the participants, and no one else''s');
select results_eq(
  $$ select recipe_id, last_planned_on from public.meal_plan_recipe_history(pg_temp.plan_id('target'), 28) $$,
  $$ values ('00000000-0000-0000-0000-0000000000e2'::uuid, '2026-11-11'::date),
            ('00000000-0000-0000-0000-0000000000e3'::uuid, '2026-11-16'::date),
            ('00000000-0000-0000-0000-0000000000e4'::uuid, '2026-11-10'::date) $$,
  'history: the last day each recipe was planned in the participants'' other plans; hidden snacks do not count');
select is(
  (select count(*)::int from public.meal_plan_recipe_history(pg_temp.plan_id('target'), 6)), 0,
  'nothing older than the look-back counts');
select results_eq(
  $$ select recipe_id from public.meal_plan_recipe_history(pg_temp.plan_id('target'), 7) $$,
  $$ values ('00000000-0000-0000-0000-0000000000e3'::uuid) $$,
  'the look-back reaches exactly that many days before the start');
select results_eq(
  $$ select recipe_id, last_planned_on from public.meal_plan_recipe_history(pg_temp.plan_id('custom'), 28) $$,
  $$ values ('00000000-0000-0000-0000-0000000000e2'::uuid, '2026-11-11'::date),
            ('00000000-0000-0000-0000-0000000000e4'::uuid, '2026-11-10'::date) $$,
  'an individual plan sees its owner''s household plans; its own slots and later plans do not count');
select results_eq(
  $$ select recipe_id, last_planned_on from public.meal_plan_recipe_history(pg_temp.plan_id('jonas'), 28) $$,
  $$ values (null::uuid, null::date) limit 0 $$,
  'other people''s plans are not in the history');

reset role;
select * from finish();
rollback;

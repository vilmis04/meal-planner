-- Preference insights (I2): meal_plan_skips, the skips set_meal_plan_slot() and apply_meal_plan_swap() record, and
-- get_preference_insights(): the caller's enjoy-rated recipes by how often they are on the plans they eat from, and the
-- recipes most often skipped on those plans.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member');

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'I2 stew', 'dinner', '', 2, '{plant}'),
  ('00000000-0000-0000-0000-0000000000e2', 'I2 salmon', 'dinner', '', 1, '{fish}'),
  ('00000000-0000-0000-0000-0000000000e3', 'I2 porridge', 'breakfast', '', 1, '{egg_dairy}'),
  ('00000000-0000-0000-0000-0000000000e4', 'I2 pancakes', 'breakfast', '', 1, '{egg_dairy}'),
  ('00000000-0000-0000-0000-0000000000e5', 'I2 yogurt', 'snack', '', 1, '{egg_dairy}'),
  ('00000000-0000-0000-0000-0000000000e6', 'I2 soup', 'dinner', '', 1, '{plant}'),
  ('00000000-0000-0000-0000-0000000000e7', 'I2 chili', 'dinner', '', 2, '{beef}');

select has_table('public', 'meal_plan_skips', 'skips have a table');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.meal_plan_skips'::regclass),
  'skips have row level security');

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated;

create function pg_temp.plan_id(plan_label text) returns uuid language sql stable as $$
  select id from created_plans where label = plan_label
$$;
create function pg_temp.slot_id(plan_label text, day integer, meal text) returns uuid language sql stable as $$
  select id from public.meal_plan_slots
  where plan_id = pg_temp.plan_id(plan_label) and day_index = day and meal_type::text = meal
$$;
create function pg_temp.pick(plan_label text, day integer, meal text, recipe uuid, days integer default 1)
returns void language sql as $$
  select public.set_meal_plan_slot(pg_temp.slot_id(plan_label, day, meal), recipe, days)
$$;
create function pg_temp.skipped(plan_label text) returns table (recipe_id uuid, skip_count bigint)
language sql stable as $$
  select recipe_id, count(*) from public.meal_plan_skips
  where plan_id = pg_temp.plan_id(plan_label) group by recipe_id order by recipe_id
$$;
create function pg_temp.assignment(day integer, meal text, recipe uuid, previous uuid) returns jsonb
language sql immutable as $$
  select jsonb_build_object('day_index', day, 'meal_type', meal, 'recipe_id', recipe, 'note', null,
                            'previous_recipe_id', previous)
$$;
create function pg_temp.recipe(recipe_id text, recipe_name text, meal text, count_key text, total integer)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', recipe_id, 'name', recipe_name, 'meal_type', meal, count_key, total)
$$;

set local role authenticated;

-- Ana's ratings and plans: home (today, with snacks), hidden (today, snacks off), swaps (next week), old (100 days ago).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.user_recipe_preferences (user_id, recipe_id, rating) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 'enjoy'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e3', 'enjoy'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e5', 'enjoy'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'hate');
insert into created_plans values
  ('home', public.create_meal_plan('household', current_date, 3)),
  ('hidden', public.create_meal_plan('household', current_date, 1, false)),
  ('swaps', public.create_meal_plan('household', current_date + 7, 3)),
  ('old', public.create_meal_plan('household', current_date - 100, 2));

-- Filling empty slots skips nothing.
select pg_temp.pick('home', 0, 'dinner', '00000000-0000-0000-0000-0000000000e2');
select pg_temp.pick('home', 1, 'dinner', '00000000-0000-0000-0000-0000000000e2');
select pg_temp.pick('home', 0, 'breakfast', '00000000-0000-0000-0000-0000000000e3');
select pg_temp.pick('home', 0, 'snack', '00000000-0000-0000-0000-0000000000e5');
select pg_temp.pick('hidden', 0, 'snack', '00000000-0000-0000-0000-0000000000e5');
select pg_temp.pick('old', 0, 'dinner', '00000000-0000-0000-0000-0000000000e2');
select pg_temp.pick('old', 0, 'breakfast', '00000000-0000-0000-0000-0000000000e3');
select pg_temp.pick('old', 1, 'breakfast', '00000000-0000-0000-0000-0000000000e4');
select is((select count(*) from public.meal_plan_skips), 0::bigint, 'filling empty slots is not a skip');

-- Replacing by hand
select pg_temp.pick('swaps', 0, 'dinner', '00000000-0000-0000-0000-0000000000e1', 2);
select pg_temp.pick('swaps', 1, 'dinner', '00000000-0000-0000-0000-0000000000e6');
select results_eq(
  $$ select * from pg_temp.skipped('swaps') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, 1::bigint) $$,
  'replacing a recipe by hand records it as skipped');
select is(
  (select skipped_by from public.meal_plan_skips limit 1),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'the skip names who took it out');

select pg_temp.pick('swaps', 0, 'dinner', '00000000-0000-0000-0000-0000000000e7', 2);
select results_eq(
  $$ select * from pg_temp.skipped('swaps') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, 2::bigint), ('00000000-0000-0000-0000-0000000000e6'::uuid, 1::bigint) $$,
  'a batch placed over two recipes skips both');

select pg_temp.pick('swaps', 0, 'dinner', '00000000-0000-0000-0000-0000000000e1', 2);
select results_eq(
  $$ select * from pg_temp.skipped('swaps') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, 2::bigint), ('00000000-0000-0000-0000-0000000000e6'::uuid, 1::bigint),
            ('00000000-0000-0000-0000-0000000000e7'::uuid, 1::bigint) $$,
  'a batch replaced on both its days is skipped once');

select pg_temp.pick('swaps', 0, 'dinner', '00000000-0000-0000-0000-0000000000e1', 2);
select is((select count(*) from public.meal_plan_skips), 4::bigint, 'choosing the same recipe again is not a skip');

select pg_temp.pick('swaps', 0, 'breakfast', '00000000-0000-0000-0000-0000000000e4');
select pg_temp.pick('swaps', 0, 'breakfast', null);
select is(
  (select count(*) from public.meal_plan_skips where recipe_id = '00000000-0000-0000-0000-0000000000e4'),
  1::bigint,
  'clearing a slot skips its recipe');

-- Refused hand picks record nothing.
select throws_ok(
  $$ select pg_temp.pick('swaps', 2, 'dinner', '00000000-0000-0000-0000-0000000000e7', 2) $$,
  'beyond_plan_end',
  'a refused pick is refused as before');

-- The old plan's breakfast is changed too; its skip is moved back 40 days below.
select pg_temp.pick('old', 1, 'breakfast', '00000000-0000-0000-0000-0000000000e3');

-- Swaps (E5)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
-- A recipe chosen by hand is locked, and a locked slot is not swapped (E5).
select public.set_meal_plan_slots_locked(
  array[pg_temp.slot_id('swaps', 0, 'dinner'), pg_temp.slot_id('swaps', 1, 'dinner')], false);
select is(
  public.apply_meal_plan_swap(pg_temp.plan_id('swaps'), jsonb_build_array(
    pg_temp.assignment(0, 'dinner', '00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e1'),
    pg_temp.assignment(1, 'dinner', '00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e1'),
    pg_temp.assignment(0, 'breakfast', '00000000-0000-0000-0000-0000000000e4', null))),
  3,
  'a swap writes the slots and returns how many got a recipe, as apply_meal_plan_generation() does');
select results_eq(
  $$ select skipped_by, count(*) from public.meal_plan_skips
     where plan_id = pg_temp.plan_id('swaps') and recipe_id = '00000000-0000-0000-0000-0000000000e1'
     group by skipped_by order by skipped_by $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 2::bigint), ('00000000-0000-0000-0000-000000000002'::uuid, 1::bigint) $$,
  'a swapped batch is skipped once, by who swapped it; an empty slot it filled is not a skip');
select is((select count(*) from public.meal_plan_skips), 7::bigint, 'the swap recorded one skip');

select throws_ok(
  $$ select public.apply_meal_plan_swap(pg_temp.plan_id('swaps'), jsonb_build_array(
       pg_temp.assignment(0, 'dinner', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1'))) $$,
  'plan_changed',
  'a swap of a slot changed meanwhile is refused');
select is((select count(*) from public.meal_plan_skips), 7::bigint, 'a refused swap records nothing');

-- Monika's own plan, and a household plan Ana does not eat from.
insert into created_plans values
  ('monika', public.create_meal_plan('individual', current_date, 1)),
  ('without_ana', public.create_meal_plan('household', current_date, 1, true, true,
                                          array['00000000-0000-0000-0000-000000000002'::uuid]));
select pg_temp.pick('monika', 0, 'dinner', '00000000-0000-0000-0000-0000000000e1');
select pg_temp.pick('monika', 0, 'dinner', '00000000-0000-0000-0000-0000000000e6');
select pg_temp.pick('without_ana', 0, 'breakfast', '00000000-0000-0000-0000-0000000000e4');
select pg_temp.pick('without_ana', 0, 'breakfast', '00000000-0000-0000-0000-0000000000e3');

-- Jonas: no household, no plans.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.apply_meal_plan_swap(pg_temp.plan_id('swaps'), '[]'::jsonb) $$,
  'plan_not_found',
  'someone else''s plan cannot be swapped');
select is((select count(*) from public.meal_plan_skips), 0::bigint, 'skips are hidden with their plan');
select throws_ok(
  $$ insert into public.meal_plan_skips (plan_id, recipe_id) values (pg_temp.plan_id('swaps'), '00000000-0000-0000-0000-0000000000e1') $$,
  '42501',
  null,
  'skips cannot be written directly');
select is(
  public.get_preference_insights(),
  '{"liked": [], "liked_count": 0, "skipped": [], "skip_count": 0}'::jsonb,
  'someone with no ratings or plans gets empty lists');

set local request.jwt.claims = '';
select throws_ok(
  $$ select public.apply_meal_plan_swap(pg_temp.plan_id('swaps'), '[]'::jsonb) $$,
  'not_authenticated',
  'a swap needs a signed-in user');

-- Moved in time as the migration owner: the old plan's skip 40 days back, the chili's skip an hour back (so it is the
-- least recently skipped), and Ana's porridge rating a day back (so it is the least recently rated).
reset role;
update public.meal_plan_skips set skipped_at = now() - interval '40 days' where plan_id = pg_temp.plan_id('old');
update public.meal_plan_skips set skipped_at = now() - interval '1 hour'
where recipe_id = '00000000-0000-0000-0000-0000000000e7';
-- The trigger would set updated_at to now().
alter table public.user_recipe_preferences disable trigger user_recipe_preferences_set_updated_at;
update public.user_recipe_preferences set updated_at = now() - interval '1 day'
where recipe_id = '00000000-0000-0000-0000-0000000000e3';
alter table public.user_recipe_preferences enable trigger user_recipe_preferences_set_updated_at;
set local role authenticated;

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*) from public.meal_plan_skips), 8::bigint, 'Ana reads the skips of the plans she can open');
select is(
  public.get_preference_insights(null) -> 'liked',
  jsonb_build_array(
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e2', 'I2 salmon', 'dinner', 'planned_count', 3),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e3', 'I2 porridge', 'breakfast', 'planned_count', 3),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e5', 'I2 yogurt', 'snack', 'planned_count', 1)),
  'all time, liked recipes come most planned first, then most recently rated; hidden snacks and plans Ana does not eat from do not count');
select is(
  public.get_preference_insights(30) -> 'liked',
  jsonb_build_array(
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e2', 'I2 salmon', 'dinner', 'planned_count', 2),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e5', 'I2 yogurt', 'snack', 'planned_count', 1),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e3', 'I2 porridge', 'breakfast', 'planned_count', 1)),
  'a range counts the meals dated from its start on');
select is(public.get_preference_insights(30) -> 'liked_count', '3'::jsonb, 'every enjoy rating is counted');
select is(
  public.get_preference_insights() -> 'skipped',
  jsonb_build_array(
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e1', 'I2 stew', 'dinner', 'skip_count', 3),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e4', 'I2 pancakes', 'breakfast', 'skip_count', 2),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e6', 'I2 soup', 'dinner', 'skip_count', 1),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e7', 'I2 chili', 'dinner', 'skip_count', 1)),
  'all time, skipped recipes come most skipped first, then most recently skipped; plans Ana does not eat from do not count');
select is(
  public.get_preference_insights(30) - 'liked' - 'liked_count',
  jsonb_build_object('skipped', jsonb_build_array(
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e1', 'I2 stew', 'dinner', 'skip_count', 3),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e4', 'I2 pancakes', 'breakfast', 'skip_count', 1),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e6', 'I2 soup', 'dinner', 'skip_count', 1),
    pg_temp.recipe('00000000-0000-0000-0000-0000000000e7', 'I2 chili', 'dinner', 'skip_count', 1)), 'skip_count', 6),
  'a range counts the skips made in it');
select throws_ok(
  $$ select public.get_preference_insights(0) $$,
  'invalid_range',
  'a range must be at least a day');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  public.get_preference_insights() - 'skipped',
  '{"liked": [], "liked_count": 0, "skip_count": 9}'::jsonb,
  'Monika sees none of Ana''s ratings, and the skips of every plan she eats from');

select * from finish();
rollback;

-- Plan adjustments (I3): the 'no_recipe_fits_adjustment' fill note apply_meal_plan_generation() may write, and the
-- interpretation cache only the service role can reach.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

-- Fixtures, created as the migration owner.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}');

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'I3 stew', 'dinner', '', 1, '{plant}');

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, service_role;

select has_table('public', 'plan_adjustment_interpretations', 'interpretations have a cache table');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.plan_adjustment_interpretations'::regclass),
  'the cache has row level security');

-- The new note, written through the generation function like any other.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

insert into created_plans values ('mine', public.create_meal_plan('individual', '2026-11-23', 1, false, true));

select lives_ok(
  $$ select public.apply_meal_plan_generation(
       (select id from created_plans where label = 'mine'),
       '[{"day_index": 0, "meal_type": "dinner", "recipe_id": null, "note": "no_recipe_fits_adjustment"},
         {"day_index": 0, "meal_type": "lunch", "recipe_id": null, "note": "no_batch_recipe"}]'::jsonb) $$,
  'a generation can say the adjustment left a slot empty');
select is(
  (select fill_note from public.meal_plan_slots
   where plan_id = (select id from created_plans where label = 'mine') and day_index = 0 and meal_type = 'dinner'),
  'no_recipe_fits_adjustment',
  'the note is stored');
select throws_ok(
  $$ select public.apply_meal_plan_generation(
       (select id from created_plans where label = 'mine'),
       '[{"day_index": 0, "meal_type": "dinner", "recipe_id": null, "note": "made_up_note",
          "previous_recipe_id": null}]'::jsonb) $$,
  '23514', null, 'any other note is still refused');

-- Signed-in users cannot reach the cache at all.
select throws_ok(
  $$ select count(*) from public.plan_adjustment_interpretations $$,
  '42501', null, 'a signed-in user cannot read interpretations');
select throws_ok(
  $$ insert into public.plan_adjustment_interpretations (prompt_hash, model, adjustment)
     values (repeat('a', 64), 'fake', '{}') $$,
  '42501', null, 'a signed-in user cannot write one');

reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.plan_adjustment_interpretations $$,
  '42501', null, 'neither can anyone signed out');

-- The service role (server code) reads and writes it; rows are checked.
reset role;
set local role service_role;
select lives_ok(
  $$ insert into public.plan_adjustment_interpretations (prompt_hash, model, adjustment)
     values (repeat('b', 64), 'fake-model', '{"constraints": {}, "unsupported": []}') $$,
  'the service role caches an interpretation');
select throws_ok(
  $$ insert into public.plan_adjustment_interpretations (prompt_hash, model, adjustment)
     values ('not-a-hash', 'fake-model', '{}') $$,
  '23514', null, 'the key is a hex SHA-256');
select throws_ok(
  $$ insert into public.plan_adjustment_interpretations (prompt_hash, model, adjustment)
     values (repeat('c', 64), 'fake-model', '[]') $$,
  '23514', null, 'the interpretation is an object');

select * from finish();
rollback;

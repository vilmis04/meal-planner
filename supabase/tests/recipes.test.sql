-- Recipes (C2): any signed-in user can read recipes and their ingredients; nobody can write through the API.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

-- Fixtures, created as the migration owner. Ana is signed in and has no household. The ingredients are
-- inserted out of order, because the app sorts them by position.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');

insert into public.recipes (id, name, meal_type, instructions, calories_kcal, portion_days) values
  ('00000000-0000-0000-0000-0000000000c1', 'C2 test curry', 'dinner', 'Cook it.', 500, 2),
  ('00000000-0000-0000-0000-0000000000c2', 'C2 test porridge', 'breakfast', '', 300, 1);
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000000c1', 2, 'Salt', null, null),
  ('00000000-0000-0000-0000-0000000000c1', 1, 'Rice', 80, 'g');

-- Signed in, no household (AC4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.recipes where name like 'C2 test%'),
  2, 'a signed-in user without a household reads recipes');
select results_eq(
  $$ select name, meal_type::text, portion_days, instructions from public.recipes where name = 'C2 test curry' $$,
  $$ values ('C2 test curry'::text, 'dinner'::text, 2::smallint, 'Cook it.'::text) $$,
  'the list and detail columns are readable');
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '00000000-0000-0000-0000-0000000000c1'),
  2, 'a signed-in user reads the ingredients');
select results_eq(
  $$ select item, amount, unit from public.recipe_ingredients
     where recipe_id = '00000000-0000-0000-0000-0000000000c1' order by position $$,
  $$ values ('Rice'::text, 80::numeric, 'g'::text), ('Salt'::text, null::numeric, null::text) $$,
  'ingredients sort by position and a to-taste item has no amount or unit');

-- Nobody writes through the API (recipes are admin-seeded, with the service role)
select throws_ok(
  $$ insert into public.recipes (name, meal_type) values ('C2 test intruder', 'lunch') $$,
  '42501', null, 'a signed-in user cannot add a recipe');
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, item)
     values ('00000000-0000-0000-0000-0000000000c1', 3, 'Intruder') $$,
  '42501', null, 'a signed-in user cannot add an ingredient');
select is_empty(
  $$ update public.recipes set name = 'C2 test renamed'
     where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'a signed-in user cannot rename a recipe');
select is_empty(
  $$ delete from public.recipes where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'a signed-in user cannot delete a recipe');

-- Signed out
reset role;
set local role anon;
select is(
  (select count(*)::int from public.recipes where name like 'C2 test%'),
  0, 'signed-out visitors see no recipes');
select is(
  (select count(*)::int from public.recipe_ingredients),
  0, 'signed-out visitors see no ingredients');

-- Nothing above changed the data
reset role;
select is(
  (select name from public.recipes where id = '00000000-0000-0000-0000-0000000000c1'),
  'C2 test curry', 'the recipe is untouched');
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '00000000-0000-0000-0000-0000000000c1'),
  2, 'the ingredients are untouched');

select * from finish();
rollback;

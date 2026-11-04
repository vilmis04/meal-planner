-- Recipes (C2): any signed-in user can read recipes and their ingredients; nobody can write through the API.
-- Protein metadata (D1): every recipe carries a non-empty list of known proteins, and every seed is tagged.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

-- Fixtures, created as the migration owner. Ana is signed in and has no household. The ingredients are
-- inserted out of order, because the app sorts them by position.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');

insert into public.recipes (id, name, meal_type, instructions, calories_kcal, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000c1', 'C2 test curry', 'dinner', 'Cook it.', 500, 2, '{pork,poultry}'),
  ('00000000-0000-0000-0000-0000000000c2', 'C2 test porridge', 'breakfast', '', 300, 1, '{egg_dairy}');
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
select is(
  (select main_proteins from public.recipes where id = '00000000-0000-0000-0000-0000000000c1'),
  '{pork,poultry}'::text[], 'a signed-in user reads the main proteins (D1)');

-- Nobody writes through the API (recipes are admin-seeded, with the service role)
select throws_ok(
  $$ insert into public.recipes (name, meal_type, main_proteins) values ('C2 test intruder', 'lunch', '{plant}') $$,
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
  $$ update public.recipes set main_proteins = '{plant}'
     where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'a signed-in user cannot retag a recipe (D1)');
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
select is(
  (select main_proteins from public.recipes where id = '00000000-0000-0000-0000-0000000000c1'),
  '{pork,poultry}'::text[], 'the main proteins are untouched');

-- D1: the column only takes a non-empty list from the PROTEINS vocabulary, and must be given
select throws_ok(
  $$ insert into public.recipes (name, meal_type, main_proteins) values ('D1 test lamb', 'dinner', '{lamb}') $$,
  '23514', null, 'an unknown protein is rejected');
select throws_ok(
  $$ insert into public.recipes (name, meal_type, main_proteins) values ('D1 test empty', 'dinner', '{}') $$,
  '23514', null, 'an empty protein list is rejected');
select throws_ok(
  $$ insert into public.recipes (name, meal_type) values ('D1 test untagged', 'dinner') $$,
  '23502', null, 'a recipe cannot be added without main proteins');
select lives_ok(
  $$ insert into public.recipes (name, meal_type, main_proteins) values ('D1 test other meat', 'dinner', '{other_meat}') $$,
  'every protein in the vocabulary is accepted');

-- D1: the seeded recipes, as tagged by the reviewed migration
select is(
  (select count(*)::int from public.recipes where name not like 'C2 test%' and name not like 'D1 test%'),
  123, 'all 123 seeded recipes are present');
select is_empty(
  $$ select name from public.recipes where cardinality(main_proteins) = 0 $$,
  'no seeded recipe is left untagged');
select is_empty(
  $$ select name from public.recipes
     where cardinality(main_proteins) <> (select count(distinct p) from unnest(main_proteins) as p) $$,
  'no recipe lists a protein twice');
select is_empty(
  $$ select name from public.recipes
     where main_proteins && '{fish,poultry,pork,beef,other_meat}'
       and main_proteins && '{egg_dairy,plant}' $$,
  'egg_dairy and plant are only tagged on recipes without meat or fish');
select results_eq(
  $$ select name, main_proteins from public.recipes
     where (name, meal_type) in (('BLT sumuštinis', 'lunch'), ('Lydekos kepsneliai', 'lunch'), ('Tofu karis', 'lunch'),
                                 ('Jautienos čili troškinys', 'lunch'), ('Karšti picos sumuštiniai', 'breakfast'),
                                 ('Plakti kiaušiniai su feta', 'breakfast'))
     order by name $$,
  $$ values ('BLT sumuštinis'::text, '{pork,poultry}'::text[]),
            ('Jautienos čili troškinys', '{beef}'),
            ('Karšti picos sumuštiniai', '{poultry}'),
            ('Lydekos kepsneliai', '{fish}'),
            ('Plakti kiaušiniai su feta', '{egg_dairy}'),
            ('Tofu karis', '{plant}') $$,
  'spot checks: mixed meats, a fish named by species, plant, beef, the either-or ham, egg/dairy');
select results_eq(
  $$ select array_to_string(main_proteins, ','), count(*)::int from public.recipes
     where name not like 'C2 test%' and name not like 'D1 test%'
     group by 1 order by 1 $$,
  $$ values ('beef'::text, 5), ('egg_dairy', 59), ('fish', 24), ('plant', 12), ('pork', 6),
            ('pork,poultry', 1), ('poultry', 16) $$,
  'the seeded recipes split into the reviewed groups');

select * from finish();
rollback;

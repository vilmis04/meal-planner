-- Ingredient canonicalisation (G1): canonical ingredients with a shopping category, an alias for every seeded recipe
-- item, the unmapped-items view behind the report, and who may read and write them.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

-- The tables
select has_table('public', 'ingredients', 'there is an ingredients table');
select has_table('public', 'ingredient_aliases', 'there is an ingredient_aliases table');
select has_view('public', 'unmapped_ingredient_items', 'there is an unmapped_ingredient_items view');
select col_is_unique('public', 'ingredients', 'name', 'a canonical name exists once');
select col_is_pk('public', 'ingredient_aliases', 'item', 'an item maps to one ingredient');
select col_not_null('public', 'ingredient_aliases', 'ingredient_id', 'an alias always names its ingredient');
select col_default_is('public', 'ingredients', 'on_shopping_list', 'true', 'ingredients are shopped by default');

-- The reviewed mapping (AC2)
select is_empty(
  $$ select item from public.recipe_ingredients recipe_ingredient
     where not exists (select 1 from public.ingredient_aliases alias where alias.item = recipe_ingredient.item) $$,
  'every seeded recipe item maps to an ingredient');
select is_empty(
  $$ select item from public.unmapped_ingredient_items $$,
  'the report lists no unmapped item for the seeded recipes');
select is(
  (select count(distinct item)::int from public.recipe_ingredients),
  240, 'the 240 distinct seeded items were reviewed');
select is(
  (select count(*)::int from public.ingredients),
  155, 'they map to 155 canonical ingredients');
select is_empty(
  $$ select name from public.ingredients ingredient
     where not exists (select 1 from public.ingredient_aliases alias
                       where alias.item = ingredient.name and alias.ingredient_id = ingredient.id) $$,
  'every canonical name is an alias of itself');
select results_eq(
  $$ select alias.item, ingredient.name, ingredient.category
     from public.ingredient_aliases alias
     join public.ingredients ingredient on ingredient.id = alias.ingredient_id
     where alias.item in ('Kiaušiniai (M)', 'Grikiai (sausi)', 'Pomidoriukai', 'Fetos arba ožkos sūris',
                          'Šaldytos vyšnios (arba kitos uogos)', 'Druska, pipirai, mėgstami prieskoniai')
     order by alias.item collate "C" $$,
  $$ values
       ('Druska, pipirai, mėgstami prieskoniai'::text, 'Prieskoniai'::text, 'pantry'::text),
       ('Fetos arba ožkos sūris', 'Fetos sūris', 'dairy_and_eggs'),
       ('Grikiai (sausi)', 'Grikiai', 'grains_and_bread'),
       ('Kiaušiniai (M)', 'Kiaušiniai', 'dairy_and_eggs'),
       ('Pomidoriukai', 'Vyšniniai pomidorai', 'fruit_and_vegetables'),
       ('Šaldytos vyšnios (arba kitos uogos)', 'Šaldytos vyšnios', 'frozen') $$,
  'variants, choices and lists map by the documented rules');
select isnt(
  (select alias.ingredient_id from public.ingredient_aliases alias where alias.item = 'Pienas (be laktozės)'),
  (select ingredient.id from public.ingredients ingredient where ingredient.name = 'Pienas'),
  'lactose-free milk is kept apart from milk');
select results_eq(
  $$ select name from public.ingredients where not on_shopping_list $$,
  $$ values ('Vanduo'::text) $$,
  'only tap water is never shopped');
select results_eq(
  $$ select distinct category from public.ingredients order by category $$,
  $$ values ('dairy_and_eggs'::text), ('frozen'), ('fruit_and_vegetables'), ('grains_and_bread'), ('meat_and_fish'),
            ('other'), ('pantry') $$,
  'the seed uses all seven categories');

-- Constraints (as the migration owner)
select throws_ok(
  $$ insert into public.ingredients (name, category) values ('G1 test sweets', 'sweets') $$,
  '23514', null, 'an unknown category is refused');
select throws_ok(
  $$ insert into public.ingredients (name, category) values ('Druska', 'pantry') $$,
  '23505', null, 'a canonical name cannot be added twice');
select throws_ok(
  $$ insert into public.ingredients (name, category) values ('  ', 'other') $$,
  '23514', null, 'a blank canonical name is refused');
select throws_ok(
  $$ insert into public.ingredient_aliases (item, ingredient_id) values ('G1 test orphan', gen_random_uuid()) $$,
  '23503', null, 'an alias must name an existing ingredient');
select throws_ok(
  $$ delete from public.ingredients where name = 'Druska' $$,
  '23503', null, 'an ingredient with aliases cannot be deleted');

-- The unmapped-items view (AC2: the report) picks up recipe items and ready swap items without an alias.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');
insert into public.recipes (id, name, meal_type, main_proteins) values
  ('00000000-0000-0000-0000-0000000000c1', 'G1 test stew', 'dinner', '{beef}');
insert into public.recipe_ingredients (id, recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 1, 'G1 test beef cheeks', 300, 'g'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 2, 'G1 test beef cheeks', 1, 'vnt.'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', 3, 'G1 test smoked salt', null, null),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000c1', 4, 'Druska', null, null);
insert into public.recipe_protein_swaps
  (id, recipe_id, diet, locale, status, source_hash, model, prompt_version, generated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'vegetarian', 'lt', 'ready',
   'h1', 'test', 1, now());
insert into public.recipe_protein_swaps (id, recipe_id, diet, locale, status, claimed_at) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'fish', 'lt', 'pending', now());
insert into public.recipe_protein_swap_items
  (swap_id, recipe_id, recipe_ingredient_id, original_protein, item, amount, unit, replacement_protein)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000e1', 'beef', 'G1 test seitan', 250, 'g', 'plant'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000e2', 'beef', 'Tofu', 200, 'g', 'plant'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000e1', 'beef', 'G1 test pending fish', 250, 'g', 'fish');

select results_eq(
  $$ select source, item, uses, recipes, units from public.unmapped_ingredient_items
     order by source, item collate "C" $$,
  $$ values
       ('protein_swap'::text, 'G1 test seitan'::text, 1, 1, '{g}'::text[]),
       ('recipe', 'G1 test beef cheeks', 2, 1, '{g,vnt.}'),
       ('recipe', 'G1 test smoked salt', 1, 1, '{}') $$,
  'unmapped recipe and ready swap items are listed with their uses and units; mapped and pending ones are not');

insert into public.ingredient_aliases (item, ingredient_id)
select 'G1 test smoked salt', id from public.ingredients where name = 'Druska';
select is_empty(
  $$ select item from public.unmapped_ingredient_items where item = 'G1 test smoked salt' $$,
  'an item leaves the report once it has an alias');

-- Signed in: content is readable, not writable (as recipes)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ingredients),
  155, 'a signed-in user reads the ingredients');
select ok(
  (select count(*)::int from public.ingredient_aliases) > 240, 'a signed-in user reads the aliases');
select results_eq(
  $$ select ingredient.name, ingredient.category
     from public.ingredient_aliases alias
     join public.ingredients ingredient on ingredient.id = alias.ingredient_id
     where alias.item = 'Kiaušiniai (M)' $$,
  $$ values ('Kiaušiniai'::text, 'dairy_and_eggs'::text) $$,
  'a signed-in user resolves an item to its ingredient and category');
select throws_ok(
  $$ insert into public.ingredients (name, category) values ('G1 test intruder', 'other') $$,
  '42501', null, 'a signed-in user cannot add an ingredient');
select throws_ok(
  $$ insert into public.ingredient_aliases (item, ingredient_id)
     select 'G1 test intruder', id from public.ingredients where name = 'Druska' $$,
  '42501', null, 'a signed-in user cannot add an alias');
select is_empty(
  $$ update public.ingredients set category = 'other' where name = 'Druska' returning id $$,
  'a signed-in user cannot recategorise an ingredient');
select is_empty(
  $$ update public.ingredient_aliases set ingredient_id = ingredient_id where item = 'Druska' returning item $$,
  'a signed-in user cannot remap an alias');
select is_empty(
  $$ delete from public.ingredient_aliases where item = 'Kiaušiniai (M)' returning item $$,
  'a signed-in user cannot delete an alias');
select throws_ok(
  $$ select * from public.unmapped_ingredient_items $$,
  '42501', null, 'a signed-in user cannot read the unmapped-items view');

-- Signed out
reset role;
set local role anon;
select is(
  (select count(*)::int from public.ingredients), 0, 'signed-out visitors see no ingredients');
select is(
  (select count(*)::int from public.ingredient_aliases), 0, 'signed-out visitors see no aliases');
select throws_ok(
  $$ select * from public.unmapped_ingredient_items $$,
  '42501', null, 'signed-out visitors cannot read the unmapped-items view');

-- The service role reads the report
reset role;
set local role service_role;
select is(
  (select count(*)::int from public.unmapped_ingredient_items), 2, 'the service role reads the unmapped-items view');

-- Nothing above changed the data
reset role;
select is(
  (select category from public.ingredients where name = 'Druska'), 'pantry', 'Druska is still pantry');
select is(
  (select ingredient.name from public.ingredient_aliases alias
   join public.ingredients ingredient on ingredient.id = alias.ingredient_id
   where alias.item = 'Kiaušiniai (M)'),
  'Kiaušiniai', 'Kiaušiniai (M) still maps to Kiaušiniai');

select * from finish();
rollback;

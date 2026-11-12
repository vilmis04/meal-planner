-- Translatable recipe content (X1b): translation tables for recipes, recipe lines, ingredients and tips, their
-- Lithuanian rows mirroring the source, the English rows for every seed, the missing-translations view behind the
-- report, and who may read and write them.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(41);

-- The tables
select has_table('public', 'recipe_translations', 'there is a recipe_translations table');
select has_table('public', 'recipe_ingredient_translations', 'there is a recipe_ingredient_translations table');
select has_table('public', 'ingredient_translations', 'there is an ingredient_translations table');
select has_table('public', 'tip_translations', 'there is a tip_translations table');
select has_view('public', 'missing_content_translations', 'there is a missing_content_translations view');
select col_is_pk('public', 'recipe_translations', array['recipe_id', 'locale'], 'one recipe row per language');
select col_is_pk('public', 'recipe_ingredient_translations', array['recipe_ingredient_id', 'locale'],
  'one recipe line row per language');
select col_is_pk('public', 'ingredient_translations', array['ingredient_id', 'locale'], 'one ingredient row per language');
select col_is_pk('public', 'tip_translations', array['tip_id', 'locale'], 'one tip row per language');

-- Lithuanian rows: the current content, copied (AC1)
select is_empty(
  $$ select recipe.id from public.recipes recipe
     left join public.recipe_translations translation on translation.recipe_id = recipe.id and translation.locale = 'lt'
     where translation.name is distinct from recipe.name or translation.instructions is distinct from recipe.instructions $$,
  'every recipe has a Lithuanian row with its own name and instructions');
select is_empty(
  $$ select line.id from public.recipe_ingredients line
     left join public.recipe_ingredient_translations translation
       on translation.recipe_ingredient_id = line.id and translation.locale = 'lt'
     where translation.item is distinct from line.item or translation.unit is not null $$,
  'every recipe line has a Lithuanian row with its own item and the shared unit');
select is_empty(
  $$ select ingredient.id from public.ingredients ingredient
     left join public.ingredient_translations translation
       on translation.ingredient_id = ingredient.id and translation.locale = 'lt'
     where translation.name is distinct from ingredient.name $$,
  'every ingredient has a Lithuanian row with its own name');
select is_empty(
  $$ select tip.id from public.tips tip
     left join public.tip_translations translation on translation.tip_id = tip.id and translation.locale = 'lt'
     where translation.tip is distinct from tip.tip $$,
  'every tip has a Lithuanian row with its own text');

-- English rows: every seed is translated (AC2)
select is_empty(
  $$ select kind, source_text, locale from public.missing_content_translations $$,
  'the report lists no missing translation for the seeds');
select is((select count(*)::int from public.recipe_translations where locale = 'en'), 123, 'the 123 recipes are in English');
select is((select count(*)::int from public.recipe_ingredient_translations where locale = 'en'), 829,
  'the 829 recipe lines are in English');
select is((select count(*)::int from public.ingredient_translations where locale = 'en'), 155,
  'the 155 ingredients are in English');
select is((select count(*)::int from public.tip_translations where locale = 'en'), 15, 'the 15 tips are in English');
select is_empty(
  $$ select recipe.name from public.recipes recipe
     join public.recipe_translations translation on translation.recipe_id = recipe.id and translation.locale = 'en'
     where btrim(recipe.instructions) <> '' and btrim(translation.instructions) = '' $$,
  'every recipe with instructions has English instructions');
select results_eq(
  $$ select recipe.meal_type::text, translation.name
     from public.recipes recipe
     join public.recipe_translations translation on translation.recipe_id = recipe.id and translation.locale = 'en'
     where recipe.name in ('Plakti kiaušiniai su feta', 'Jautienos čili troškinys', 'Chia pudingas')
     order by recipe.meal_type, translation.name collate "C" $$,
  $$ values ('breakfast'::text, 'Chia pudding'::text), ('breakfast', 'Scrambled eggs with feta'),
            ('lunch', 'Beef chilli stew'), ('snack', 'Chia pudding') $$,
  'recipes are matched by name and meal type');
select results_eq(
  $$ select item, translated, unit from (
       select distinct line.item, translation.item as translated, translation.unit
       from public.recipe_ingredients line
       join public.recipe_ingredient_translations translation
         on translation.recipe_ingredient_id = line.id and translation.locale = 'en'
       where line.item in ('Kiaušiniai (M)', 'Grūdėta varškė', 'Laimas')
     ) lines
     order by item collate "C" $$,
  $$ values ('Grūdėta varškė'::text, 'Cottage cheese'::text, null::text), ('Kiaušiniai (M)', 'Eggs (M)', null),
            ('Laimas', 'Lime', 'wedge') $$,
  'recipe lines take their English item, and a line the shared unit label would misread its own unit');
select results_eq(
  $$ select ingredient.name, translation.name
     from public.ingredients ingredient
     join public.ingredient_translations translation
       on translation.ingredient_id = ingredient.id and translation.locale = 'en'
     where ingredient.name in ('Pievagrybiai', 'Varškė', 'Cukinija')
     order by ingredient.name collate "C" $$,
  $$ values ('Cukinija'::text, 'Courgette'::text), ('Pievagrybiai', 'Mushrooms'), ('Varškė', 'Quark') $$,
  'canonical ingredients have their English names');

-- Constraints (as the migration owner)
select throws_ok(
  $$ insert into public.recipe_translations (recipe_id, locale, name)
     select id, 'de', 'Rezept' from public.recipes limit 1 $$,
  '23514', null, 'an unknown language is refused');
select throws_ok(
  $$ update public.ingredient_translations set name = 'Mushrooms'
     where locale = 'en' and ingredient_id = (select id from public.ingredients where name = 'Varškė') $$,
  '23505', null, 'two ingredients cannot share an English name');
select throws_ok(
  $$ update public.tip_translations set tip = '  ' where locale = 'en' and tip_id = (select id from public.tips limit 1) $$,
  '23514', null, 'a blank translation is refused');

-- The source stays the Lithuanian original: new content gets its Lithuanian row, and a changed source updates it
insert into public.recipes (id, name, meal_type, instructions, main_proteins) values
  ('00000000-0000-0000-0000-0000000000c1', 'X1b testinis troškinys', 'dinner', 'Troškinti.', '{plant}');
insert into public.recipe_ingredients (id, recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 1, 'Druska', null, null);
insert into public.ingredients (id, name, category) values
  ('00000000-0000-0000-0000-0000000000d1', 'X1b testinis grybas', 'fruit_and_vegetables');
insert into public.tips (id, tip) values ('00000000-0000-0000-0000-0000000000b1', 'X1b testinis patarimas.');

select results_eq(
  $$ select kind, source_text, locale from public.missing_content_translations order by kind, source_text collate "C" $$,
  $$ values ('ingredient'::text, 'X1b testinis grybas'::text, 'en'::text),
            ('recipe', 'X1b testinis troškinys', 'en'),
            ('recipe_ingredient', 'Druska', 'en'),
            ('tip', 'X1b testinis patarimas.', 'en') $$,
  'new content has its Lithuanian rows at once, and the report lists what has no English yet');
update public.recipes set name = 'X1b pervadintas troškinys', instructions = 'Troškinti ilgai.'
where id = '00000000-0000-0000-0000-0000000000c1';
update public.recipe_ingredients set item = 'Pipirai' where id = '00000000-0000-0000-0000-0000000000e1';
update public.ingredients set name = 'X1b pervadintas grybas' where id = '00000000-0000-0000-0000-0000000000d1';
update public.tips set tip = 'X1b pervadintas patarimas.' where id = '00000000-0000-0000-0000-0000000000b1';
select results_eq(
  $$ select name || ' / ' || instructions from public.recipe_translations
     where recipe_id = '00000000-0000-0000-0000-0000000000c1'
     union all select item from public.recipe_ingredient_translations
     where recipe_ingredient_id = '00000000-0000-0000-0000-0000000000e1'
     union all select name from public.ingredient_translations
     where ingredient_id = '00000000-0000-0000-0000-0000000000d1'
     union all select tip from public.tip_translations where tip_id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('X1b pervadintas troškinys / Troškinti ilgai.'::text), ('Pipirai'), ('X1b pervadintas grybas'),
            ('X1b pervadintas patarimas.') $$,
  'a changed source text changes its Lithuanian row');
insert into public.recipe_translations (recipe_id, locale, name, instructions) values
  ('00000000-0000-0000-0000-0000000000c1', 'en', 'X1b test stew', '');
select results_eq(
  $$ select kind, locale from public.missing_content_translations where content_id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('recipe_instructions'::text, 'en'::text) $$,
  'a translation without the instructions the source has is listed as missing them');
delete from public.recipes where id = '00000000-0000-0000-0000-0000000000c1';
select is_empty(
  $$ select 1 from public.recipe_translations where recipe_id = '00000000-0000-0000-0000-0000000000c1'
     union all select 1 from public.recipe_ingredient_translations
     where recipe_ingredient_id = '00000000-0000-0000-0000-0000000000e1' $$,
  'a deleted recipe takes its translations along');

-- Signed in: content is readable, not writable (as recipes)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select translation.locale, translation.name
     from public.recipes recipe
     join public.recipe_translations translation on translation.recipe_id = recipe.id
     where recipe.name = 'Graikiškos salotos' order by translation.locale $$,
  $$ values ('en'::text, 'Greek salad'::text), ('lt', 'Graikiškos salotos') $$,
  'a signed-in user reads a recipe in both languages');
select ok((select count(*) from public.recipe_ingredient_translations) >= 1658, 'a signed-in user reads the recipe lines');
select ok((select count(*) from public.ingredient_translations) >= 310, 'a signed-in user reads the ingredient names');
select ok((select count(*) from public.tip_translations) >= 30, 'a signed-in user reads the tips');
select throws_ok(
  $$ insert into public.recipe_translations (recipe_id, locale, name)
     select id, 'en', 'Intruder' from public.recipes where name = 'Kefyras' $$,
  '42501', null, 'a signed-in user cannot add a recipe translation');
select is_empty(
  $$ update public.ingredient_translations set name = name || '!' where locale = 'en' returning name $$,
  'a signed-in user cannot change an ingredient translation');
select is_empty(
  $$ delete from public.tip_translations returning tip_id $$,
  'a signed-in user cannot delete a tip translation');
select is_empty(
  $$ update public.recipe_ingredient_translations set item = 'Intruder' returning item $$,
  'a signed-in user cannot change a recipe line translation');
select throws_ok(
  $$ select * from public.missing_content_translations $$,
  '42501', null, 'a signed-in user cannot read the missing-translations view');

-- Signed out
reset role;
set local role anon;
select is(
  (select count(*)::int from public.recipe_translations) + (select count(*)::int from public.ingredient_translations),
  0, 'signed-out visitors see no translations');
select throws_ok(
  $$ select * from public.missing_content_translations $$,
  '42501', null, 'signed-out visitors cannot read the missing-translations view');

-- The service role reads the report
reset role;
set local role service_role;
select is(
  (select count(*)::int from public.missing_content_translations), 2,
  'the service role reads the missing-translations view');

select * from finish();
rollback;

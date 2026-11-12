-- Translated protein swaps (X1c): the Lithuanian rows mirror the swap, save_recipe_protein_swap_translation() stores
-- another language only for the swap's current text, a swap saved again loses its old translations, and signed-in
-- users read the translations of ready swaps only.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');

insert into public.recipes (id, name, meal_type, instructions, calories_kcal, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000d1', 'X1c test chili', 'lunch', '', 500, 1, '{beef}'),
  ('00000000-0000-0000-0000-0000000000d2', 'X1c test chicken', 'dinner', '', 400, 1, '{poultry}');
insert into public.recipe_ingredients (id, recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000000d1', 1, 'Jautienos faršas', 120, 'g'),
  ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-0000000000d1', 2, 'Jautienos sultinys', 200, 'ml'),
  ('00000000-0000-0000-0000-0000000002e1', '00000000-0000-0000-0000-0000000000d2', 1, 'Vištienos filė', 120, 'g');

set local role service_role;

select claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h1', 1::smallint);
select save_recipe_protein_swap('{
  "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
  "note": "Kepti 5 min.", "source_hash": "h1", "model": "gemini-test", "prompt_version": 1,
  "items": [
    {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
     "item": "Augalinis faršas", "amount": 120, "unit": "g", "replacement_protein": "plant"},
    {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "original_protein": "beef",
     "item": "Daržovių sultinys", "amount": 200, "unit": "ml", "replacement_protein": "plant"}
  ]
}'::jsonb);

select results_eq(
  $$ select t.locale, t.note from recipe_protein_swap_translations t
     join recipe_protein_swaps s on s.id = t.swap_id where s.diet = 'vegetarian' $$,
  $$ values ('lt'::text, 'Kepti 5 min.'::text) $$,
  'a saved swap has its Lithuanian note row');
select results_eq(
  $$ select locale, item from recipe_protein_swap_item_translations order by item $$,
  $$ values ('lt'::text, 'Augalinis faršas'::text), ('lt'::text, 'Daržovių sultinys'::text) $$,
  'and a Lithuanian row per item');

-- The English translation, for the swap's current text only
select lives_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": "Kepti 5 min.", "note": " Fry for 5 min. ",
       "items": [
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "source_item": "Augalinis faršas",
          "item": "Plant-based mince"},
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "source_item": "Daržovių sultinys",
          "item": "Vegetable stock"}
       ]
     }'::jsonb) $$,
  'the service role saves an English translation');
select results_eq(
  $$ select t.note from recipe_protein_swap_translations t where t.locale = 'en' $$,
  $$ values ('Fry for 5 min.'::text) $$,
  'its note is stored, trimmed');
select results_eq(
  $$ select item from recipe_protein_swap_item_translations where locale = 'en' order by item $$,
  $$ values ('Plant-based mince'::text), ('Vegetable stock'::text) $$,
  'and its items');
select lives_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": "Kepti 5 min.", "note": "Fry for five minutes.",
       "items": [
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "source_item": "Augalinis faršas",
          "item": "Plant mince"},
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "source_item": "Daržovių sultinys",
          "item": "Vegetable stock"}
       ]
     }'::jsonb) $$,
  'saving it again replaces it');
select is(
  (select count(*)::int from recipe_protein_swap_item_translations where locale = 'en'),
  2, 'without leaving the old rows');

select throws_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": "Kepti 5 min.", "note": "Fry.",
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "source_item": "Augalinis faršas",
                  "item": "Plant-based mince"}]
     }'::jsonb) $$,
  'P0001', 'swap_changed', 'a translation must cover every item');
select throws_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": "Kepti 5 min.", "note": "Fry.",
       "items": [
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "source_item": "Tofu", "item": "Tofu"},
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "source_item": "Daržovių sultinys",
          "item": "Vegetable stock"}
       ]
     }'::jsonb) $$,
  'P0001', 'swap_changed', 'a translation of other text is refused');
select throws_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": "Kepti 5 min.", "note": null,
       "items": [
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "source_item": "Augalinis faršas",
          "item": "Plant-based mince"},
         {"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "source_item": "Daržovių sultinys",
          "item": "Vegetable stock"}
       ]
     }'::jsonb) $$,
  'P0001', 'note_mismatch', 'a swap with a note needs a translated note');
select throws_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "lt", "source_note": "Kepti 5 min.", "note": "Kepti.", "items": []
     }'::jsonb) $$,
  'P0001', 'source_locale', 'the Lithuanian rows are only written by the mirror');
select claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d2', 'vegetarian', 'lt', 'h3', 1::smallint);
select throws_ok(
  $$ select save_recipe_protein_swap_translation('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d2", "diet": "vegetarian", "locale": "lt",
       "translation_locale": "en", "source_note": null, "note": null, "items": []
     }'::jsonb) $$,
  'P0001', 'not_ready', 'a swap that is not ready cannot be translated');

-- Signed in: translations of ready swaps only, no writes
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq(
  $$ select locale, note from recipe_protein_swap_translations order by locale $$,
  $$ values ('en'::text, 'Fry for five minutes.'::text), ('lt'::text, 'Kepti 5 min.'::text) $$,
  'a signed-in user reads the translations of ready swaps, not of pending ones');
select is(
  (select count(*)::int from recipe_protein_swap_item_translations),
  4, 'and their item translations');
select throws_ok(
  $$ update recipe_protein_swap_item_translations set item = 'hacked' $$,
  '42501', null, 'a signed-in user cannot change a translation');
select throws_ok(
  $$ select save_recipe_protein_swap_translation('{}'::jsonb) $$,
  '42501', null, 'a signed-in user cannot save a translation');

-- A swap saved again (other ingredients) drops its English, and its Lithuanian rows follow the new text
reset role;
set local role service_role;
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h2', 1::smallint),
  true, 'a swap made from other ingredients is claimed again');
select save_recipe_protein_swap('{
  "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
  "note": null, "source_hash": "h2", "model": "gemini-test", "prompt_version": 1,
  "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
             "item": "Tofu", "amount": 120, "unit": "g", "replacement_protein": "plant"}]
}'::jsonb);
select results_eq(
  $$ select t.locale, t.note from recipe_protein_swap_translations t
     join recipe_protein_swaps s on s.id = t.swap_id
     where s.recipe_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('lt'::text, null::text) $$,
  'the regenerated swap has no English until it is translated again, and its Lithuanian note follows');
select results_eq(
  $$ select locale, item from recipe_protein_swap_item_translations $$,
  $$ values ('lt'::text, 'Tofu'::text) $$,
  'its Lithuanian item rows follow the new items');

-- Deleting the recipe removes the translations with the swap
reset role;
delete from recipes where id = '00000000-0000-0000-0000-0000000000d1';
select is(
  (select count(*)::int from recipe_protein_swap_translations t
   join recipe_protein_swaps s on s.id = t.swap_id),
  1, 'a deleted recipe takes its swap translations with it (the pending chicken swap keeps its row)');

select * from finish();
rollback;

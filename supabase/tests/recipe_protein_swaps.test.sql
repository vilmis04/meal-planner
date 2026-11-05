-- Protein swaps (D2): signed-in users read ready swaps only; only the service role writes them, through
-- claim_recipe_protein_swap() (one winner per pair) and save_recipe_protein_swap() (ready with its items).
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- Fixtures, created as the migration owner: a beef recipe and a chicken recipe, each with two ingredients.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');

insert into public.recipes (id, name, meal_type, instructions, calories_kcal, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000d1', 'D2 test chili', 'lunch', '', 500, 1, '{beef}'),
  ('00000000-0000-0000-0000-0000000000d2', 'D2 test chicken', 'dinner', '', 400, 1, '{poultry}');
insert into public.recipe_ingredients (id, recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000000d1', 1, 'Jautienos faršas', 120, 'g'),
  ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-0000000000d1', 2, 'Pupelės', 80, 'g'),
  ('00000000-0000-0000-0000-0000000002e1', '00000000-0000-0000-0000-0000000000d2', 1, 'Vištienos filė', 120, 'g');

-- The service role claims and saves (it is what the server uses)
set local role service_role;

select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h1', 1::smallint),
  true, 'the first request claims a pair');
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h1', 1::smallint),
  false, 'a second request cannot claim a pair that is being generated');
select is(
  (select status from recipe_protein_swaps where recipe_id = '00000000-0000-0000-0000-0000000000d1'),
  'pending', 'a claimed pair is pending');

select lives_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "note": " Kepti 5 min. ", "calories_kcal": 470, "carbohydrates": 42, "protein": 30, "fat": 14,
       "source_hash": "h1", "model": "gemini-test", "prompt_version": 1,
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
                  "item": "Augalinis faršas", "amount": 120, "unit": "g", "replacement_protein": "plant"}]
     }'::jsonb) $$,
  'the claimer saves the swap with its items');
select results_eq(
  $$ select status, note, calories_kcal, nutrition_approximate, model, claimed_at is null, generated_at is not null
     from recipe_protein_swaps where recipe_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('ready'::text, 'Kepti 5 min.'::text, 470::numeric, true, 'gemini-test'::text, true, true) $$,
  'a saved swap is ready, trimmed, flagged approximate and stamped');
select results_eq(
  $$ select item, amount, unit, replacement_protein from recipe_protein_swap_items $$,
  $$ values ('Augalinis faršas'::text, 120::numeric, 'g'::text, 'plant'::text) $$,
  'its items are stored');

select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h1', 1::smallint),
  false, 'a ready swap made from the same ingredients is not claimed again');
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'fish', 'lt', 'h1', 1::smallint),
  true, 'each diet is its own pair');
select throws_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
       "source_hash": "h1", "model": "m", "prompt_version": 1,
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e2", "original_protein": "beef",
                  "item": "Tofu", "amount": 80, "unit": "g", "replacement_protein": "plant"}]
     }'::jsonb) $$,
  'P0001', 'not_claimed', 'a swap that was not claimed cannot be overwritten');
select throws_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "fish", "locale": "lt",
       "source_hash": "h1", "model": "m", "prompt_version": 1, "items": []
     }'::jsonb) $$,
  'P0001', 'no_items', 'a swap needs at least one item');

-- An item can only point at an ingredient of the same recipe
select throws_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "fish", "locale": "lt",
       "source_hash": "h1", "model": "m", "prompt_version": 1,
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000002e1", "original_protein": "beef",
                  "item": "Menkė", "amount": 120, "unit": "g", "replacement_protein": "fish"}]
     }'::jsonb) $$,
  '23503', null, 'an item pointing at another recipe''s ingredient is rejected');
select throws_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "fish", "locale": "lt",
       "source_hash": "h1", "model": "m", "prompt_version": 1,
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
                  "item": "Menkė", "amount": 120, "unit": null, "replacement_protein": "fish"}]
     }'::jsonb) $$,
  '23514', null, 'an amount without a unit is rejected');
select throws_ok(
  $$ select save_recipe_protein_swap('{
       "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "fish", "locale": "lt",
       "source_hash": "h1", "model": "m", "prompt_version": 1,
       "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
                  "item": "Ėriena", "amount": 120, "unit": "g", "replacement_protein": "lamb"}]
     }'::jsonb) $$,
  '23514', null, 'an unknown protein is rejected');

-- Failures and retries
update recipe_protein_swaps
set status = 'failed', claimed_at = null, attempts = 1, last_error = 'HTTP 503', retry_after = now() + interval '5 minutes'
where recipe_id = '00000000-0000-0000-0000-0000000000d1' and diet = 'fish';
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'fish', 'lt', 'h1', 1::smallint),
  false, 'a failed pair waits for its retry time');
update recipe_protein_swaps set retry_after = now() - interval '1 second'
where recipe_id = '00000000-0000-0000-0000-0000000000d1' and diet = 'fish';
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'fish', 'lt', 'h1', 1::smallint),
  true, 'a failed pair is claimed again after its retry time');
update recipe_protein_swaps set claimed_at = now() - interval '3 minutes'
where recipe_id = '00000000-0000-0000-0000-0000000000d1' and diet = 'fish';
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'fish', 'lt', 'h1', 1::smallint),
  true, 'a claim older than 2 minutes is taken over');

-- Stale and rejected swaps are generated again
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h2', 1::smallint),
  true, 'a ready swap made from other ingredients is claimed again');
update recipe_protein_swaps set status = 'rejected', claimed_at = null
where recipe_id = '00000000-0000-0000-0000-0000000000d1' and diet = 'vegetarian';
select is(
  claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'h1', 1::smallint),
  true, 'a rejected swap is claimed again');

-- Put the vegetarian swap back to ready, and give the chicken recipe a pending claim, for the reads below.
select save_recipe_protein_swap('{
  "recipe_id": "00000000-0000-0000-0000-0000000000d1", "diet": "vegetarian", "locale": "lt",
  "source_hash": "h1", "model": "gemini-test", "prompt_version": 1,
  "items": [{"recipe_ingredient_id": "00000000-0000-0000-0000-0000000001e1", "original_protein": "beef",
             "item": "Augalinis faršas", "amount": 120, "unit": "g", "replacement_protein": "plant"}]
}'::jsonb);
select claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d2', 'vegetarian', 'lt', 'h3', 1::smallint);

-- Table rules
reset role;
select throws_ok(
  $$ insert into recipe_protein_swaps (recipe_id, diet, status, claimed_at)
     values ('00000000-0000-0000-0000-0000000000d1', 'full', 'pending', now()) $$,
  '23514', null, 'the full diet never needs a swap');
select throws_ok(
  $$ insert into recipe_protein_swaps (recipe_id, diet, status, claimed_at)
     values ('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'pending', now()) $$,
  '23505', null, 'one swap per recipe, diet and locale');
select throws_ok(
  $$ insert into recipe_protein_swaps (recipe_id, diet, status)
     values ('00000000-0000-0000-0000-0000000000d2', 'fish', 'ready') $$,
  '23514', null, 'a ready swap must say what it was made from');
select throws_ok(
  $$ insert into recipe_protein_swaps (recipe_id, diet, status, claimed_at, calories_kcal)
     values ('00000000-0000-0000-0000-0000000000d2', 'fish', 'pending', now(), -1) $$,
  '23514', null, 'negative macros are rejected');

-- Signed in: only ready swaps, no writes, no functions
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select r.name, s.diet from recipe_protein_swaps s join recipes r on r.id = s.recipe_id order by 1, 2 $$,
  $$ values ('D2 test chili'::text, 'vegetarian'::text) $$,
  'a signed-in user reads ready swaps only, not pending or failed ones');
select is(
  (select count(*)::int from recipe_protein_swap_items),
  1, 'a signed-in user reads the items of ready swaps');
select throws_ok(
  $$ insert into recipe_protein_swaps (recipe_id, diet, status, claimed_at)
     values ('00000000-0000-0000-0000-0000000000d2', 'fish', 'pending', now()) $$,
  '42501', null, 'a signed-in user cannot add a swap');
select throws_ok(
  $$ update recipe_protein_swaps set note = 'hacked' $$,
  '42501', null, 'a signed-in user cannot change a swap');
select throws_ok(
  $$ delete from recipe_protein_swap_items $$,
  '42501', null, 'a signed-in user cannot delete swap items');
select throws_ok(
  $$ select claim_recipe_protein_swap('00000000-0000-0000-0000-0000000000d2', 'fish', 'lt', 'h', 1::smallint) $$,
  '42501', null, 'a signed-in user cannot claim a pair (no AI calls on their own)');
select throws_ok(
  $$ select save_recipe_protein_swap('{}'::jsonb) $$,
  '42501', null, 'a signed-in user cannot save a swap');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from recipe_protein_swaps $$,
  '42501', null, 'signed-out visitors cannot read swaps');

-- Deleting a recipe removes its swaps
reset role;
delete from recipes where id = '00000000-0000-0000-0000-0000000000d1';
select is(
  (select count(*)::int from recipe_protein_swaps where recipe_id = '00000000-0000-0000-0000-0000000000d1'),
  0, 'a deleted recipe takes its swaps with it');

select * from finish();
rollback;

-- Tips in context (X3): the tip tags of canonical ingredients, the 'plan' context tag, the reviewed matches, and that
-- signed-in users read them while only the service role writes them.
-- Run with `npm run test:db` (see README, "Testing and CI").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

-- The column
select has_column('public', 'ingredients', 'tip_tags', 'ingredients have tip tags');
select col_not_null('public', 'ingredients', 'tip_tags', 'tip tags are never null');
select col_default_is('public', 'ingredients', 'tip_tags', '{}', 'an ingredient has no tip tags by default');
select has_index('public', 'ingredients', 'ingredients_tip_tags_idx', 'tip tags are indexed for overlap queries');

-- The reviewed matches
select is(
  (select count(*)::int from public.ingredients where tip_tags <> '{}'), 31,
  'the 31 reviewed ingredients have tip tags');
select is(
  (select count(*)::int from public.tips where 'plan' = any (tags)), 5,
  'five tips are shown on the plan page');
select is(
  (select count(*)::int from public.tips where 'plan' = any (tags) and 'family' = any (tags)), 1,
  'one plan tip is for plans with several people');
select is_empty(
  $$ select tip.tip from public.tips tip
     where not ('plan' = any (tip.tags))
       and not exists (select 1 from public.ingredients ingredient where ingredient.tip_tags && tip.tags) $$,
  'every tip is shown somewhere');
select is_empty(
  $$ select ingredient.name from public.ingredients ingredient
     where ingredient.tip_tags <> '{}'
       and not exists (select 1 from public.tips tip where tip.tags && ingredient.tip_tags) $$,
  'every tip tag of an ingredient matches a tip');
select is_empty(
  $$ select ingredient.name, tag from public.ingredients ingredient, unnest(ingredient.tip_tags) tag
     where tag !~ '^[a-z]+(_[a-z]+)*$' $$,
  'tip tags are lower-case words joined by underscores, as the tips'' tags');
select results_eq(
  $$ select tip_translation.tip
     from public.ingredients ingredient
     join public.tips tip on tip.tags && ingredient.tip_tags
     join public.tip_translations tip_translation on tip_translation.tip_id = tip.id and tip_translation.locale = 'en'
     where ingredient.name = 'Avokadas'
     order by tip_translation.tip collate "C" $$,
  $$ select tip_translation.tip from public.tip_translations tip_translation
     join public.tips tip on tip.id = tip_translation.tip_id
     where tip_translation.locale = 'en' and (tip.tags @> array['avocado'] or tip.tags @> array['alternatives'])
     order by tip_translation.tip collate "C" $$,
  'an avocado shows how to keep half an avocado and what replaces it');
select ok(
  (select count(distinct tip.id) from public.recipes recipe
   join public.recipe_ingredients line on line.recipe_id = recipe.id
   join public.ingredient_aliases alias on alias.item = line.item
   join public.ingredients ingredient on ingredient.id = alias.ingredient_id
   join public.tips tip on tip.tags && ingredient.tip_tags) = 10,
  'recipe lines reach every ingredient tip through their aliases');
select is(
  (select count(*)::int from public.tips where cardinality(tags) <> cardinality(array(select distinct unnest(tags)))),
  0, 'no tip has a tag twice');

-- Re-runnable: running the migration again leaves the same tags.
create temporary table tags_before as
  select 'tip' as kind, id, tags from public.tips
  union all select 'ingredient', id, tip_tags from public.ingredients;
set local client_min_messages = warning;
\ir ../migrations/20261127000000_add_tip_matching.sql
select set_eq(
  $$ select 'tip' as kind, id, tags from public.tips union all select 'ingredient', id, tip_tags from public.ingredients $$,
  $$ select kind, id, tags from tags_before $$,
  'running the migration again changes no tags');

-- Signed in: read, never write
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select count(*)::int from public.ingredients where tip_tags <> '{}'), 31,
  'a signed-in user reads the tip tags');
select is_empty(
  $$ update public.ingredients set tip_tags = array['intruder'] returning id $$,
  'a signed-in user cannot change tip tags');
select is_empty(
  $$ update public.tips set tags = array['intruder'] returning id $$,
  'a signed-in user cannot change a tip''s tags');

-- Signed out
reset role;
set local role anon;
select is(
  (select count(*)::int from public.tips) + (select count(*)::int from public.ingredients), 0,
  'signed-out visitors see no tips or ingredients');

select * from finish();
rollback;

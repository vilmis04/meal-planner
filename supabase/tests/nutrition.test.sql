-- Nutrition on request (F1): the "Show nutrition" setting on the profile, and the macros the revealed view reads
-- (recipes and ready protein swaps).
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Fixtures, created as the migration owner. Ana and Monika share a household; Jonas is outside it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-00000000000c', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b');

-- A complete chicken recipe with a ready vegetarian swap, a snack with calories and protein only (like the seeded
-- "Lęšių trapukai"), and a pending swap that must stay unreadable.
insert into public.recipes (id, name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000d1', 'F1 test curry', 'dinner', '', 690, 64, 46, 26, 1, '{poultry}'),
  ('00000000-0000-0000-0000-0000000000d2', 'F1 test crackers', 'snack', '', 235, null, 14.7, null, 1, '{plant}');
insert into public.recipe_protein_swaps
  (recipe_id, diet, locale, status, calories_kcal, carbohydrates, protein, fat, source_hash, model, prompt_version, generated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', 'vegetarian', 'lt', 'ready', 640, 70, 32, 24, 'h1', 'test', 1, now());
insert into public.recipe_protein_swaps (recipe_id, diet, locale, status, claimed_at, calories_kcal) values
  ('00000000-0000-0000-0000-0000000000d1', 'fish', 'lt', 'pending', now(), 700);

-- The column
select has_column('public', 'profiles', 'show_nutrition', 'profiles have a show_nutrition column');
select col_not_null('public', 'profiles', 'show_nutrition', 'show_nutrition is never null');
select is(
  (select bool_and(not show_nutrition) from public.profiles
    where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')),
  true, 'nutrition is hidden by default for every new profile');
select lives_ok(
  $$ alter table public.profiles add column if not exists show_nutrition boolean not null default false;
     grant update (show_nutrition) on public.profiles to authenticated $$,
  'the migration can run again');

-- Ana: her own setting
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ update public.profiles set show_nutrition = true where id = '00000000-0000-0000-0000-00000000000a' $$,
  'I can turn nutrition on');
select is(
  (select show_nutrition from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  true, 'my setting is remembered');
select throws_ok(
  $$ update public.profiles set show_nutrition = null where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23502', null, 'the setting cannot be cleared to null');
select lives_ok(
  $$ update public.profiles set show_nutrition = false where id = '00000000-0000-0000-0000-00000000000a' $$,
  'I can turn nutrition off again');
select is_empty(
  $$ update public.profiles set show_nutrition = true where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'I cannot change a household member''s setting');
select is(
  (select show_nutrition from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  false, 'a household member''s setting stays as they left it');

-- The macros the revealed view reads
select results_eq(
  $$ select calories_kcal, carbohydrates, protein, fat from public.recipes
     where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2') order by name $$,
  $$ values (235::numeric, null::numeric, 14.7::numeric, null::numeric), (690, 64, 46, 26) $$,
  'I can read every recipe''s macros, missing ones as null');
select results_eq(
  $$ select diet, calories_kcal, carbohydrates, protein, fat from public.recipe_protein_swaps
     where recipe_id = '00000000-0000-0000-0000-0000000000d1' and status = 'ready' and locale = 'lt'
       and diet in ('vegetarian', 'fish') $$,
  $$ values ('vegetarian'::text, 640::numeric, 70::numeric, 32::numeric, 24::numeric) $$,
  'I can read the estimate of a ready swap');
select is(
  (select count(*)::int from public.recipe_protein_swaps where diet = 'fish'),
  0, 'a swap that is not ready stays hidden, so its estimate is never shown');
select is_empty(
  $$ update public.recipes set calories_kcal = 1 where id = '00000000-0000-0000-0000-0000000000d1' returning id $$,
  'I cannot change a recipe''s macros');

-- Jonas is outside the household
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is_empty(
  $$ update public.profiles set show_nutrition = true where id = '00000000-0000-0000-0000-00000000000a' returning id $$,
  'an outsider cannot change someone else''s setting');
select lives_ok(
  $$ update public.profiles set show_nutrition = true where id = '00000000-0000-0000-0000-00000000000c' $$,
  'an outsider sets their own');

reset role;
select results_eq(
  $$ select id::text, show_nutrition from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_' order by id $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::text, false), ('00000000-0000-0000-0000-00000000000b', false),
            ('00000000-0000-0000-0000-00000000000c', true) $$,
  'each user''s setting is their own');

select * from finish();
rollback;

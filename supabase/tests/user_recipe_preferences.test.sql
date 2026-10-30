-- Meal preferences (C3): a rating belongs to its owner alone, whoever else shares the household.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

-- Fixtures, created as the migration owner. Ana and Monika share a household; Jonas is outside it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-00000000000c', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b');

insert into public.recipes (id, name, meal_type) values
  ('00000000-0000-0000-0000-0000000000c1', 'C3 test curry', 'dinner'),
  ('00000000-0000-0000-0000-0000000000c2', 'C3 test porridge', 'breakfast'),
  ('00000000-0000-0000-0000-0000000000c3', 'C3 test stew', 'dinner');

-- Monika already rated one recipe; Ana, her household member, must never see it.
insert into public.user_recipe_preferences (user_id, recipe_id, rating) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', 'hate');

-- Ana, the owner (AC1, AC3)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'enjoy') $$,
  'a user rates a recipe enjoy');
select lives_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'enjoy_less') $$,
  'a user rates a recipe enjoy less');
select lives_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c3', 'hate') $$,
  'a user rates a recipe hate');
select results_eq(
  $$ select recipe_id::text, rating from public.user_recipe_preferences order by recipe_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::text, 'enjoy'::text),
            ('00000000-0000-0000-0000-0000000000c2', 'enjoy_less'),
            ('00000000-0000-0000-0000-0000000000c3', 'hate') $$,
  'a user reads exactly their own ratings, not their household member''s');

-- The app saves with an upsert, so changing a rating goes through insert ... on conflict
select lives_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'hate')
     on conflict (user_id, recipe_id) do update set rating = excluded.rating $$,
  'a user changes a rating with an upsert');
select is(
  (select rating from public.user_recipe_preferences where recipe_id = '00000000-0000-0000-0000-0000000000c1'),
  'hate', 'the upsert changed the rating instead of adding a second row');
select is(
  (select count(*)::int from public.user_recipe_preferences),
  3, 'a user has one row per recipe');

-- Constraints
select throws_ok(
  $$ update public.user_recipe_preferences set rating = 'love'
     where recipe_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', null, 'a value outside enjoy, enjoy less and hate is rejected');
select throws_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'enjoy') $$,
  '23505', null, 'a recipe cannot be rated twice by one user');
select throws_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ff', 'enjoy') $$,
  '23503', null, 'a recipe that does not exist cannot be rated');

-- Ana cannot act as anyone else (AC4)
select throws_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000c1', 'hate') $$,
  '42501', null, 'a user cannot rate a recipe for someone else');
select throws_ok(
  $$ update public.user_recipe_preferences set user_id = '00000000-0000-0000-0000-00000000000c'
     where recipe_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', null, 'a rating cannot be handed to another user');
select throws_ok(
  $$ update public.user_recipe_preferences set recipe_id = '00000000-0000-0000-0000-0000000000c3'
     where recipe_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501', null, 'a rating cannot be moved to another recipe');
select is_empty(
  $$ update public.user_recipe_preferences set rating = 'enjoy'
     where user_id = '00000000-0000-0000-0000-00000000000b' returning user_id $$,
  'a user cannot change their household member''s rating');
select is_empty(
  $$ delete from public.user_recipe_preferences
     where user_id = '00000000-0000-0000-0000-00000000000b' returning user_id $$,
  'a user cannot clear their household member''s rating');

-- Clearing (AC3)
select lives_ok(
  $$ delete from public.user_recipe_preferences where recipe_id = '00000000-0000-0000-0000-0000000000c3' $$,
  'a user clears their own rating');
select is(
  (select count(*)::int from public.user_recipe_preferences),
  2, 'the cleared recipe is unrated again');

-- Jonas, outside the household (AC4)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.user_recipe_preferences $$,
  'a user outside the household reads no ratings');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select 1 from public.user_recipe_preferences $$,
  '42501', null, 'signed out, the table cannot be read');
select throws_ok(
  $$ insert into public.user_recipe_preferences (user_id, recipe_id, rating)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'enjoy') $$,
  '42501', null, 'signed out, nothing can be rated');

-- Cascades, as the migration owner
reset role;
delete from public.recipes where id = '00000000-0000-0000-0000-0000000000c2';
select is(
  (select count(*)::int from public.user_recipe_preferences where recipe_id = '00000000-0000-0000-0000-0000000000c2'),
  0, 'deleting a recipe removes its ratings');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.user_recipe_preferences where user_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'deleting a user removes their ratings');
select is(
  (select count(*)::int from public.user_recipe_preferences where user_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'other users keep theirs');

-- updated_at moves on a change
select isnt(
  (select updated_at from public.user_recipe_preferences where user_id = '00000000-0000-0000-0000-00000000000b'),
  null, 'a rating records when it was last changed');

select * from finish();
rollback;

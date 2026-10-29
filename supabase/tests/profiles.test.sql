-- Profiles (A3): sign-up trigger, constraints and row level security.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

-- Fixtures, created as the migration owner. Ana and Monika share a household; Jonas is outside it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana.b@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000b', 'monika@example.com', '{"full_name": "  Monika Petraitė  "}'),
  ('00000000-0000-0000-0000-00000000000c', 'jonas@example.com', '{"name": "Jonas"}'),
  ('00000000-0000-0000-0000-00000000000d', null, '{"full_name": "Aleksandras Vytautas Kazimieras Jonaitis-Petrauskas Junior"}'),
  ('00000000-0000-0000-0000-00000000000e', null, '{}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b');

-- Sign-up trigger (T1, T2)
select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_'),
  5, 'every new auth user gets exactly one profile');
select results_eq(
  $$ select display_name, locale, theme, diet from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('ana.b'::text, null::text, 'system'::text, 'full'::text) $$,
  'email sign-up: name from the email, no locale yet, system theme, full diet (C1)');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Monika Petraitė', 'Google full_name is used, trimmed');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'Jonas', 'Google name is used when full_name is missing');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  'Aleksandras Vytautas Kazimieras Jonaitis-Petrauska', 'long names are cut to 50 characters');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  'User', 'a user with no name and no email still gets a valid profile');

-- Constraints (T5)
select throws_ok(
  $$ update public.profiles set theme = 'blue' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'unknown theme is rejected');
select throws_ok(
  $$ update public.profiles set locale = 'de' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'unsupported locale is rejected');
select throws_ok(
  $$ update public.profiles set display_name = '' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'empty name is rejected');
select throws_ok(
  $$ update public.profiles set display_name = ' Ana' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'untrimmed name is rejected');
select throws_ok(
  $$ update public.profiles set display_name = repeat('a', 51) where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '51-character name is rejected');
select throws_ok(
  $$ update public.profiles set diet = 'keto' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'a diet outside the ladder is rejected (C1)');
select throws_ok(
  $$ update public.profiles set diet = null where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23502', null, 'a profile always has a diet (C1)');

-- Ana: her own row (T3, T4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'ana.b', 'I can read my profile');
select lives_ok(
  $$ update public.profiles set display_name = 'Ana', locale = 'lt', theme = 'dark'
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  'I can update my name, language and theme');
select results_eq(
  $$ select display_name, locale, theme from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('Ana'::text, 'lt'::text, 'dark'::text) $$,
  'my update is stored');
select lives_ok(
  $$ do $do$
     declare
       chosen text;
     begin
       foreach chosen in array array['vegetarian', 'fish', 'poultry', 'pork', 'beef', 'full'] loop
         update public.profiles set diet = chosen where id = '00000000-0000-0000-0000-00000000000a';
       end loop;
       update public.profiles set diet = 'fish' where id = '00000000-0000-0000-0000-00000000000a';
     end
     $do$ $$,
  'I can set each of the six diets (C1)');
select is(
  (select diet from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'fish', 'my diet is stored (C1)');
select throws_ok(
  $$ update public.profiles set id = '00000000-0000-0000-0000-0000000000aa' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'I cannot change my profile id');
select throws_ok(
  $$ update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'I cannot change timestamps');
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-0000000000aa', 'Fake') $$,
  '42501', null, 'I cannot insert profiles');
select throws_ok(
  $$ select public.default_display_name('{}', 'x@example.com') $$,
  '42501', null, 'the sign-up helper is not callable through the API');

-- Ana and Monika share a household (T11)
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Monika Petraitė', 'I can read the name of someone in my household');
select is_empty(
  $$ update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'I cannot update a household member''s profile');
select is(
  (select diet from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'full', 'I can read the diet of someone in my household (C1)');
select is_empty(
  $$ update public.profiles set diet = 'vegetarian' where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'I cannot change a household member''s diet (C1)');
select is(
  (select count(*)::int from public.household_members), 2, 'I can read my household''s members');
select is(
  (select name from public.households), 'Home', 'I can read my household');
select throws_ok(
  $$ insert into public.households (name) values ('Second home') $$,
  '42501', null, 'households cannot be inserted directly (create_household is the only way)');

-- Jonas is outside the household (T4, T12)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles), 1, 'an outsider sees only their own profile');
select is_empty(
  $$ update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a' returning id $$,
  'an outsider cannot update someone else''s profile');
select is_empty(
  $$ update public.profiles set diet = 'vegetarian' where id = '00000000-0000-0000-0000-00000000000a' returning id $$,
  'an outsider cannot change someone else''s diet (C1)');
select is_empty($$ select id from public.households $$, 'an outsider cannot read the household');
select is_empty($$ select user_id from public.household_members $$, 'an outsider cannot read its members');

-- Signed out
reset role;
set local role anon;
select is_empty($$ select id from public.profiles $$, 'signed-out visitors cannot read profiles');

-- Cascade (T5)
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000e';
select is_empty(
  $$ select id from public.profiles where id = '00000000-0000-0000-0000-00000000000e' $$,
  'deleting the auth user deletes the profile');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Ana', 'other profiles are untouched');

select * from finish();
rollback;

-- Households (B1): creating a household, the one-household rule and the write paths.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

-- Fixtures, created as the migration owner. Ana and Monika already share a household;
-- Jonas and Dana have none.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-00000000000c', 'jonas@example.com', '{"full_name": "Jonas"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dana@example.com', '{"full_name": "Dana"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 'member');

-- Name constraint (AC1), checked as the migration owner
select throws_ok(
  $$ insert into public.households (name) values ('') $$,
  '23514', null, 'an empty household name is rejected');
select throws_ok(
  $$ insert into public.households (name) values (' Flat') $$,
  '23514', null, 'an untrimmed household name is rejected');
select throws_ok(
  $$ insert into public.households (name) values (repeat('a', 51)) $$,
  '23514', null, 'a 51-character household name is rejected');

-- Jonas creates a household (AC1, AC2)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select isnt(
  public.create_household('  Tiny Home  '), null, 'creating a household returns its id');
select is(
  (select name from public.households), 'Tiny Home', 'the name is stored trimmed');
select is(
  (select count(*)::int from public.household_members where user_id = '00000000-0000-0000-0000-00000000000c'),
  1, 'I am a member of the household I created');
select is(
  (select count(*)::int from public.household_members), 1, 'I am its only member');
select is(
  (select role from public.household_members), 'owner', 'the creator of a household owns it (B3)');
select results_eq(
  $$ select profiles.display_name from public.household_members
     join public.profiles on profiles.id = household_members.user_id $$,
  $$ values ('Jonas'::text) $$,
  'member names can be read through the profiles foreign key');

-- A second household is blocked (AC3)
select throws_ok(
  $$ select public.create_household('Second home') $$,
  '23505', 'already_in_household', 'I cannot create a second household');
select is(
  (select count(*)::int from public.households), 1, 'I still see exactly one household');

-- Ana already belongs to "Home" (AC3)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$ select public.create_household('Another') $$,
  '23505', 'already_in_household', 'a member of another household cannot create one');
select is(
  (select name from public.households), 'Home', 'Ana still sees only her household, not Jonas''s');
select is(
  (select count(*)::int from public.household_members), 2, 'Ana still sees only her own household''s members');

-- The failed attempts left nothing behind (checked as the migration owner)
reset role;
select is_empty(
  $$ select id from public.households where name in ('Second home', 'Another') $$,
  'a refused create leaves no orphan household');

-- Dana: names are validated by the function (AC1)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

select throws_ok(
  $$ select public.create_household('') $$,
  '22023', 'invalid_household_name', 'an empty name is refused');
select throws_ok(
  $$ select public.create_household('    ') $$,
  '22023', 'invalid_household_name', 'a whitespace-only name is refused');
select throws_ok(
  $$ select public.create_household(repeat('a', 51)) $$,
  '22023', 'invalid_household_name', 'a 51-character name is refused');
select throws_ok(
  $$ select public.create_household(null) $$,
  '22023', 'invalid_household_name', 'a missing name is refused');
select is_empty(
  $$ select user_id from public.household_members $$,
  'refused names leave me without a household');
select lives_ok(
  $$ select public.create_household(repeat('a', 50)) $$,
  'a 50-character name is accepted');

-- No direct write path (the function is the only way in)
select throws_ok(
  $$ insert into public.households (name) values ('Sneaky') $$,
  '42501', null, 'I cannot insert a household directly');
select throws_ok(
  $$ insert into public.household_members (household_id, user_id)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'I cannot add myself to someone else''s household');

-- Signed in without a user id, and signed out
set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok(
  $$ select public.create_household('Ghost') $$,
  '28000', 'not_authenticated', 'a request with no user id is refused');

reset role;
set local role anon;
select throws_ok(
  $$ select public.create_household('Anon home') $$,
  '42501', null, 'signed-out visitors cannot call the function');

-- Cascade: deleting the auth user removes the membership, not the household
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select is_empty(
  $$ select user_id from public.household_members where user_id = '00000000-0000-0000-0000-00000000000c' $$,
  'deleting the auth user deletes the membership');

select * from finish();
rollback;

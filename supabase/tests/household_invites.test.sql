-- Household invites (B2): creating, revoking, previewing and accepting invite links.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(65);

-- Fixtures, created as the migration owner.
--   Home: Ana and Monika    Solo: Eva alone    Duo: Mia and Nora
--   Jonas and Dana have no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'jonas@example.com', '{"full_name": "Jonas"}'),
  ('00000000-0000-0000-0000-000000000004', 'dana@example.com', '{"full_name": "Dana"}'),
  ('00000000-0000-0000-0000-000000000005', 'eva@example.com', '{"full_name": "Eva"}'),
  ('00000000-0000-0000-0000-000000000006', 'mia@example.com', '{"full_name": "Mia"}'),
  ('00000000-0000-0000-0000-000000000007', 'nora@example.com', '{"full_name": "Nora"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f2', 'Solo'),
  ('00000000-0000-0000-0000-0000000000f3', 'Duo');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000007');

-- The tokens the functions hand out, so later steps can use them.
create table public.test_tokens (label text primary key, token text not null);
grant all on public.test_tokens to authenticated;
create function public.test_token(token_label text) returns text
language sql stable as $$ select token from public.test_tokens where label = token_label $$;

-- Ana creates an invite (AC1)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

insert into public.test_tokens select 'home1', invite_token from public.create_household_invite();

select ok(
  (select public.test_token('home1') ~ '^[A-Za-z0-9_-]{32}$'),
  'the token is 32 URL-safe characters');
select is(
  (select expires_at - created_at from public.household_invites), interval '7 days',
  'an invite expires 7 days after it is created');
select is(
  (select created_by from public.household_invites), '00000000-0000-0000-0000-000000000001'::uuid,
  'the invite records who created it');

-- Creating another link replaces the live one (one live link per household)
insert into public.test_tokens select 'home2', invite_token from public.create_household_invite();

select isnt(
  public.test_token('home1'), public.test_token('home2'), 'every invite gets a new token');
select is(
  (select count(*)::int from public.household_invites), 2, 'both invites are readable by a member');
select is(
  (select count(*)::int from public.household_invites where revoked_at is null and used_at is null),
  1, 'only the newest invite is live');
select isnt(
  (select revoked_at from public.household_invites order by created_at, expires_at limit 1),
  null, 'the older invite was revoked');

-- Members cannot reach the hash or write the table (AC1, AC2)
select throws_ok(
  $$ select token_hash from public.household_invites $$,
  '42501', null, 'a member cannot read token_hash');
select throws_ok(
  $$ insert into public.household_invites (household_id, token_hash)
     values ('00000000-0000-0000-0000-0000000000f1', 'x') $$,
  '42501', null, 'a member cannot insert an invite directly');
select throws_ok(
  $$ update public.household_invites set revoked_at = null $$,
  '42501', null, 'a member cannot update an invite directly');
select throws_ok(
  $$ delete from public.household_invites $$,
  '42501', null, 'a member cannot delete an invite directly');
select throws_ok(
  $$ select public.hash_invite_token('x') $$,
  '42501', null, 'the hashing helper is not part of the API');

-- Jonas has no household
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.create_household_invite() $$,
  'P0001', 'not_in_household', 'someone without a household cannot create an invite');
select throws_ok(
  $$ select public.revoke_household_invite() $$,
  'P0001', 'not_in_household', 'someone without a household cannot revoke an invite');
select is_empty(
  $$ select id from public.household_invites $$,
  'someone outside the household sees none of its invites');

-- Preview of every kind of link (AC5)
select results_eq(
  $$ select status, household_name, member_count, inviter_name, is_member
     from public.get_household_invite(public.test_token('home2')) $$,
  $$ values ('valid'::text, 'Home'::text, 2, 'Ana'::text, false) $$,
  'a valid link shows the household, its size and who invited');
select results_eq(
  $$ select status, household_name, member_count, inviter_name, is_member
     from public.get_household_invite(public.test_token('home1')) $$,
  $$ values ('revoked'::text, null::text, 0, null::text, false) $$,
  'a revoked link says so and shows nothing else');
select results_eq(
  $$ select status, household_name, member_count, inviter_name, is_member
     from public.get_household_invite('no-such-token') $$,
  $$ values ('not_found'::text, null::text, 0, null::text, false) $$,
  'an unknown token is reported as not found');

-- Bad links cannot be accepted (AC5)
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home1')) $$,
  'P0001', 'invite_revoked', 'a revoked link cannot be accepted');
select throws_ok(
  $$ select public.accept_household_invite('no-such-token') $$,
  'P0001', 'invite_not_found', 'an unknown token cannot be accepted');
select is_empty(
  $$ select user_id from public.household_members where user_id = '00000000-0000-0000-0000-000000000003' $$,
  'refused links add nobody');

-- Jonas accepts the live link (AC4)
select is(
  public.accept_household_invite(public.test_token('home2')),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 'accepting returns the household id');
select is(
  (select count(*)::int from public.household_members where user_id = '00000000-0000-0000-0000-000000000003'),
  1, 'Jonas is now a member');
select is(
  (select count(*)::int from public.household_members), 3, 'Jonas sees the three members of Home');
select is(
  (select count(*)::int from public.household_invites where used_at is not null),
  1, 'a member can see that the invite was used');

-- Accepting the link of the household I am already in is harmless
select is(
  public.accept_household_invite(public.test_token('home2')),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 're-accepting my own household''s link succeeds');
select results_eq(
  $$ select status, household_name, is_member
     from public.get_household_invite(public.test_token('home2')) $$,
  $$ values ('used'::text, 'Home'::text, true) $$,
  'a member still sees the household behind a used link');

-- Dana arrives after the link was used (AC5)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home2')) $$,
  'P0001', 'invite_used', 'a used link cannot be accepted by someone else');
select results_eq(
  $$ select status, household_name, member_count, is_member
     from public.get_household_invite(public.test_token('home2')) $$,
  $$ values ('used'::text, null::text, 0, false) $$,
  'a used link shows a stranger nothing about the household');

-- Expiry (AC5), with the clock moved by the migration owner
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.test_tokens select 'home3', invite_token from public.create_household_invite();
reset role;
update public.household_invites set expires_at = now() - interval '1 minute'
where token_hash = encode(sha256(convert_to((select token from public.test_tokens where label = 'home3'), 'UTF8')), 'hex');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select results_eq(
  $$ select status, household_name from public.get_household_invite(public.test_token('home3')) $$,
  $$ values ('expired'::text, null::text) $$,
  'a link past its expiry reports expired');
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home3')) $$,
  'P0001', 'invite_expired', 'an expired link cannot be accepted');

-- Revoking (AC2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.test_tokens select 'home4', invite_token from public.create_household_invite();
select lives_ok(
  $$ select public.revoke_household_invite() $$, 'a member can revoke the live link');
select is(
  (select count(*)::int from public.household_invites where revoked_at is null and used_at is null and expires_at > now()),
  0, 'no live link is left after revoking');
select lives_ok(
  $$ select public.revoke_household_invite() $$, 'revoking with nothing live does nothing');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home4')) $$,
  'P0001', 'invite_revoked', 'a link revoked by a member cannot be accepted');

-- Another member can revoke a link they did not create (no owner role)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.test_tokens select 'home5', invite_token from public.create_household_invite();
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.revoke_household_invite() $$, 'any member can revoke, not only the creator');
select results_eq(
  $$ select status from public.get_household_invite(public.test_token('home5')) $$,
  $$ values ('revoked'::text) $$, 'the link revoked by Monika is revoked');

-- Eva is in Solo, alone (AC6)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.test_tokens select 'home6', invite_token from public.create_household_invite();
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';

select results_eq(
  $$ select status, household_name, is_member from public.get_household_invite(public.test_token('home6')) $$,
  $$ values ('valid'::text, 'Home'::text, false) $$,
  'Eva can preview Home''s link while in another household');
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home6')) $$,
  '23505', 'already_in_household', 'being in a household blocks accepting without leaving');
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home6'), null) $$,
  '23505', 'already_in_household', 'a null leave_current counts as no');
select is(
  (select name from public.households), 'Solo', 'a refused accept leaves Eva in Solo');
select throws_ok(
  $$ select public.accept_household_invite(public.test_token('home6'), false) $$,
  '23505', 'already_in_household', 'leave_current false is the same as the default');

select is(
  public.accept_household_invite(public.test_token('home6'), true),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 'leaving and joining returns the new household');
select results_eq(
  $$ select households.name from public.household_members
     join public.households on households.id = household_members.household_id
     where household_members.user_id = '00000000-0000-0000-0000-000000000005' $$,
  $$ values ('Home'::text) $$,
  'Eva is in Home and only in Home');

reset role;
select is_empty(
  $$ select id from public.households where id = '00000000-0000-0000-0000-0000000000f2' $$,
  'Solo was deleted when its last member left');
select is_empty(
  $$ select user_id from public.household_members where household_id = '00000000-0000-0000-0000-0000000000f2' $$,
  'Solo has no members left');
select isnt(
  (select used_at from public.household_invites
   where token_hash = encode(sha256(convert_to((select token from public.test_tokens where label = 'home6'), 'UTF8')), 'hex')),
  null, 'the link was consumed by the switch');

-- Mia leaves Duo, which keeps Nora (AC6)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.test_tokens select 'home7', invite_token from public.create_household_invite();
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select lives_ok(
  $$ select public.accept_household_invite(public.test_token('home7'), true) $$,
  'Mia can leave Duo and join Home');

reset role;
select results_eq(
  $$ select user_id from public.household_members where household_id = '00000000-0000-0000-0000-0000000000f3' $$,
  $$ values ('00000000-0000-0000-0000-000000000007'::uuid) $$,
  'Duo is kept, with Nora as its only member');
select is(
  (select count(*)::int from public.household_members where household_id = '00000000-0000-0000-0000-0000000000f1'),
  5, 'Home now has Ana, Monika, Jonas, Eva and Mia');
select is(
  (select count(*)::int from public.household_members group by user_id order by count(*) desc limit 1),
  1, 'nobody is in more than one household');

-- The invite records who used it, and the hash is stored, never the token
select is(
  (select used_by from public.household_invites
   where token_hash = encode(sha256(convert_to((select token from public.test_tokens where label = 'home2'), 'UTF8')), 'hex')),
  '00000000-0000-0000-0000-000000000003'::uuid, 'the invite records who used it');
select is(
  (select count(*)::int from public.household_invites where token_hash = (select token from public.test_tokens where label = 'home1')),
  0, 'the plain token is not stored');
select is(
  (select count(*)::int from public.household_invites
   where token_hash = encode(sha256(convert_to((select token from public.test_tokens where label = 'home1'), 'UTF8')), 'hex')),
  1, 'its SHA-256 hash is');

-- Signed in without a user id, and signed out
set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok(
  $$ select * from public.create_household_invite() $$,
  '28000', 'not_authenticated', 'creating needs a user id');
select throws_ok(
  $$ select public.revoke_household_invite() $$,
  '28000', 'not_authenticated', 'revoking needs a user id');
select throws_ok(
  $$ select * from public.get_household_invite('x') $$,
  '28000', 'not_authenticated', 'previewing needs a user id');
select throws_ok(
  $$ select public.accept_household_invite('x') $$,
  '28000', 'not_authenticated', 'accepting needs a user id');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.create_household_invite() $$,
  '42501', null, 'signed-out visitors cannot create invites');
select throws_ok(
  $$ select public.revoke_household_invite() $$,
  '42501', null, 'signed-out visitors cannot revoke invites');
select throws_ok(
  $$ select * from public.get_household_invite('x') $$,
  '42501', null, 'signed-out visitors cannot preview invites');
select throws_ok(
  $$ select public.accept_household_invite('x') $$,
  '42501', null, 'signed-out visitors cannot accept invites');
select throws_ok(
  $$ select id from public.household_invites $$,
  '42501', null, 'signed-out visitors cannot read invites');

-- Cascades: a deleted creator keeps the invite, a deleted household takes its invites
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
select ok(
  exists (select 1 from public.household_invites where created_by is null),
  'deleting the creator keeps their invites');
delete from public.households where id = '00000000-0000-0000-0000-0000000000f1';
select is_empty(
  $$ select id from public.household_invites where household_id = '00000000-0000-0000-0000-0000000000f1' $$,
  'deleting a household deletes its invites');

select * from finish();
rollback;

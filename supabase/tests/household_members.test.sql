-- Household members (B3): the owner role, removing a member, leaving, transferring ownership
-- and deleting the household. Run with `supabase test db` against a local stack (see README,
-- "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(67);

-- Fixtures, created as the migration owner.
--   Home:   Ana (owner), Monika, Zappa      Other:  Ola (owner), Dana
--   Duo:    Nora (owner), Mia               Target: Tom (owner)
--   Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'zappa@example.com', '{"full_name": "Zappa"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}'),
  ('00000000-0000-0000-0000-000000000006', 'dana@example.com', '{"full_name": "Dana"}'),
  ('00000000-0000-0000-0000-000000000007', 'ola@example.com', '{"full_name": "Ola"}'),
  ('00000000-0000-0000-0000-000000000008', 'mia@example.com', '{"full_name": "Mia"}'),
  ('00000000-0000-0000-0000-000000000009', 'nora@example.com', '{"full_name": "Nora"}'),
  ('00000000-0000-0000-0000-00000000000a', 'tom@example.com', '{"full_name": "Tom"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f3', 'Other'),
  ('00000000-0000-0000-0000-0000000000f4', 'Duo'),
  ('00000000-0000-0000-0000-0000000000f5', 'Target');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'member'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000007', 'owner'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000006', 'member'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000009', 'owner'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000008', 'member'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000000a', 'owner');

-- Home has a live invite from Monika and one from Ana; Other has one from Ola; Target has two to join with.
insert into public.household_invites (household_id, token_hash, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'monika-link', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000f1', 'ana-link', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000f3', 'ola-link', '00000000-0000-0000-0000-000000000007');
insert into public.household_invites (household_id, token_hash, created_by) values
  ('00000000-0000-0000-0000-0000000000f5', public.hash_invite_token('first-target-link'), '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f5', public.hash_invite_token('second-target-link'), '00000000-0000-0000-0000-00000000000a');

-- One owner per household
select is(
  (select count(*)::int from public.household_members where role = 'owner'), 4,
  'every household has exactly one owner');

-- Seeing members (AC1): Monika reads names and roles
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select results_eq(
  $$ select profiles.display_name, household_members.role
     from public.household_members
     join public.profiles on profiles.id = household_members.user_id
     order by profiles.display_name $$,
  $$ values ('Ana'::text, 'owner'::text), ('Monika', 'member'), ('Zappa', 'member') $$,
  'a member sees every member of their household with the name and role');

-- A stranger sees no members
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is_empty(
  $$ select user_id from public.household_members $$, 'someone outside every household sees no members');

-- A member cannot remove anyone (AC2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000003') $$,
  'P0001', 'not_owner', 'a member cannot remove another member');
select is(
  (select count(*)::int from public.household_members), 3, 'the refused removal changed nothing');

-- The owner removes a member (AC2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000001') $$,
  'P0001', 'cannot_remove_self', 'the owner cannot remove themselves');
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000006') $$,
  'P0001', 'member_not_found', 'the owner cannot remove someone from another household');
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-0000000000ee') $$,
  'P0001', 'member_not_found', 'removing a stranger finds nobody');
select throws_ok(
  $$ select public.remove_household_member(null) $$,
  'P0001', 'member_not_found', 'removing nobody finds nobody');
select lives_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000002') $$,
  'the owner removes Monika');
select results_eq(
  $$ select user_id from public.household_members order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000003'::uuid) $$,
  'Ana and Zappa remain');
select is(
  (select revoked_at is not null from public.household_invites where created_by = '00000000-0000-0000-0000-000000000002'),
  true, 'the removed member''s link is revoked');
select is(
  (select revoked_at is null from public.household_invites where created_by = '00000000-0000-0000-0000-000000000001'),
  true, 'the owner''s own link stays live');

-- The removed member has lost access at once (AC5)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select is_empty($$ select id from public.households $$, 'the removed member no longer sees the household');
select is_empty($$ select user_id from public.household_members $$, 'the removed member no longer sees its members');
select is_empty($$ select id from public.household_invites $$, 'the removed member no longer sees its invites');
select is(
  public.is_household_member('00000000-0000-0000-0000-0000000000f1'), false,
  'the removed member is not a member by the access check every policy uses');
select throws_ok(
  $$ select public.create_household_invite() $$,
  'P0001', 'not_in_household', 'the removed member cannot create an invite for it');
select lives_ok(
  $$ select public.create_household('Monika''s home') $$,
  'the removed member is free to start another household');
select is(
  (select role from public.household_members), 'owner', 'and owns it');

-- A member leaves (AC3)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

select lives_ok($$ select public.leave_household() $$, 'a member leaves');
select is_empty($$ select id from public.households $$, 'the member who left no longer sees the household');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq(
  $$ select user_id from public.household_members $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid) $$,
  'the household keeps its owner');

-- Zappa returns, so the owner has company again (fixture, as the migration owner)
reset role;
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003');

-- The owner cannot leave while others remain (AC4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select public.leave_household() $$,
  'P0001', 'owner_must_transfer', 'an owner with other members cannot leave');
select results_eq(
  $$ select user_id, role from public.household_members order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 'owner'::text),
            ('00000000-0000-0000-0000-000000000003'::uuid, 'member') $$,
  'the refused leave changed nothing');

-- Transferring ownership (AC4)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000003') $$,
  'P0001', 'not_owner', 'a member cannot transfer ownership');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000006') $$,
  'P0001', 'invalid_new_owner', 'ownership cannot go to someone outside the household');
select throws_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000001') $$,
  'P0001', 'invalid_new_owner', 'ownership cannot go to the current owner');
select throws_ok(
  $$ select public.transfer_household_ownership(null) $$,
  'P0001', 'invalid_new_owner', 'ownership cannot go to nobody');
select lives_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000003') $$,
  'the owner hands the household to Zappa');
select results_eq(
  $$ select user_id, role from public.household_members order by user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 'member'::text),
            ('00000000-0000-0000-0000-000000000003'::uuid, 'owner') $$,
  'Zappa owns it and Ana is a member');
select is(
  (select count(*)::int from public.household_members where role = 'owner'), 1,
  'there is still exactly one owner');
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000003') $$,
  'P0001', 'not_owner', 'the former owner can no longer remove anyone');
select lives_ok($$ select public.leave_household() $$, 'the former owner now leaves like any member');

-- The sole owner leaving deletes the household and its links (AC4)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is(
  (select count(*)::int from public.household_members), 1, 'Zappa is alone in Home');
select lives_ok($$ select public.leave_household() $$, 'the only member and owner leaves');

reset role;
select is_empty(
  $$ select id from public.households where id = '00000000-0000-0000-0000-0000000000f1' $$,
  'the household is gone with its last member');
select is_empty(
  $$ select id from public.household_invites where household_id = '00000000-0000-0000-0000-0000000000f1' $$,
  'and so are its invites');

-- Deleting the household (AC4, AC5)
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select throws_ok(
  $$ select public.delete_household() $$,
  'P0001', 'not_owner', 'a member cannot delete the household');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000007", "role": "authenticated"}';
select lives_ok($$ select public.delete_household() $$, 'the owner deletes the household');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select is_empty($$ select id from public.households $$, 'the other members lose the household at once');
select is_empty($$ select user_id from public.household_members $$, 'and its member list');

reset role;
select is_empty(
  $$ select user_id from public.household_members where household_id = '00000000-0000-0000-0000-0000000000f3' $$,
  'no member rows are left behind');
select is_empty(
  $$ select id from public.household_invites where household_id = '00000000-0000-0000-0000-0000000000f3' $$,
  'no invites are left behind');

-- Someone without a household
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok($$ select public.leave_household() $$,
  'P0001', 'not_in_household', 'leaving needs a household');
select throws_ok($$ select public.delete_household() $$,
  'P0001', 'not_in_household', 'deleting needs a household');
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000003') $$,
  'P0001', 'not_in_household', 'removing needs a household');
select throws_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000003') $$,
  'P0001', 'not_in_household', 'transferring needs a household');

-- Signed in without a user id
set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok($$ select public.leave_household() $$,
  '28000', 'not_authenticated', 'a request with no user id cannot leave');

-- Switching households through an invite follows the same owner rule (B2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000009", "role": "authenticated"}';
select throws_ok(
  $$ select public.accept_household_invite('first-target-link', true) $$,
  'P0001', 'owner_must_transfer', 'an owner with other members cannot switch households');
select is(
  (select count(*)::int from public.household_members), 2, 'the refused switch left Duo as it was');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000008", "role": "authenticated"}';
select lives_ok(
  $$ select public.accept_household_invite('first-target-link', true) $$,
  'a member of Duo can switch to Target');
select is(
  (select name from public.households), 'Target', 'and now sees Target');
select is(
  (select role from public.household_members where user_id = '00000000-0000-0000-0000-000000000008'), 'member',
  'as a regular member');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000009", "role": "authenticated"}';
select lives_ok(
  $$ select public.accept_household_invite('second-target-link', true) $$,
  'the owner of a household with nobody else can switch');

reset role;
select is_empty(
  $$ select id from public.households where name = 'Duo' $$, 'and Duo is deleted behind them');

-- Direct writes are not a way around the functions
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$ update public.household_members set role = 'owner' where user_id = '00000000-0000-0000-0000-000000000009' $$,
  'updating a role directly is silently ignored');
select is(
  (select role from public.household_members where user_id = '00000000-0000-0000-0000-000000000009'), 'member',
  'the other member is still not an owner');
select lives_ok(
  $$ delete from public.household_members where user_id = '00000000-0000-0000-0000-000000000009' $$,
  'deleting a member directly is silently ignored');
select is(
  (select count(*)::int from public.household_members), 3, 'Target still has all three members');

-- One owner, valid roles (as the migration owner)
reset role;
select throws_ok(
  $$ update public.household_members set role = 'owner' where user_id = '00000000-0000-0000-0000-000000000009' $$,
  '23505', null, 'a household cannot have two owners');
select throws_ok(
  $$ update public.household_members set role = 'admin' where user_id = '00000000-0000-0000-0000-000000000009' $$,
  '23514', null, 'only owner and member are valid roles');

-- Who may call what
set local role anon;
select throws_ok($$ select public.leave_household() $$,
  '42501', null, 'signed-out visitors cannot leave');
select throws_ok(
  $$ select public.remove_household_member('00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'signed-out visitors cannot remove');
select throws_ok(
  $$ select public.transfer_household_ownership('00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'signed-out visitors cannot transfer');
select throws_ok($$ select public.delete_household() $$,
  '42501', null, 'signed-out visitors cannot delete');

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.leave_household_for('00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'the internal leave helper is not part of the API');

select * from finish();
rollback;

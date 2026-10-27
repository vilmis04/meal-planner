-- Household member management (B3): an owner role, removing a member, leaving, transferring
-- ownership and deleting the household. B1 and B2 treated every member as equal; from here a
-- household always has exactly one owner, who is the only one who can remove people.
-- Writes go through the functions below; household_members has no insert, update or delete policy.

alter table public.household_members
  add column role text not null default 'member',
  add constraint household_members_role_valid check (role in ('owner', 'member'));

-- Households that exist before this migration: the member who joined first owns it.
update public.household_members as members
set role = 'owner'
from (
  select distinct on (household_id) household_id, user_id
  from public.household_members
  order by household_id, joined_at, user_id
) as first_members
where members.household_id = first_members.household_id
  and members.user_id = first_members.user_id;

-- Created after the backfill so the index never sees two owners. Every function below keeps
-- this true: ownership moves in a transfer, and the owner cannot leave while others remain.
create unique index household_members_one_owner_idx
  on public.household_members (household_id)
  where role = 'owner';

-- The creator owns the household they create. Otherwise unchanged from B1.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  trimmed_name    text := btrim(household_name);
  new_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if trimmed_name is null or char_length(trimmed_name) not between 1 and 50 then
    raise exception 'invalid_household_name' using errcode = '22023';
  end if;

  insert into public.households (name)
  values (trimmed_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');

  return new_household_id;
exception
  -- Rolls back the household insert above together with the failed member insert.
  when unique_violation then
    raise exception 'already_in_household' using errcode = '23505';
end;
$$;

-- Takes a user out of their household, shared by leave_household() and the household switch in
-- accept_household_invite() so both obey the same rules: an owner with other members is refused
-- (they must transfer ownership or delete the household first), and the last member leaving
-- deletes the household. Locking the household row makes concurrent changes take turns.
create or replace function public.leave_household_for(leaving_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  leaving_household_id uuid;
  leaving_role         text;
begin
  select household_id into leaving_household_id
  from public.household_members
  where user_id = leaving_user_id;

  if leaving_household_id is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  perform 1 from public.households where id = leaving_household_id for update;

  -- Read again under the lock: the owner may have removed this user or handed over ownership meanwhile.
  select role into leaving_role
  from public.household_members
  where household_id = leaving_household_id and user_id = leaving_user_id;

  if leaving_role is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  if leaving_role = 'owner' and exists (
    select 1 from public.household_members
    where household_id = leaving_household_id and user_id <> leaving_user_id
  ) then
    raise exception 'owner_must_transfer' using errcode = 'P0001';
  end if;

  delete from public.household_members
  where household_id = leaving_household_id and user_id = leaving_user_id;

  if not exists (select 1 from public.household_members where household_id = leaving_household_id) then
    delete from public.households where id = leaving_household_id;
  end if;
end;
$$;

-- Leaves the caller's household. Refused with owner_must_transfer for an owner who still has company.
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.leave_household_for(current_user_id);
end;
$$;

-- The owner removes another member. Their access ends with the row: every household policy
-- asks is_household_member(). Invites they created are revoked too, or they could use a link
-- they still hold to walk back in.
create or replace function public.remove_household_member(member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select household_id into my_household_id
  from public.household_members
  where user_id = current_user_id;

  if my_household_id is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  perform 1 from public.households where id = my_household_id for update;

  if not exists (
    select 1 from public.household_members
    where household_id = my_household_id and user_id = current_user_id and role = 'owner'
  ) then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  if member_user_id = current_user_id then
    raise exception 'cannot_remove_self' using errcode = 'P0001';
  end if;

  delete from public.household_members
  where household_id = my_household_id and user_id = member_user_id;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;

  update public.household_invites
  set revoked_at = now()
  where household_id = my_household_id
    and created_by = member_user_id
    and revoked_at is null
    and used_at is null
    and expires_at > now();
end;
$$;

-- The owner hands the household to another member and becomes a regular member. The old owner is
-- demoted first so the one-owner index is never violated.
create or replace function public.transfer_household_ownership(new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select household_id into my_household_id
  from public.household_members
  where user_id = current_user_id;

  if my_household_id is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  perform 1 from public.households where id = my_household_id for update;

  if not exists (
    select 1 from public.household_members
    where household_id = my_household_id and user_id = current_user_id and role = 'owner'
  ) then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  if new_owner_id is null
    or new_owner_id = current_user_id
    or not exists (
      select 1 from public.household_members
      where household_id = my_household_id and user_id = new_owner_id
    ) then
    raise exception 'invalid_new_owner' using errcode = 'P0001';
  end if;

  update public.household_members
  set role = 'member'
  where household_id = my_household_id and user_id = current_user_id;

  update public.household_members
  set role = 'owner'
  where household_id = my_household_id and user_id = new_owner_id;
end;
$$;

-- The owner deletes the household for everyone. Members and invites go with it through their cascades.
create or replace function public.delete_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select household_id into my_household_id
  from public.household_members
  where user_id = current_user_id;

  if my_household_id is null then
    raise exception 'not_in_household' using errcode = 'P0001';
  end if;

  perform 1 from public.households where id = my_household_id for update;

  if not exists (
    select 1 from public.household_members
    where household_id = my_household_id and user_id = current_user_id and role = 'owner'
  ) then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  delete from public.households where id = my_household_id;
end;
$$;

-- Joins the invite's household, in one transaction. Unchanged from B2 except that leaving the
-- old household goes through leave_household_for(): an owner with other members is refused with
-- owner_must_transfer instead of leaving the household without an owner.
create or replace function public.accept_household_invite(invite_token text, leave_current boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id  uuid := (select auth.uid());
  invite           public.household_invites%rowtype;
  old_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- The lock makes two people using the same link take turns: the second one finds it used.
  select * into invite
  from public.household_invites
  where token_hash = public.hash_invite_token(invite_token)
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  select household_id into old_household_id
  from public.household_members
  where user_id = current_user_id;

  if old_household_id = invite.household_id then
    return invite.household_id;
  end if;

  if invite.used_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  elsif invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  elsif invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  if old_household_id is not null then
    if not coalesce(leave_current, false) then
      raise exception 'already_in_household' using errcode = '23505';
    end if;

    perform public.leave_household_for(current_user_id);
  end if;

  insert into public.household_members (household_id, user_id)
  values (invite.household_id, current_user_id);

  update public.household_invites
  set used_at = now(), used_by = current_user_id
  where id = invite.id;

  return invite.household_id;
exception
  -- Joined another household in the meantime: household_members_user_id_key refuses the insert.
  when unique_violation then
    raise exception 'already_in_household' using errcode = '23505';
end;
$$;

revoke execute on function public.leave_household_for(uuid) from public, anon, authenticated;
revoke execute on function public.leave_household() from public, anon;
revoke execute on function public.remove_household_member(uuid) from public, anon;
revoke execute on function public.transfer_household_ownership(uuid) from public, anon;
revoke execute on function public.delete_household() from public, anon;
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.accept_household_invite(text, boolean) from public, anon;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.transfer_household_ownership(uuid) to authenticated;
grant execute on function public.delete_household() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_household_invite(text, boolean) to authenticated;

-- Household invites (B2): a member creates a link, anyone signed in can use it once to join.
-- There is no owner role, so every member can create and revoke the household's invite.
-- Writes go through the four functions below; the table has no insert, update or delete policy.

create extension if not exists pgcrypto with schema extensions;

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- SHA-256 (hex) of the token in the link. The token itself is shown once, at creation, and never stored.
  token_hash   text not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  revoked_at   timestamptz,
  used_at      timestamptz,
  used_by      uuid references auth.users (id) on delete set null,
  constraint household_invites_token_hash_key unique (token_hash)
);

create index household_invites_household_id_idx on public.household_invites (household_id);

alter table public.household_invites enable row level security;

create policy "household invites are readable by their household"
  on public.household_invites for select to authenticated
  using (public.is_household_member(household_id));

-- Members may read the state of their invites, but never the hash.
revoke all on public.household_invites from anon, authenticated;
grant select (id, household_id, created_by, created_at, expires_at, revoked_at, used_at)
  on public.household_invites to authenticated;

-- Internal to the functions below; not part of the API.
create or replace function public.hash_invite_token(invite_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(invite_token, 'UTF8')), 'hex');
$$;

revoke execute on function public.hash_invite_token(text) from public, anon, authenticated;

-- Creates the household's invite and returns its token, the only time it can be read.
-- One live link per household: an earlier live invite is revoked first. Locking the
-- household row makes two simultaneous creates take turns.
create or replace function public.create_household_invite()
returns table (invite_token text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  my_household_id uuid;
  new_token       text;
  new_expires_at  timestamptz;
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

  update public.household_invites
  set revoked_at = now()
  where household_id = my_household_id
    and revoked_at is null
    and used_at is null
    and expires_at > now();

  -- 24 random bytes (192 bits) as 32 URL-safe characters.
  new_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');

  insert into public.household_invites (household_id, token_hash, created_by)
  values (my_household_id, public.hash_invite_token(new_token), current_user_id)
  returning household_invites.expires_at into new_expires_at;

  return query select new_token, new_expires_at;
end;
$$;

-- Revokes the household's live invite, if there is one.
create or replace function public.revoke_household_invite()
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

  update public.household_invites
  set revoked_at = now()
  where household_id = my_household_id
    and revoked_at is null
    and used_at is null
    and expires_at > now();
end;
$$;

-- What the accept screen needs to know about a link. Returns a status instead of raising, so every
-- kind of bad link reaches the screen. Household details are shown only for a valid link or to
-- someone already in that household, so a leaked used or revoked link reveals nothing.
create or replace function public.get_household_invite(invite_token text)
returns table (
  status         text,
  household_name text,
  member_count   integer,
  inviter_name   text,
  is_member      boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  invite          public.household_invites%rowtype;
  invite_status   text;
  already_member  boolean;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into invite
  from public.household_invites
  where token_hash = public.hash_invite_token(invite_token);

  if not found then
    return query select 'not_found'::text, null::text, 0, null::text, false;
    return;
  end if;

  invite_status := case
    when invite.used_at is not null then 'used'
    when invite.revoked_at is not null then 'revoked'
    when invite.expires_at <= now() then 'expired'
    else 'valid'
  end;

  select exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = current_user_id
  ) into already_member;

  if invite_status <> 'valid' and not already_member then
    return query select invite_status, null::text, 0, null::text, false;
    return;
  end if;

  return query
  select
    invite_status,
    (select households.name from public.households where households.id = invite.household_id),
    (select count(*)::integer from public.household_members where household_id = invite.household_id),
    (select profiles.display_name from public.profiles where profiles.id = invite.created_by),
    already_member;
end;
$$;

-- Joins the invite's household, in one transaction. If the caller is in another household,
-- leave_current must be true: they are then removed from it, and it is deleted when they were
-- its last member. Without it the call raises already_in_household and changes nothing.
-- Accepting a link for the household you are already in succeeds and leaves the link unused.
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

    -- Two members leaving at once must not both see the other still there.
    perform 1 from public.households where id = old_household_id for update;

    delete from public.household_members
    where household_id = old_household_id and user_id = current_user_id;

    if not exists (select 1 from public.household_members where household_id = old_household_id) then
      delete from public.households where id = old_household_id;
    end if;
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

revoke execute on function public.create_household_invite() from public, anon;
revoke execute on function public.revoke_household_invite() from public, anon;
revoke execute on function public.get_household_invite(text) from public, anon;
revoke execute on function public.accept_household_invite(text, boolean) from public, anon;
grant execute on function public.create_household_invite() to authenticated;
grant execute on function public.revoke_household_invite() to authenticated;
grant execute on function public.get_household_invite(text) to authenticated;
grant execute on function public.accept_household_invite(text, boolean) to authenticated;

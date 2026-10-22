-- Households (B1): a user creates a household and becomes its first member.
-- There is no owner role: every member is equal. Invites (B2) and removing or leaving (B3)
-- add to this.

-- Same shape as profiles.display_name, so names are stored ready to show.
alter table public.households
  add constraint households_name_trimmed_length check (
    name = btrim(name) and char_length(name) between 1 and 50
  );

-- Lets the app read member names with one embedded query (profiles(display_name)).
alter table public.household_members
  add constraint household_members_user_id_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- The only way to create a household. Security definer because neither table has an
-- insert policy: the household and its first member row are written together or not at all.
-- "One household per user" is enforced by household_members_user_id_key, so two simultaneous
-- requests cannot both succeed; the loser gets already_in_household.
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

  insert into public.household_members (household_id, user_id)
  values (new_household_id, current_user_id);

  return new_household_id;
exception
  -- Rolls back the household insert above together with the failed member insert.
  when unique_violation then
    raise exception 'already_in_household' using errcode = '23505';
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

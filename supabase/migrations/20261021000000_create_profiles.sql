-- Profiles (A3): one row per auth user, created by a trigger on sign-up.
-- Also the minimal household schema that lets members read each other's profiles;
-- creating households and adding, inviting or removing members arrive with B1–B3.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  -- Null until the app records the language the user first browses in, because
  -- Google sign-up has no way to pass the current UI language to the trigger.
  locale       text,
  theme        text not null default 'system',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_display_name_trimmed_length check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 50
  ),
  constraint profiles_locale_supported check (locale in ('en', 'lt')),
  constraint profiles_theme_supported check (theme in ('light', 'dark', 'system'))
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Google sign-up provides full_name/name; email sign-up falls back to the part before "@".
-- Always returns a value that satisfies profiles_display_name_trimmed_length, so a
-- sign-up is never rolled back because of its name.
create or replace function public.default_display_name(metadata jsonb, email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(left(coalesce(
    nullif(btrim(metadata ->> 'full_name'), ''),
    nullif(btrim(metadata ->> 'name'), ''),
    nullif(btrim(split_part(email, '@', 1)), ''),
    'User'
  ), 50));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.default_display_name(new.raw_user_meta_data, new.email));
  return new;
end;
$$;

-- Internal to sign-up; neither function is part of the API.
revoke execute on function public.default_display_name(jsonb, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration.
insert into public.profiles (id, display_name)
select users.id, public.default_display_name(users.raw_user_meta_data, users.email)
from auth.users as users
on conflict (id) do nothing;

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- The unique user_id enforces "a user can belong to only one household" (B1).
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint household_members_user_id_key unique (user_id)
);

-- Security definer so policies can check membership without going through
-- household_members' own RLS, which would make its policy recurse.
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_household(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as mine
    join public.household_members as theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user_id
  );
$$;

revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.shares_household(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.shares_household(uuid) to authenticated;

-- Row level security. Profiles are inserted by the trigger and deleted by the
-- auth.users cascade, so there are no insert or delete policies. Households have
-- read policies only until B1–B3 add the write paths.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles are readable by household members"
  on public.profiles for select to authenticated
  using (public.shares_household(id));
create policy "profiles are updatable by their owner"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only the user-editable columns; id and timestamps stay out of reach.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, locale, theme) on public.profiles to authenticated;

create policy "households are readable by their members"
  on public.households for select to authenticated
  using (public.is_household_member(id));
create policy "household members are readable by their household"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

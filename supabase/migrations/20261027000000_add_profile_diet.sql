-- Dietary preference (C1): one diet per user, on the profile.
-- The ladder (which proteins each diet allows) lives in shared/utils/diet.ts; the database only
-- stores the choice. The six values must match DIETS there.
-- Additive and safe for the previous app version, so run it before deploying the code that reads it.

alter table public.profiles
  add column diet text not null default 'full';

alter table public.profiles
  add constraint profiles_diet_supported check (
    diet in ('vegetarian', 'fish', 'poultry', 'pork', 'beef', 'full')
  );

-- Update was revoked table-wide and granted per column in the profiles migration.
-- The sign-up trigger leaves the column out, so new profiles take the default, as existing ones did.
grant update (diet) on public.profiles to authenticated;

-- Nutrition on request (F1): whether the user has asked to see calories and macros, remembered on the profile.
-- Off by default, so plan and recipe views show no nutrition until the user turns it on.
-- Recipes and ready protein swaps already carry their macros and are readable by signed-in users (C2, D2);
-- this migration only adds the setting. It is additive and can be run again, so run it before deploying the app
-- version that reads it.

alter table public.profiles
  add column if not exists show_nutrition boolean not null default false;

comment on column public.profiles.show_nutrition is
  'Whether plan and recipe views show calories and macros (F1). Off by default.';

-- Update was revoked table-wide and granted per column in the profiles migration.
-- The sign-up trigger leaves the column out, so new profiles take the default, as existing ones did.
grant update (show_nutrition) on public.profiles to authenticated;

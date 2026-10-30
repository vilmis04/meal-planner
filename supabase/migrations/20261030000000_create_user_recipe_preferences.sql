-- Meal preference (C3): a user marks a recipe enjoy, enjoy less or hate. Unrated means no row, so clearing a
-- rating deletes it. The three values must match RECIPE_RATINGS in shared/utils/recipeRating.ts.
-- Private to the owner: no household policy, on purpose. The plan generator (E4) reads other people's ratings
-- on the server with the service role, after checking household membership.
-- Additive and safe for the previous app version, so run it before deploying the code that reads it.

create table public.user_recipe_preferences (
  user_id    uuid not null references auth.users (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  rating     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id),
  constraint user_recipe_preferences_rating_supported check (rating in ('enjoy', 'enjoy_less', 'hate'))
);

-- The primary key serves "everything this user rated"; this one serves "everyone's rating of these recipes".
create index user_recipe_preferences_recipe_id_idx on public.user_recipe_preferences (recipe_id);

create trigger user_recipe_preferences_set_updated_at
  before update on public.user_recipe_preferences
  for each row execute function public.set_updated_at();

alter table public.user_recipe_preferences enable row level security;

create policy "ratings are readable by their owner"
  on public.user_recipe_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ratings are addable by their owner"
  on public.user_recipe_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "ratings are updatable by their owner"
  on public.user_recipe_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "ratings are deletable by their owner"
  on public.user_recipe_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- Only the user-editable columns: a row can never be pointed at another user or recipe after it is made.
revoke all on public.user_recipe_preferences from anon, authenticated;
grant select, delete on public.user_recipe_preferences to authenticated;
grant insert (user_id, recipe_id, rating) on public.user_recipe_preferences to authenticated;
grant update (rating) on public.user_recipe_preferences to authenticated;

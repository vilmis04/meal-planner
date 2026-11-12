-- Translatable recipe content (X1b): recipes (name, instructions), their ingredient lines, canonical ingredients (G1)
-- and tips get one translation row per language. The app reads the row of the active language and falls back to the
-- Lithuanian one when it is missing (shared/utils/contentTranslation.ts).
--
--   * recipe_translations: a recipe's name and instructions.
--   * recipe_ingredient_translations: a recipe line's item ("Kiaušiniai (M)" → "Eggs (M)") and, rarely, its unit when
--     the shared unit label would read wrong for that line (a lime "skiltelė" is a wedge, not a clove). A null unit
--     reads the line's own unit through the app's unit labels (app/utils/unitLabel.ts).
--   * ingredient_translations: a canonical ingredient's name, which shopping lists show. Names are unique per language,
--     as the Lithuanian ones are, so an ingredient can be named back without guessing.
--   * tip_translations: a tip's text (shown in context by X3).
-- Shopping categories are not content: their names are UI messages (shoppingList.category.* in i18n/locales).
--
-- Lithuanian is the source language. recipes.name, recipes.instructions, recipe_ingredients.item, ingredients.name and
-- tips.tip stay as they are (the planner, the shopping list build, protein swaps and plan adjustments still use them)
-- and their Lithuanian rows mirror them: this migration copies them, and triggers keep the 'lt' row in step whenever a
-- source row is added or its text changes. Change Lithuanian text in the source column, never in the 'lt' row.
-- Other languages are added by data migrations (English: 20261125000100_add_english_content.sql).
--
-- public.missing_content_translations lists what has no row in a language (or a recipe row without the instructions
-- the source has); the report is docs/missing-translations-report.md (`npm run translations:report`).
--
-- Content tables, as recipes: readable by signed-in users, written only by migrations and the service role.
-- Additive and re-runnable: tables, policies and triggers are created if missing and the Lithuanian rows are upserted,
-- so running it again puts them back in step. The previous app version does not read the tables.

create table if not exists public.recipe_translations (
  recipe_id    uuid not null references public.recipes (id) on delete cascade,
  locale       text not null,
  name         text not null,
  instructions text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (recipe_id, locale),
  -- The app's languages (nuxt.config.ts), as profiles_locale_supported.
  constraint recipe_translations_locale_supported check (locale in ('lt', 'en')),
  constraint recipe_translations_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.recipe_ingredient_translations (
  recipe_ingredient_id uuid not null references public.recipe_ingredients (id) on delete cascade,
  locale               text not null,
  item                 text not null,
  unit                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (recipe_ingredient_id, locale),
  constraint recipe_ingredient_translations_locale_supported check (locale in ('lt', 'en')),
  constraint recipe_ingredient_translations_item_not_blank check (btrim(item) <> ''),
  constraint recipe_ingredient_translations_unit_not_blank check (unit is null or btrim(unit) <> '')
);

create table if not exists public.ingredient_translations (
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  locale        text not null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (ingredient_id, locale),
  constraint ingredient_translations_locale_supported check (locale in ('lt', 'en')),
  constraint ingredient_translations_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint ingredient_translations_locale_name_key unique (locale, name)
);

create table if not exists public.tip_translations (
  tip_id     uuid not null references public.tips (id) on delete cascade,
  locale     text not null,
  tip        text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tip_id, locale),
  constraint tip_translations_locale_supported check (locale in ('lt', 'en')),
  constraint tip_translations_tip_not_blank check (btrim(tip) <> '')
);

comment on table public.recipe_translations is
  'A recipe''s name and instructions in one language (X1b). The lt row mirrors recipes.name and recipes.instructions.';
comment on table public.recipe_ingredient_translations is
  'A recipe line''s item in one language (X1b); unit only where the shared unit label would read wrong for the line.';
comment on column public.recipe_ingredient_translations.unit is
  'The unit as this language writes it for this line; null reads recipe_ingredients.unit through the app''s unit labels.';
comment on table public.ingredient_translations is
  'A canonical ingredient''s name in one language (X1b). The lt row mirrors ingredients.name.';
comment on table public.tip_translations is
  'A tip in one language (X1b). The lt row mirrors tips.tip.';

drop trigger if exists recipe_translations_set_updated_at on public.recipe_translations;
create trigger recipe_translations_set_updated_at
  before update on public.recipe_translations
  for each row execute function public.set_updated_at();
drop trigger if exists recipe_ingredient_translations_set_updated_at on public.recipe_ingredient_translations;
create trigger recipe_ingredient_translations_set_updated_at
  before update on public.recipe_ingredient_translations
  for each row execute function public.set_updated_at();
drop trigger if exists ingredient_translations_set_updated_at on public.ingredient_translations;
create trigger ingredient_translations_set_updated_at
  before update on public.ingredient_translations
  for each row execute function public.set_updated_at();
drop trigger if exists tip_translations_set_updated_at on public.tip_translations;
create trigger tip_translations_set_updated_at
  before update on public.tip_translations
  for each row execute function public.set_updated_at();

-- Row level security: readable by signed-in users; writes only via migrations and the service role.
alter table public.recipe_translations enable row level security;
alter table public.recipe_ingredient_translations enable row level security;
alter table public.ingredient_translations enable row level security;
alter table public.tip_translations enable row level security;

drop policy if exists "recipe translations are readable by authenticated users" on public.recipe_translations;
create policy "recipe translations are readable by authenticated users"
  on public.recipe_translations for select to authenticated using (true);
drop policy if exists "recipe ingredient translations are readable by authenticated users"
  on public.recipe_ingredient_translations;
create policy "recipe ingredient translations are readable by authenticated users"
  on public.recipe_ingredient_translations for select to authenticated using (true);
drop policy if exists "ingredient translations are readable by authenticated users" on public.ingredient_translations;
create policy "ingredient translations are readable by authenticated users"
  on public.ingredient_translations for select to authenticated using (true);
drop policy if exists "tip translations are readable by authenticated users" on public.tip_translations;
create policy "tip translations are readable by authenticated users"
  on public.tip_translations for select to authenticated using (true);

-- The Lithuanian rows follow their source rows. The triggers run as whoever writes the source row (a migration or the
-- service role), who may write the translations too.
create or replace function public.mirror_recipe_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.recipe_translations (recipe_id, locale, name, instructions)
  values (new.id, 'lt', new.name, new.instructions)
  on conflict (recipe_id, locale) do update
  set name = excluded.name, instructions = excluded.instructions
  where (recipe_translations.name, recipe_translations.instructions)
    is distinct from (excluded.name, excluded.instructions);
  return null;
end;
$$;

create or replace function public.mirror_recipe_ingredient_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.recipe_ingredient_translations (recipe_ingredient_id, locale, item, unit)
  values (new.id, 'lt', new.item, null)
  on conflict (recipe_ingredient_id, locale) do update
  set item = excluded.item, unit = null
  where (recipe_ingredient_translations.item, recipe_ingredient_translations.unit)
    is distinct from (excluded.item, null::text);
  return null;
end;
$$;

create or replace function public.mirror_ingredient_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.ingredient_translations (ingredient_id, locale, name)
  values (new.id, 'lt', new.name)
  on conflict (ingredient_id, locale) do update
  set name = excluded.name
  where ingredient_translations.name is distinct from excluded.name;
  return null;
end;
$$;

create or replace function public.mirror_tip_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.tip_translations (tip_id, locale, tip)
  values (new.id, 'lt', new.tip)
  on conflict (tip_id, locale) do update
  set tip = excluded.tip
  where tip_translations.tip is distinct from excluded.tip;
  return null;
end;
$$;

revoke all on function public.mirror_recipe_translation() from public, anon, authenticated;
revoke all on function public.mirror_recipe_ingredient_translation() from public, anon, authenticated;
revoke all on function public.mirror_ingredient_translation() from public, anon, authenticated;
revoke all on function public.mirror_tip_translation() from public, anon, authenticated;

drop trigger if exists recipes_mirror_translation on public.recipes;
create trigger recipes_mirror_translation
  after insert or update of name, instructions on public.recipes
  for each row execute function public.mirror_recipe_translation();
drop trigger if exists recipe_ingredients_mirror_translation on public.recipe_ingredients;
create trigger recipe_ingredients_mirror_translation
  after insert or update of item on public.recipe_ingredients
  for each row execute function public.mirror_recipe_ingredient_translation();
drop trigger if exists ingredients_mirror_translation on public.ingredients;
create trigger ingredients_mirror_translation
  after insert or update of name on public.ingredients
  for each row execute function public.mirror_ingredient_translation();
drop trigger if exists tips_mirror_translation on public.tips;
create trigger tips_mirror_translation
  after insert or update of tip on public.tips
  for each row execute function public.mirror_tip_translation();

-- The current Lithuanian content, copied to its 'lt' rows (and put back in step on a re-run).
insert into public.recipe_translations (recipe_id, locale, name, instructions)
select recipe.id, 'lt', recipe.name, recipe.instructions
from public.recipes recipe
on conflict (recipe_id, locale) do update
set name = excluded.name, instructions = excluded.instructions
where (recipe_translations.name, recipe_translations.instructions)
  is distinct from (excluded.name, excluded.instructions);

insert into public.recipe_ingredient_translations (recipe_ingredient_id, locale, item, unit)
select recipe_ingredient.id, 'lt', recipe_ingredient.item, null
from public.recipe_ingredients recipe_ingredient
on conflict (recipe_ingredient_id, locale) do update
set item = excluded.item, unit = null
where (recipe_ingredient_translations.item, recipe_ingredient_translations.unit)
  is distinct from (excluded.item, null::text);

insert into public.ingredient_translations (ingredient_id, locale, name)
select ingredient.id, 'lt', ingredient.name
from public.ingredients ingredient
on conflict (ingredient_id, locale) do update
set name = excluded.name
where ingredient_translations.name is distinct from excluded.name;

insert into public.tip_translations (tip_id, locale, tip)
select tip.id, 'lt', tip.tip
from public.tips tip
on conflict (tip_id, locale) do update
set tip = excluded.tip
where tip_translations.tip is distinct from excluded.tip;

-- What has no translation yet: one row per content item and language without a row, plus recipes whose row in a
-- language has no instructions while the source has some. The report lists them; a pgTAP test keeps the seeds at
-- none. Not exposed through the API: read it with the service role or in the SQL editor.
create or replace view public.missing_content_translations
with (security_invoker = true) as
with locales (locale) as (
  values ('lt'), ('en')
)
select
  'recipe'::text as kind,
  recipe.id as content_id,
  recipe.meal_type::text as context,
  recipe.name as source_text,
  locales.locale
from public.recipes recipe
cross join locales
where not exists (
  select 1 from public.recipe_translations translation
  where translation.recipe_id = recipe.id and translation.locale = locales.locale
)
union all
select
  'recipe_instructions'::text,
  recipe.id,
  recipe.meal_type::text,
  recipe.name,
  translation.locale
from public.recipes recipe
join public.recipe_translations translation on translation.recipe_id = recipe.id
where btrim(recipe.instructions) <> '' and btrim(translation.instructions) = ''
union all
select
  'recipe_ingredient'::text,
  recipe_ingredient.id,
  recipe.name,
  recipe_ingredient.item,
  locales.locale
from public.recipe_ingredients recipe_ingredient
join public.recipes recipe on recipe.id = recipe_ingredient.recipe_id
cross join locales
where not exists (
  select 1 from public.recipe_ingredient_translations translation
  where translation.recipe_ingredient_id = recipe_ingredient.id and translation.locale = locales.locale
)
union all
select
  'ingredient'::text,
  ingredient.id,
  ingredient.category,
  ingredient.name,
  locales.locale
from public.ingredients ingredient
cross join locales
where not exists (
  select 1 from public.ingredient_translations translation
  where translation.ingredient_id = ingredient.id and translation.locale = locales.locale
)
union all
select
  'tip'::text,
  tip.id,
  array_to_string(tip.tags, ', '),
  tip.tip,
  locales.locale
from public.tips tip
cross join locales
where not exists (
  select 1 from public.tip_translations translation
  where translation.tip_id = tip.id and translation.locale = locales.locale
);

comment on view public.missing_content_translations is
  'Recipes, recipe lines, ingredients and tips with no translation in a language (X1b). Add them in a new migration.';

revoke all on public.missing_content_translations from anon, authenticated;
grant select on public.missing_content_translations to service_role;

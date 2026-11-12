-- Translated protein swaps (X1c): a stored swap (D2) is generated once, in Lithuanian, and translated once into the
-- app's other languages; both are cached here, so viewing a swap never calls the AI.
--
--   * recipe_protein_swap_translations: a swap's note in one language. A swap has its row in a language once it is
--     translated into it (the note is null when the swap has none), so the row also says "translated".
--   * recipe_protein_swap_item_translations: a replacement's item ("Augalinis faršas" -> "Plant-based mince") in one
--     language. Amounts, units and proteins are the same in every language and stay on recipe_protein_swap_items.
--
-- Lithuanian is the source language, as for recipe content (X1b): recipe_protein_swaps.note and
-- recipe_protein_swap_items.item stay as they are (the shopping list build and the review report use them) and their
-- 'lt' rows mirror them through triggers. Other languages are written by save_recipe_protein_swap_translation(), which
-- `npm run swaps:generate` calls after it has generated (or found) the Lithuanian swap. A swap saved again (made from
-- changed ingredients, or after it was rejected) loses its other languages, so it is translated again from its new text.
-- recipe_protein_swaps.locale stays 'lt': the language a swap is generated in.
--
-- Readable by signed-in users with their ready swap; written only by the service role (server code and the script).
-- Additive and re-runnable: tables, policies and triggers are created if missing, functions are replaced and the
-- Lithuanian rows are upserted. The previous app version does not read the tables, and save_recipe_protein_swap() keeps
-- its arguments, so run it before deploying the code that reads them.

create table if not exists public.recipe_protein_swap_translations (
  swap_id    uuid not null references public.recipe_protein_swaps (id) on delete cascade,
  locale     text not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (swap_id, locale),
  -- The app's languages (nuxt.config.ts), as recipe_protein_swaps_locale_supported.
  constraint recipe_protein_swap_translations_locale_supported check (locale in ('lt', 'en')),
  -- As recipe_protein_swaps_note_length.
  constraint recipe_protein_swap_translations_note_length check (note is null or char_length(btrim(note)) between 1 and 300)
);

create table if not exists public.recipe_protein_swap_item_translations (
  swap_id              uuid not null,
  recipe_ingredient_id uuid not null,
  locale               text not null,
  item                 text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (swap_id, recipe_ingredient_id, locale),
  foreign key (swap_id, recipe_ingredient_id)
    references public.recipe_protein_swap_items (swap_id, recipe_ingredient_id) on delete cascade,
  constraint recipe_protein_swap_item_translations_locale_supported check (locale in ('lt', 'en')),
  -- As recipe_protein_swap_items_item_length.
  constraint recipe_protein_swap_item_translations_item_length check (char_length(btrim(item)) between 1 and 120)
);

comment on table public.recipe_protein_swap_translations is
  'A protein swap''s note in one language (X1c); a row means the swap is translated into it. The lt row mirrors recipe_protein_swaps.note.';
comment on table public.recipe_protein_swap_item_translations is
  'A protein swap replacement''s item in one language (X1c). The lt row mirrors recipe_protein_swap_items.item.';

drop trigger if exists recipe_protein_swap_translations_set_updated_at on public.recipe_protein_swap_translations;
create trigger recipe_protein_swap_translations_set_updated_at
  before update on public.recipe_protein_swap_translations
  for each row execute function public.set_updated_at();
drop trigger if exists recipe_protein_swap_item_translations_set_updated_at on public.recipe_protein_swap_item_translations;
create trigger recipe_protein_swap_item_translations_set_updated_at
  before update on public.recipe_protein_swap_item_translations
  for each row execute function public.set_updated_at();

-- Row level security: signed-in users read the translations of ready swaps, as the swaps; nobody writes through the API.
alter table public.recipe_protein_swap_translations enable row level security;
alter table public.recipe_protein_swap_item_translations enable row level security;

drop policy if exists "translations of ready swaps are readable by authenticated users"
  on public.recipe_protein_swap_translations;
create policy "translations of ready swaps are readable by authenticated users"
  on public.recipe_protein_swap_translations for select to authenticated
  using (exists (
    select 1 from public.recipe_protein_swaps s
    where s.id = swap_id and s.status = 'ready'
  ));
drop policy if exists "item translations of ready swaps are readable by authenticated users"
  on public.recipe_protein_swap_item_translations;
create policy "item translations of ready swaps are readable by authenticated users"
  on public.recipe_protein_swap_item_translations for select to authenticated
  using (exists (
    select 1 from public.recipe_protein_swaps s
    where s.id = swap_id and s.status = 'ready'
  ));

revoke all on public.recipe_protein_swap_translations from anon, authenticated;
revoke all on public.recipe_protein_swap_item_translations from anon, authenticated;
grant select on public.recipe_protein_swap_translations to authenticated;
grant select on public.recipe_protein_swap_item_translations to authenticated;

-- The Lithuanian rows follow their source rows, as mirror_recipe_translation() does for recipes (X1b).
create or replace function public.mirror_recipe_protein_swap_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.recipe_protein_swap_translations (swap_id, locale, note)
  values (new.id, 'lt', nullif(btrim(new.note), ''))
  on conflict (swap_id, locale) do update
  set note = excluded.note
  where recipe_protein_swap_translations.note is distinct from excluded.note;
  return null;
end;
$$;

create or replace function public.mirror_recipe_protein_swap_item_translation()
returns trigger
language plpgsql
as $$
begin
  insert into public.recipe_protein_swap_item_translations (swap_id, recipe_ingredient_id, locale, item)
  values (new.swap_id, new.recipe_ingredient_id, 'lt', new.item)
  on conflict (swap_id, recipe_ingredient_id, locale) do update
  set item = excluded.item
  where recipe_protein_swap_item_translations.item is distinct from excluded.item;
  return null;
end;
$$;

revoke all on function public.mirror_recipe_protein_swap_translation() from public, anon, authenticated;
revoke all on function public.mirror_recipe_protein_swap_item_translation() from public, anon, authenticated;

drop trigger if exists recipe_protein_swaps_mirror_translation on public.recipe_protein_swaps;
create trigger recipe_protein_swaps_mirror_translation
  after insert or update of note on public.recipe_protein_swaps
  for each row execute function public.mirror_recipe_protein_swap_translation();
drop trigger if exists recipe_protein_swap_items_mirror_translation on public.recipe_protein_swap_items;
create trigger recipe_protein_swap_items_mirror_translation
  after insert or update of item on public.recipe_protein_swap_items
  for each row execute function public.mirror_recipe_protein_swap_item_translation();

-- The swaps stored so far, copied to their 'lt' rows (and put back in step on a re-run). Their English comes from
-- `npm run swaps:generate`, which translates every ready swap that has none.
insert into public.recipe_protein_swap_translations (swap_id, locale, note)
select swap.id, 'lt', nullif(btrim(swap.note), '')
from public.recipe_protein_swaps swap
on conflict (swap_id, locale) do update
set note = excluded.note
where recipe_protein_swap_translations.note is distinct from excluded.note;

insert into public.recipe_protein_swap_item_translations (swap_id, recipe_ingredient_id, locale, item)
select item.swap_id, item.recipe_ingredient_id, 'lt', item.item
from public.recipe_protein_swap_items item
on conflict (swap_id, recipe_ingredient_id, locale) do update
set item = excluded.item
where recipe_protein_swap_item_translations.item is distinct from excluded.item;

/*
 * save_recipe_protein_swap() from 20261105000000_create_recipe_protein_swaps.sql, unchanged but for one step: a swap
 * saved again drops its translations into other languages, which were made from its previous text. (Its item
 * translations go with the items it replaces; the triggers above write the new 'lt' rows.)
 */
create or replace function public.save_recipe_protein_swap(p_swap jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  swap_row public.recipe_protein_swaps%rowtype;
begin
  select * into swap_row
  from public.recipe_protein_swaps
  where recipe_id = (p_swap ->> 'recipe_id')::uuid
    and diet = p_swap ->> 'diet'
    and locale = p_swap ->> 'locale'
  for update;

  if swap_row.id is null or swap_row.status <> 'pending' then
    raise exception 'not_claimed' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(p_swap -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  delete from public.recipe_protein_swap_items where swap_id = swap_row.id;
  delete from public.recipe_protein_swap_translations where swap_id = swap_row.id and locale <> swap_row.locale;

  insert into public.recipe_protein_swap_items
    (swap_id, recipe_id, recipe_ingredient_id, original_protein, item, amount, unit, replacement_protein)
  select swap_row.id, swap_row.recipe_id, i.recipe_ingredient_id, i.original_protein, btrim(i.item), i.amount,
         i.unit, i.replacement_protein
  from jsonb_to_recordset(p_swap -> 'items') as i (
    recipe_ingredient_id uuid, original_protein text, item text, amount numeric, unit text, replacement_protein text
  );

  update public.recipe_protein_swaps
  set status         = 'ready',
      claimed_at     = null,
      attempts       = 0,
      last_error     = null,
      retry_after    = null,
      note           = nullif(btrim(p_swap ->> 'note'), ''),
      calories_kcal  = (p_swap ->> 'calories_kcal')::numeric,
      carbohydrates  = (p_swap ->> 'carbohydrates')::numeric,
      protein        = (p_swap ->> 'protein')::numeric,
      fat            = (p_swap ->> 'fat')::numeric,
      nutrition_approximate = true,
      source_hash    = p_swap ->> 'source_hash',
      model          = p_swap ->> 'model',
      prompt_version = (p_swap ->> 'prompt_version')::smallint,
      generated_at   = now()
  where id = swap_row.id;
end;
$$;

/*
 * Saves a ready swap's translation into one language, its note and every item, in one transaction; a translation
 * already there is replaced. Takes {recipe_id, diet, locale (the swap's, 'lt'), translation_locale, source_note, note,
 * items: [{recipe_ingredient_id, source_item, item}]}. source_note and source_item are the Lithuanian text that was
 * translated: when the swap no longer reads that way (saved again meanwhile) it raises swap_changed and saves nothing.
 *   not_ready      no ready swap for the pair
 *   source_locale  the translation is in the swap's own language (its rows mirror the swap)
 *   swap_changed   the items or note are not the swap's: one missing, extra or repeated, or other source text
 *   note_mismatch  a note without a source note, or none for a swap that has one
 */
create or replace function public.save_recipe_protein_swap_translation(p_translation jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  swap_row       public.recipe_protein_swaps%rowtype;
  target_locale  text := p_translation ->> 'translation_locale';
  translated_note text := nullif(btrim(p_translation ->> 'note'), '');
  item_count     integer;
  matched_count  integer;
  given_count    integer;
begin
  select * into swap_row
  from public.recipe_protein_swaps
  where recipe_id = (p_translation ->> 'recipe_id')::uuid
    and diet = p_translation ->> 'diet'
    and locale = p_translation ->> 'locale'
  for update;

  if swap_row.id is null or swap_row.status <> 'ready' then
    raise exception 'not_ready' using errcode = 'P0001';
  end if;
  if target_locale is null or target_locale = swap_row.locale then
    raise exception 'source_locale' using errcode = 'P0001';
  end if;

  if nullif(btrim(p_translation ->> 'source_note'), '') is distinct from swap_row.note then
    raise exception 'swap_changed' using errcode = 'P0001';
  end if;
  if (swap_row.note is null) <> (translated_note is null) then
    raise exception 'note_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into item_count from public.recipe_protein_swap_items where swap_id = swap_row.id;
  select count(*), count(distinct given.recipe_ingredient_id) into given_count, matched_count
  from jsonb_to_recordset(coalesce(p_translation -> 'items', '[]'::jsonb)) as given (
    recipe_ingredient_id uuid, source_item text, item text
  )
  join public.recipe_protein_swap_items stored
    on stored.swap_id = swap_row.id
   and stored.recipe_ingredient_id = given.recipe_ingredient_id
   and stored.item = btrim(given.source_item);
  if given_count <> item_count
     or matched_count <> item_count
     or jsonb_array_length(coalesce(p_translation -> 'items', '[]'::jsonb)) <> item_count then
    raise exception 'swap_changed' using errcode = 'P0001';
  end if;

  delete from public.recipe_protein_swap_item_translations where swap_id = swap_row.id and locale = target_locale;
  insert into public.recipe_protein_swap_item_translations (swap_id, recipe_ingredient_id, locale, item)
  select swap_row.id, given.recipe_ingredient_id, target_locale, btrim(given.item)
  from jsonb_to_recordset(p_translation -> 'items') as given (recipe_ingredient_id uuid, item text);

  insert into public.recipe_protein_swap_translations (swap_id, locale, note)
  values (swap_row.id, target_locale, translated_note)
  on conflict (swap_id, locale) do update set note = excluded.note;
end;
$$;

revoke execute on function public.save_recipe_protein_swap_translation(jsonb) from public, anon, authenticated;
grant execute on function public.save_recipe_protein_swap_translation(jsonb) to service_role;

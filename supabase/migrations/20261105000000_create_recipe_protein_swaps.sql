-- AI protein swaps (D2): for a recipe a diet excludes, the ingredients to replace and what to use instead.
--
-- Generated on demand: the first request for a (recipe, diet) claims the row, the server asks the AI once,
-- validates the answer and saves it as 'ready'. Every later request reads the row, so a pair reaches the AI
-- at most once (again only if it failed, was rejected, or the recipe's ingredients changed).
-- The rules live in shared/utils/proteinSwap.ts (swapCacheDecision) and in claim_recipe_protein_swap() below;
-- keep the two in step.
--
-- status:  pending  claimed by one request that is generating it now (claimed_at)
--          ready    validated swap with its items
--          failed   the last generation failed; may be claimed again from retry_after
--          rejected a person marked it bad (by SQL for now); the next request regenerates it
--
-- Readable by signed-in users once ready; written only by the service role (server code).
-- Additive and safe for the previous app version, so run it before deploying the code that reads it.

-- An item points at an ingredient of the same recipe through (recipe_id, id).
alter table public.recipe_ingredients
  add constraint recipe_ingredients_recipe_id_id_key unique (recipe_id, id);

create table public.recipe_protein_swaps (
  id                    uuid primary key default gen_random_uuid(),
  recipe_id             uuid not null references public.recipes (id) on delete cascade,
  diet                  text not null,
  locale                text not null default 'lt',
  status                text not null default 'pending',
  claimed_at            timestamptz,
  attempts              smallint not null default 0,
  last_error            text,
  retry_after           timestamptz,
  note                  text,
  calories_kcal         numeric(7, 2),
  carbohydrates         numeric(7, 2),
  protein               numeric(7, 2),
  fat                   numeric(7, 2),
  nutrition_approximate boolean not null default true,
  source_hash           text,
  model                 text,
  prompt_version        smallint,
  generated_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint recipe_protein_swaps_pair_key unique (recipe_id, diet, locale),
  -- Lets an item prove it belongs to the same recipe as its swap.
  constraint recipe_protein_swaps_id_recipe_key unique (id, recipe_id),
  -- Every diet but full can exclude a protein (DIETS in shared/utils/diet.ts).
  constraint recipe_protein_swaps_diet_supported check (diet in ('vegetarian', 'fish', 'poultry', 'pork', 'beef')),
  constraint recipe_protein_swaps_locale_supported check (locale in ('lt', 'en')),
  constraint recipe_protein_swaps_status_supported check (status in ('pending', 'ready', 'failed', 'rejected')),
  constraint recipe_protein_swaps_attempts_non_negative check (attempts >= 0),
  constraint recipe_protein_swaps_macros_non_negative check (
    coalesce(calories_kcal, 0) >= 0
    and coalesce(carbohydrates, 0) >= 0
    and coalesce(protein, 0) >= 0
    and coalesce(fat, 0) >= 0
  ),
  constraint recipe_protein_swaps_pending_claimed check (status <> 'pending' or claimed_at is not null),
  constraint recipe_protein_swaps_failed_retry check (status <> 'failed' or retry_after is not null),
  constraint recipe_protein_swaps_ready_complete check (
    status <> 'ready'
    or (source_hash is not null and model is not null and prompt_version is not null and generated_at is not null)
  ),
  constraint recipe_protein_swaps_note_length check (note is null or char_length(note) <= 300)
);

comment on table public.recipe_protein_swaps is
  'AI protein swap per recipe, diet and locale (D2). Generated once on demand; see the migration header.';
comment on column public.recipe_protein_swaps.nutrition_approximate is
  'Macros are AI estimates for the swapped recipe, not recomputed from ingredient data.';
comment on column public.recipe_protein_swaps.source_hash is
  'Hash of the recipe ingredients and main proteins the swap was made from; a different hash makes it stale.';

create trigger recipe_protein_swaps_set_updated_at
  before update on public.recipe_protein_swaps
  for each row execute function public.set_updated_at();

create table public.recipe_protein_swap_items (
  swap_id              uuid not null,
  recipe_id            uuid not null,
  recipe_ingredient_id uuid not null,
  original_protein     text not null,
  item                 text not null,
  amount               numeric(8, 2),
  unit                 text,
  replacement_protein  text not null,
  primary key (swap_id, recipe_ingredient_id),
  foreign key (swap_id, recipe_id) references public.recipe_protein_swaps (id, recipe_id) on delete cascade,
  foreign key (recipe_id, recipe_ingredient_id) references public.recipe_ingredients (recipe_id, id) on delete cascade,
  -- PROTEINS in shared/utils/diet.ts, as recipes_main_proteins_supported.
  constraint recipe_protein_swap_items_original_protein_supported check (
    original_protein in ('egg_dairy', 'plant', 'fish', 'poultry', 'pork', 'beef', 'other_meat')
  ),
  constraint recipe_protein_swap_items_replacement_protein_supported check (
    replacement_protein in ('egg_dairy', 'plant', 'fish', 'poultry', 'pork', 'beef', 'other_meat')
  ),
  constraint recipe_protein_swap_items_item_length check (char_length(btrim(item)) between 1 and 120),
  -- Same rules as recipe_ingredients.
  constraint recipe_protein_swap_items_amount_positive check (amount is null or amount > 0),
  constraint recipe_protein_swap_items_amount_unit_together check ((amount is null) = (unit is null))
);

create index recipe_protein_swap_items_ingredient_idx
  on public.recipe_protein_swap_items (recipe_id, recipe_ingredient_id);

-- Row level security: signed-in users read ready swaps; nobody writes through the API.
alter table public.recipe_protein_swaps enable row level security;
alter table public.recipe_protein_swap_items enable row level security;

create policy "ready swaps are readable by authenticated users"
  on public.recipe_protein_swaps for select to authenticated
  using (status = 'ready');
create policy "items of ready swaps are readable by authenticated users"
  on public.recipe_protein_swap_items for select to authenticated
  using (exists (
    select 1 from public.recipe_protein_swaps s
    where s.id = swap_id and s.status = 'ready'
  ));

revoke all on public.recipe_protein_swaps from anon, authenticated;
revoke all on public.recipe_protein_swap_items from anon, authenticated;
grant select on public.recipe_protein_swaps to authenticated;
grant select on public.recipe_protein_swap_items to authenticated;

/*
 * Claims a pair for generation. Returns true for exactly one caller, which must then save the swap as ready
 * or mark it failed; false means another request is generating it or a stored swap is still good.
 * A pair can be claimed when it has no row, was rejected, failed and its retry time has come, was claimed
 * more than 2 minutes ago (the generating request died), or is ready but made from other ingredients or an
 * older prompt. The row lock taken by the upsert makes two concurrent claims serialise.
 */
create or replace function public.claim_recipe_protein_swap(
  p_recipe_id      uuid,
  p_diet           text,
  p_locale         text,
  p_source_hash    text,
  p_prompt_version smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.recipe_protein_swaps as s (recipe_id, diet, locale, status, claimed_at)
  values (p_recipe_id, p_diet, p_locale, 'pending', now())
  on conflict (recipe_id, diet, locale) do update
    set status = 'pending', claimed_at = now()
    where s.status = 'rejected'
       or (s.status = 'failed' and s.retry_after <= now())
       or (s.status = 'pending' and s.claimed_at < now() - interval '2 minutes')
       or (s.status = 'ready' and (s.source_hash is distinct from p_source_hash
                                   or s.prompt_version is distinct from p_prompt_version))
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

/*
 * Saves a validated swap and its items in one transaction and marks it ready. Takes the pair, the swap
 * fields and items: [{recipe_ingredient_id, original_protein, item, amount, unit, replacement_protein}].
 * Only a pending row (the caller's claim) is saved; anything else raises not_claimed.
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

revoke execute on function public.claim_recipe_protein_swap(uuid, text, text, text, smallint) from public, anon, authenticated;
revoke execute on function public.save_recipe_protein_swap(jsonb) from public, anon, authenticated;
grant execute on function public.claim_recipe_protein_swap(uuid, text, text, text, smallint) to service_role;
grant execute on function public.save_recipe_protein_swap(jsonb) to service_role;

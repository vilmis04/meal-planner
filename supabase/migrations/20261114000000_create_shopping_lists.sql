-- Shopping lists (G2): one list per meal plan, built from its slots, participants and snack options.
--
-- shopping_lists has one row per plan, made with the plan (a trigger on meal_plans) and for every plan that existed
-- before. The list is built on the server by the pure buildShoppingList() (shared/utils/shoppingList.ts) and written
-- here with apply_shopping_list_generation(). Whether the stored items are still what the plan needs is a version
-- number: anything that changes what the list needs (a slot's recipe, the participants, the snack options, a
-- participant's diet, a protein swap becoming ready or rejected) moves source_version, and the list is rebuilt
-- (by POST /api/plans/:id/shopping-list, when the list is opened) while generated_version is behind it.
--
-- shopping_items holds the lines. A generated line is keyed by generated_key (the canonical ingredient, or the
-- item's own spelling when it has no alias, plus the base unit; "to taste" lines have no unit), so a rebuild finds
-- the same line again. The columns a rebuild writes (name, category, amount, unit, is_extra, swapped_for, in_plan)
-- are kept apart from the ones people change (state, is_removed, amount_override; written by G4 and G5), and a
-- rebuild never touches the latter:
--   * a line the plan still needs is updated in place, keeping what people did with it;
--   * a line the plan no longer needs is deleted when nobody changed it, and otherwise kept with in_plan = false,
--     so it comes back as it was when the plan needs it again (bought stays bought, removed stays removed).
-- source = 'manual' lines (G4's own items) have no generated_key and are never touched by a rebuild.
--
-- Access follows the plan (can_access_meal_plan()): household members for a household plan, the owner for an
-- individual one. In G2 people can only read lists; G4 and G5 grant the updates for their columns.
--
-- Additive and re-runnable: tables, indexes and triggers are created if missing, functions are replaced, policies
-- are dropped and created, and the backfill skips plans that have a list. Nothing existing changes shape, so it can
-- run before the app deploy.

create table if not exists public.shopping_lists (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references public.meal_plans (id) on delete cascade,
  -- Moves whenever something the list is built from changes; starts ahead of generated_version, so a new list is
  -- built when it is first opened.
  source_version     bigint not null default 1,
  -- The source_version the stored items were built from.
  generated_version  bigint not null default 0,
  generated_at       timestamptz,
  -- Recipes in the list for which a participant's diet needs a protein swap that is not ready: their share follows
  -- the original recipe until it is (the swap becoming ready moves source_version).
  missing_swap_count integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint shopping_lists_plan_id_key unique (plan_id),
  constraint shopping_lists_versions_non_negative check (source_version >= 0 and generated_version >= 0),
  constraint shopping_lists_missing_swap_count_non_negative check (missing_swap_count >= 0)
);

comment on table public.shopping_lists is
  'One shopping list per meal plan (G2). Stale while generated_version < source_version.';

create table if not exists public.shopping_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.shopping_lists (id) on delete cascade,
  source          text not null default 'generated',
  -- Generated lines only: what a rebuild finds the line by, e.g. "ingredient:<uuid>|g" or "item:Kokosų pienas|ml".
  generated_key   text,
  -- The canonical ingredient; null for an item without an alias (shown under its own spelling) and manual lines.
  ingredient_id   uuid references public.ingredients (id) on delete set null,
  name            text not null,
  category        text not null,
  -- In the base unit (g, ml, or a unit counted on its own; see shared/utils/ingredientUnit.ts). Null with unit for
  -- a "to taste" line.
  amount          numeric(12, 2),
  unit            text,
  -- A "to taste" line: shown in the extras group, without an amount.
  is_extra        boolean not null default false,
  -- Participants whose protein swap brought this line (or part of it) onto the list, e.g. cod for a fish diet.
  swapped_for     uuid[] not null default '{}',
  -- False when the plan no longer needs a generated line that someone changed; kept so the change is not lost.
  in_plan         boolean not null default true,
  -- People's changes (G4, G5), never written by a rebuild.
  state           text not null default 'to_buy',
  is_removed      boolean not null default false,
  amount_override numeric(12, 2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint shopping_items_source_supported check (source in ('generated', 'manual')),
  constraint shopping_items_generated_key_with_source check ((source = 'generated') = (generated_key is not null)),
  constraint shopping_items_name_length check (char_length(btrim(name)) between 1 and 120),
  -- INGREDIENT_CATEGORIES in shared/utils/ingredient.ts, as ingredients_category_supported.
  constraint shopping_items_category_supported check (
    category in (
      'fruit_and_vegetables', 'meat_and_fish', 'dairy_and_eggs', 'grains_and_bread', 'pantry', 'frozen', 'other'
    )
  ),
  constraint shopping_items_amount_positive check (amount is null or amount > 0),
  constraint shopping_items_amount_unit_together check ((amount is null) = (unit is null)),
  constraint shopping_items_extra_without_amount check (not is_extra or amount is null),
  -- SHOPPING_ITEM_STATES in shared/utils/shoppingList.ts.
  constraint shopping_items_state_supported check (state in ('to_buy', 'have_at_home', 'bought')),
  constraint shopping_items_amount_override_positive check (amount_override is null or amount_override > 0)
);

create unique index if not exists shopping_items_list_generated_key_idx
  on public.shopping_items (list_id, generated_key)
  where generated_key is not null;
create index if not exists shopping_items_list_id_idx on public.shopping_items (list_id);
create index if not exists shopping_items_ingredient_id_idx on public.shopping_items (ingredient_id);

comment on table public.shopping_items is
  'Lines of a shopping list (G2). Rebuilds write the generated columns only; state, is_removed and amount_override '
  'are people''s changes (G4, G5).';

drop trigger if exists shopping_items_set_updated_at on public.shopping_items;
create trigger shopping_items_set_updated_at
  before update on public.shopping_items
  for each row execute function public.set_updated_at();

-- Who can see a list: whoever can open its plan. Security definer so the items' policy can ask without going through
-- shopping_lists' own RLS.
create or replace function public.can_access_shopping_list(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shopping_lists as lists
    where lists.id = target_list_id
      and public.can_access_meal_plan(lists.plan_id)
  );
$$;

revoke execute on function public.can_access_shopping_list(uuid) from public, anon;
grant execute on function public.can_access_shopping_list(uuid) to authenticated;

alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "shopping lists are readable with their plan" on public.shopping_lists;
create policy "shopping lists are readable with their plan"
  on public.shopping_lists for select to authenticated
  using (public.can_access_meal_plan(plan_id));

drop policy if exists "shopping items are readable with their list" on public.shopping_items;
create policy "shopping items are readable with their list"
  on public.shopping_items for select to authenticated
  using (public.can_access_shopping_list(list_id));

-- Read only for people in G2: lists are made by the trigger below and filled by apply_shopping_list_generation().
revoke all on public.shopping_lists from anon, authenticated;
revoke all on public.shopping_items from anon, authenticated;
grant select on public.shopping_lists to authenticated;
grant select on public.shopping_items to authenticated;

-- Marks the lists of these plans as out of date. Called by the triggers below only.
create or replace function public.mark_shopping_lists_stale(target_plan_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.shopping_lists
  set source_version = source_version + 1
  where plan_id = any (target_plan_ids);
$$;

revoke execute on function public.mark_shopping_lists_stale(uuid[]) from public, anon, authenticated;

-- A new plan gets its (empty, out of date) list in the same transaction.
create or replace function public.create_meal_plan_shopping_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shopping_lists (plan_id) values (new.id) on conflict (plan_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.create_meal_plan_shopping_list() from public, anon, authenticated;

drop trigger if exists meal_plans_create_shopping_list on public.meal_plans;
create trigger meal_plans_create_shopping_list
  after insert on public.meal_plans
  for each row execute function public.create_meal_plan_shopping_list();

-- Snack options: hidden snacks and "snacks off the list" both leave snack ingredients out.
create or replace function public.mark_plan_shopping_list_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_shopping_lists_stale(array[new.id]);
  return new;
end;
$$;

revoke execute on function public.mark_plan_shopping_list_stale() from public, anon, authenticated;

drop trigger if exists meal_plans_mark_shopping_list_stale on public.meal_plans;
create trigger meal_plans_mark_shopping_list_stale
  after update of include_snacks, snacks_on_list on public.meal_plans
  for each row
  when (old.include_snacks is distinct from new.include_snacks or old.snacks_on_list is distinct from new.snacks_on_list)
  execute function public.mark_plan_shopping_list_stale();

-- Slots: once per statement, so a generation writing twenty slots moves the version once. Locks (is_locked) and
-- notes (fill_note) do not change the list.
create or replace function public.mark_slot_shopping_lists_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_shopping_lists_stale(array(
    select distinct new_slots.plan_id
    from new_slots
    join old_slots on old_slots.id = new_slots.id
    where new_slots.recipe_id is distinct from old_slots.recipe_id
  ));
  return null;
end;
$$;

revoke execute on function public.mark_slot_shopping_lists_stale() from public, anon, authenticated;

drop trigger if exists meal_plan_slots_mark_shopping_list_stale on public.meal_plan_slots;
create trigger meal_plan_slots_mark_shopping_list_stale
  after update on public.meal_plan_slots
  referencing old table as old_slots new table as new_slots
  for each statement execute function public.mark_slot_shopping_lists_stale();

-- Participants: added or taken off (set_meal_plan_participants(), a member leaving the household). A trigger with
-- transition tables takes one event, so there is one per event.
create or replace function public.mark_participant_shopping_lists_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.mark_shopping_lists_stale(array(select distinct plan_id from new_participants));
  else
    perform public.mark_shopping_lists_stale(array(select distinct plan_id from old_participants));
  end if;
  return null;
end;
$$;

revoke execute on function public.mark_participant_shopping_lists_stale() from public, anon, authenticated;

drop trigger if exists meal_plan_participants_added_mark_shopping_list_stale on public.meal_plan_participants;
create trigger meal_plan_participants_added_mark_shopping_list_stale
  after insert on public.meal_plan_participants
  referencing new table as new_participants
  for each statement execute function public.mark_participant_shopping_lists_stale();

drop trigger if exists meal_plan_participants_removed_mark_shopping_list_stale on public.meal_plan_participants;
create trigger meal_plan_participants_removed_mark_shopping_list_stale
  after delete on public.meal_plan_participants
  referencing old table as old_participants
  for each statement execute function public.mark_participant_shopping_lists_stale();

-- A participant's diet decides which protein swap their share uses.
create or replace function public.mark_diet_shopping_lists_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_shopping_lists_stale(array(
    select plan_id from public.meal_plan_participants where user_id = new.id
  ));
  return new;
end;
$$;

revoke execute on function public.mark_diet_shopping_lists_stale() from public, anon, authenticated;

drop trigger if exists profiles_mark_shopping_list_stale on public.profiles;
create trigger profiles_mark_shopping_list_stale
  after update of diet on public.profiles
  for each row
  when (old.diet is distinct from new.diet)
  execute function public.mark_diet_shopping_lists_stale();

-- A protein swap that becomes ready (or stops being ready, or is regenerated) changes the lists of plans with its
-- recipe; until then a participant's share follows the original recipe.
create or replace function public.mark_swap_shopping_lists_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_shopping_lists_stale(array(
    select distinct plan_id from public.meal_plan_slots where recipe_id = new.recipe_id
  ));
  return new;
end;
$$;

revoke execute on function public.mark_swap_shopping_lists_stale() from public, anon, authenticated;

drop trigger if exists recipe_protein_swaps_ready_mark_shopping_list_stale on public.recipe_protein_swaps;
create trigger recipe_protein_swaps_ready_mark_shopping_list_stale
  after insert on public.recipe_protein_swaps
  for each row
  when (new.status = 'ready')
  execute function public.mark_swap_shopping_lists_stale();

drop trigger if exists recipe_protein_swaps_changed_mark_shopping_list_stale on public.recipe_protein_swaps;
create trigger recipe_protein_swaps_changed_mark_shopping_list_stale
  after update on public.recipe_protein_swaps
  for each row
  when (
    (old.status = 'ready') is distinct from (new.status = 'ready')
    or (new.status = 'ready' and old.generated_at is distinct from new.generated_at)
  )
  execute function public.mark_swap_shopping_lists_stale();

-- Writes a rebuilt list. based_on_version is the source_version read together with the plan; when it moved since
-- (someone changed the plan meanwhile), nothing is written and list_changed is raised, so the server builds again
-- from what is there now. Items is a JSON array of
--   {key, ingredient_id, name, category, amount, unit, is_extra, swapped_for}
-- as buildShoppingList() returns them. Only the generated columns are written; see the header for what happens to
-- lines the plan no longer needs. Someone else's plan reads as plan_not_found.
create or replace function public.apply_shopping_list_generation(
  target_plan_id uuid,
  based_on_version bigint,
  items jsonb,
  missing_swaps integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_list_id uuid;
  current_version bigint;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select id, source_version into target_list_id, current_version
  from public.shopping_lists
  where plan_id = target_plan_id
  for update;

  if target_list_id is null or not public.can_access_meal_plan(target_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
  if based_on_version is null or based_on_version <> current_version then
    raise exception 'list_changed' using errcode = 'P0001';
  end if;
  -- A plan of 14 days with four meals and a few dozen ingredients stays far below this.
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 2000 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if missing_swaps is null or missing_swaps < 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- The caller's lines, parsed once. Named in pg_temp explicitly, and dropped first in case an earlier call in the same
  -- transaction left it.
  if to_regclass('pg_temp.generated_lines') is not null then
    drop table pg_temp.generated_lines;
  end if;
  create temporary table pg_temp.generated_lines on commit drop as
  select
    line.key,
    line.ingredient_id,
    line.name,
    line.category,
    line.amount,
    line.unit,
    coalesce(line.is_extra, false) as is_extra,
    coalesce(array_remove(line.swapped_for, null), '{}') as swapped_for
  from jsonb_to_recordset(items) as line (
    key text,
    ingredient_id uuid,
    name text,
    category text,
    amount numeric,
    unit text,
    is_extra boolean,
    swapped_for uuid[]
  );

  if exists (select 1 from pg_temp.generated_lines where key is null or btrim(key) = '')
    or (select count(*) from pg_temp.generated_lines) <> (select count(distinct key) from pg_temp.generated_lines) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- The plan still needs these: insert new lines, update changed ones in place (people's columns stay).
  insert into public.shopping_items as items_table (
    list_id, source, generated_key, ingredient_id, name, category, amount, unit, is_extra, swapped_for, in_plan
  )
  select
    target_list_id, 'generated', lines.key, lines.ingredient_id, lines.name, lines.category,
    round(lines.amount, 2), lines.unit, lines.is_extra, lines.swapped_for, true
  from pg_temp.generated_lines as lines
  on conflict (list_id, generated_key) where generated_key is not null do update
  set ingredient_id = excluded.ingredient_id,
      name = excluded.name,
      category = excluded.category,
      amount = excluded.amount,
      unit = excluded.unit,
      is_extra = excluded.is_extra,
      swapped_for = excluded.swapped_for,
      in_plan = true
  where (items_table.ingredient_id, items_table.name, items_table.category, items_table.amount, items_table.unit,
         items_table.is_extra, items_table.swapped_for, items_table.in_plan)
    is distinct from
        (excluded.ingredient_id, excluded.name, excluded.category, excluded.amount, excluded.unit,
         excluded.is_extra, excluded.swapped_for, true);

  -- No longer needed and untouched: gone.
  delete from public.shopping_items as stored
  where stored.list_id = target_list_id
    and stored.source = 'generated'
    and stored.state = 'to_buy'
    and not stored.is_removed
    and stored.amount_override is null
    and not exists (select 1 from pg_temp.generated_lines as lines where lines.key = stored.generated_key);

  -- No longer needed but changed by someone: kept out of the plan, so the change comes back with the line.
  update public.shopping_items as stored
  set in_plan = false
  where stored.list_id = target_list_id
    and stored.source = 'generated'
    and stored.in_plan
    and not exists (select 1 from pg_temp.generated_lines as lines where lines.key = stored.generated_key);

  update public.shopping_lists
  set generated_version = current_version,
      generated_at = now(),
      missing_swap_count = missing_swaps
  where id = target_list_id;

  drop table pg_temp.generated_lines;
end;
$$;

revoke execute on function public.apply_shopping_list_generation(uuid, bigint, jsonb, integer) from public, anon;
grant execute on function public.apply_shopping_list_generation(uuid, bigint, jsonb, integer) to authenticated;

-- Plans made before G2 get their list, out of date so it is built when first opened.
insert into public.shopping_lists (plan_id)
select id from public.meal_plans
on conflict (plan_id) do nothing;

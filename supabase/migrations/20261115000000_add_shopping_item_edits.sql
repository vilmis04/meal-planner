-- Add, edit, remove and "have at home" items (G4).
--
-- People change a list with the functions below, one item and one field at a time, so two people changing different
-- items (or different fields of one item) never overwrite each other (G6 shares the list live). There are still no
-- table grants: every write goes through a function that checks the caller can open the plan
-- (can_access_shopping_list()) and reads as item_not_found / list_not_found otherwise.
--   * add_shopping_item() adds a manual line (source = 'manual'): a name, a category and an optional amount in a base
--     unit (g, ml, vnt., pakuotė; the app turns kg and l into g and ml with toBaseQuantity()). The app picks the id,
--     so a retried call adds the line once and the page keeps the id it already shows.
--   * set_shopping_item_amount() changes the amount. On a generated line it sets amount_override, in the line's own
--     unit, and setting the plan's amount again (or null) clears it. The override is what the person wants to buy and
--     a rebuild never touches it, so when the plan later needs more or less the override still wins; the page shows
--     the plan's amount next to it so the change is seen and can be undone. On a manual line it sets amount and unit.
--   * set_shopping_item_state() moves a line between to_buy and have_at_home (G5 shows bought).
--   * remove_shopping_item() removes a line: a generated line is only marked is_removed, so a rebuild does not bring
--     it back and restore_shopping_item() can undo it; a manual line is deleted, as nothing would bring it back, and
--     the app undoes that by adding it again with the same id.
-- shopping_items gains added_by, who added a manual line ("added by Monika" in the design).
--
-- Additive and re-runnable: the column is added if missing, functions are replaced, nothing existing changes shape,
-- so it can run before the app deploy.

alter table public.shopping_items
  add column if not exists added_by uuid references public.profiles (id) on delete set null;

comment on column public.shopping_items.added_by is
  'Who added a manual line (G4); null for generated lines and when that person''s profile is gone.';

-- The base units a manual line can be counted in; MANUAL_ITEM_STORED_UNITS in shared/utils/shoppingItemEdit.ts must
-- match. Lines with no amount have no unit.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopping_items'::regclass and conname = 'shopping_items_manual_unit_supported'
  ) then
    alter table public.shopping_items
      add constraint shopping_items_manual_unit_supported
      check (source <> 'manual' or unit is null or unit in ('g', 'ml', 'vnt.', 'pakuotė'));
  end if;
end;
$$;

-- The item, locked for this change, when the caller can open its list; item_not_found otherwise (an unknown item
-- and someone else's read the same). Used by the functions below only.
create or replace function public.lock_editable_shopping_item(target_item_id uuid)
returns public.shopping_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_item public.shopping_items;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into target_item
  from public.shopping_items
  where id = target_item_id
  for update;

  if target_item.id is null or not public.can_access_shopping_list(target_item.list_id) then
    raise exception 'item_not_found' using errcode = 'P0001';
  end if;
  return target_item;
end;
$$;

revoke execute on function public.lock_editable_shopping_item(uuid) from public, anon, authenticated;

-- The name as stored: trimmed, inner runs of white space as one space ("  Mixed   berries " → "Mixed berries").
create or replace function public.normalise_shopping_item_name(item_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(item_name, '\s+', ' ', 'g'));
$$;

revoke execute on function public.normalise_shopping_item_name(text) from public, anon, authenticated;

-- An amount people type: above zero, at most a tonne (or a thousand litres or pieces) in the base unit, which keeps
-- typos like 50000000 out, and two decimals as numeric(12, 2) stores.
create or replace function public.is_valid_shopping_item_amount(item_amount numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select item_amount is not null and round(item_amount, 2) > 0 and item_amount <= 1000000;
$$;

revoke execute on function public.is_valid_shopping_item_amount(numeric) from public, anon, authenticated;

-- Adds a manual line to a list the caller can open and returns its id. item_amount and item_unit come together or
-- not at all. Calling it again with an id that is already on this list changes nothing (a retry, or an undo that
-- already went through); an id used elsewhere is refused.
create or replace function public.add_shopping_item(
  target_list_id uuid,
  new_item_id uuid,
  item_name text,
  item_category text,
  item_amount numeric default null,
  item_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  stored_name text := public.normalise_shopping_item_name(item_name);
  existing_list_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if target_list_id is null or not public.can_access_shopping_list(target_list_id) then
    raise exception 'list_not_found' using errcode = 'P0001';
  end if;
  if new_item_id is null then
    raise exception 'invalid_item' using errcode = '22023';
  end if;
  if stored_name is null or char_length(stored_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if item_category is null or item_category not in (
    'fruit_and_vegetables', 'meat_and_fish', 'dairy_and_eggs', 'grains_and_bread', 'pantry', 'frozen', 'other'
  ) then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if (item_amount is null) <> (item_unit is null)
    or (item_amount is not null and not public.is_valid_shopping_item_amount(item_amount)) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if item_unit is not null and item_unit not in ('g', 'ml', 'vnt.', 'pakuotė') then
    raise exception 'invalid_unit' using errcode = '22023';
  end if;

  select list_id into existing_list_id from public.shopping_items where id = new_item_id;
  if existing_list_id is not null then
    if existing_list_id <> target_list_id then
      raise exception 'invalid_item' using errcode = '22023';
    end if;
    return new_item_id;
  end if;

  -- A list holds a few dozen lines; this only stops a runaway script.
  if (select count(*) from public.shopping_items where list_id = target_list_id and source = 'manual') >= 500 then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;

  insert into public.shopping_items (id, list_id, source, name, category, amount, unit, added_by)
  values (new_item_id, target_list_id, 'manual', stored_name, item_category, round(item_amount, 2), item_unit,
          current_user_id)
  on conflict (id) do nothing;

  return new_item_id;
end;
$$;

revoke execute on function public.add_shopping_item(uuid, uuid, text, text, numeric, text) from public, anon;
grant execute on function public.add_shopping_item(uuid, uuid, text, text, numeric, text) to authenticated;

-- Changes a line's amount (see the header). On a generated line new_unit must be the line's unit and new_amount null
-- or the plan's amount clears the override; a "to taste" line has no amount to change (amount_not_editable). On a
-- manual line both null clear the amount.
create or replace function public.set_shopping_item_amount(target_item_id uuid, new_amount numeric, new_unit text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
begin
  if new_amount is not null and not public.is_valid_shopping_item_amount(new_amount) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if target_item.source = 'generated' then
    if target_item.unit is null then
      raise exception 'amount_not_editable' using errcode = 'P0001';
    end if;
    if new_amount is not null and new_unit is distinct from target_item.unit then
      raise exception 'invalid_unit' using errcode = '22023';
    end if;
    update public.shopping_items
    set amount_override = case when round(new_amount, 2) = amount then null else round(new_amount, 2) end
    where id = target_item_id;
    return;
  end if;

  if (new_amount is null) <> (new_unit is null) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if new_unit is not null and new_unit not in ('g', 'ml', 'vnt.', 'pakuotė') then
    raise exception 'invalid_unit' using errcode = '22023';
  end if;
  update public.shopping_items
  set amount = round(new_amount, 2), unit = new_unit
  where id = target_item_id;
end;
$$;

revoke execute on function public.set_shopping_item_amount(uuid, numeric, text) from public, anon;
grant execute on function public.set_shopping_item_amount(uuid, numeric, text) to authenticated;

-- Moves a line to "have at home" or back to the list. Every state the column holds is accepted, so G5's bought needs
-- no new function; SHOPPING_ITEM_STATES in shared/utils/shoppingList.ts lists them.
create or replace function public.set_shopping_item_state(target_item_id uuid, new_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
begin
  if new_state is null or new_state not in ('to_buy', 'have_at_home', 'bought') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if target_item.state is distinct from new_state then
    update public.shopping_items set state = new_state where id = target_item_id;
  end if;
end;
$$;

revoke execute on function public.set_shopping_item_state(uuid, text) from public, anon;
grant execute on function public.set_shopping_item_state(uuid, text) to authenticated;

-- Removes a line: marks a generated one is_removed, deletes a manual one (see the header).
create or replace function public.remove_shopping_item(target_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
begin
  if target_item.source = 'manual' then
    delete from public.shopping_items where id = target_item_id;
  elsif not target_item.is_removed then
    update public.shopping_items set is_removed = true where id = target_item_id;
  end if;
end;
$$;

revoke execute on function public.remove_shopping_item(uuid) from public, anon;
grant execute on function public.remove_shopping_item(uuid) to authenticated;

-- Brings a removed generated line back. A manual line is deleted on removal, so it reads as item_not_found here.
create or replace function public.restore_shopping_item(target_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
begin
  if target_item.is_removed then
    update public.shopping_items set is_removed = false where id = target_item_id;
  end if;
end;
$$;

revoke execute on function public.restore_shopping_item(uuid) from public, anon;
grant execute on function public.restore_shopping_item(uuid) to authenticated;

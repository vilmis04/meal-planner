-- Record the shop (G7): where a bought line was bought.
--
-- shops are the places people buy at, shared within a household. A person in a household uses the household's shops
-- (for household plans and their own individual plans alike, since a person belongs to one household at most); a
-- person without one has shops of their own. A shop's name is stored as typed after trimming and folding inner white
-- space ("  Lidl   Žirmūnai " → "Lidl Žirmūnai"); name_key, its lower case, is unique per household (or person), so
-- "LIDL" typed later finds the "Lidl" someone typed first and the first spelling stays.
--
-- purchases holds one row per bought line: who ticked it, when, at which shop (optional: skipping it is allowed) and
-- the amount the line said to buy at that moment, so the page can say when the plan later needs more than was bought.
-- The row follows the line's state, in the same call that changes it, so the two can never disagree:
--   * set_shopping_item_state() (G4) gains an optional shop: ticking a line bought adds its purchase (at that shop,
--     when given), and moving it back to buy or home deletes the purchase;
--   * set_shopping_item_shop() sets or clears the shop of a line that is bought (picked after the tick).
-- A shop is given by name and found, or added, in the caller's household (or their own shops); the app suggests the
-- id of a shop it adds, as G4 does for lines, and the id actually stored is returned.
-- A purchase belongs to its line (a removed manual line takes it along) and is read with the list, by whoever can
-- open the plan; shops are read by the household's members (or their owner). Nobody writes either table directly.
-- purchases is added to the supabase_realtime publication, so the shop shows on every open copy of the list (G6).
--
-- Additive and re-runnable: tables, indexes and constraints are created if missing, functions are replaced (the old
-- two-argument set_shopping_item_state() is dropped for the one with an optional shop, which the previous app version
-- still calls the same way), policies are dropped and created, and the backfill skips lines that have a purchase. It
-- can run before the app deploy.

create table if not exists public.shops (
  id           uuid primary key default gen_random_uuid(),
  -- The household that shares the shop, or, for a person without a household, its owner. Exactly one is set.
  household_id uuid references public.households (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete cascade,
  name         text not null,
  name_key     text generated always as (lower(name)) stored,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint shops_one_owner check ((household_id is null) <> (user_id is null)),
  -- normalise_shopping_item_name(): trimmed, inner white space as one space. SHOP_NAME_MAX_LENGTH in shared/utils/shop.ts.
  constraint shops_name_normalised check (name = btrim(regexp_replace(name, '\s+', ' ', 'g'))),
  constraint shops_name_length check (char_length(name) between 1 and 60)
);

create unique index if not exists shops_household_name_key_idx
  on public.shops (household_id, name_key)
  where household_id is not null;
create unique index if not exists shops_user_name_key_idx
  on public.shops (user_id, name_key)
  where user_id is not null;

comment on table public.shops is
  'Where people buy (G7): a household''s shops, or a person''s own without a household. One per name_key in each.';

create table if not exists public.purchases (
  -- One purchase per bought line; it goes with the line.
  item_id    uuid primary key references public.shopping_items (id) on delete cascade,
  list_id    uuid not null references public.shopping_lists (id) on delete cascade,
  -- Null when the shopper skipped it, or the shop is gone.
  shop_id    uuid references public.shops (id) on delete set null,
  bought_by  uuid references public.profiles (id) on delete set null,
  bought_at  timestamptz not null default now(),
  -- What the line said to buy when it was ticked (the changed amount, else the plan's), in the line's unit. Null for a
  -- "to taste" line.
  amount     numeric(12, 2),
  unit       text,
  updated_at timestamptz not null default now(),
  constraint purchases_amount_unit_together check ((amount is null) = (unit is null)),
  constraint purchases_amount_positive check (amount is null or amount > 0)
);

create index if not exists purchases_list_id_idx on public.purchases (list_id);
create index if not exists purchases_shop_id_idx on public.purchases (shop_id);

comment on table public.purchases is
  'A bought shopping line (G7): at which shop (optional), by whom, when, and the amount it said to buy then. Exists '
  'exactly while the line is bought.';

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

alter table public.shops enable row level security;
alter table public.purchases enable row level security;

drop policy if exists "shops are readable by their household or owner" on public.shops;
create policy "shops are readable by their household or owner"
  on public.shops for select to authenticated
  using (
    (household_id is not null and public.is_household_member(household_id))
    or user_id = (select auth.uid())
  );

drop policy if exists "purchases are readable with their list" on public.purchases;
create policy "purchases are readable with their list"
  on public.purchases for select to authenticated
  using (public.can_access_shopping_list(list_id));

-- Read only: shops are added and purchases written by the functions below.
revoke all on public.shops from anon, authenticated;
revoke all on public.purchases from anon, authenticated;
grant select on public.shops to authenticated;
grant select on public.purchases to authenticated;

-- The shop with this name in the caller's household (or the caller's own shops, without a household), added when
-- there is none; null for no shop. suggested_shop_id is the id the app shows a new shop with; it is used for a new shop
-- when free, and the id stored is returned either way. Two people adding the same name at once get the same shop.
-- Used by the functions below only.
create or replace function public.find_or_add_shop(suggested_shop_id uuid, shop_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  stored_name text := public.normalise_shopping_item_name(shop_name);
  scope_household_id uuid;
  found_shop_id uuid;
  new_shop_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if shop_name is null then
    if suggested_shop_id is not null then
      raise exception 'invalid_shop' using errcode = '22023';
    end if;
    return null;
  end if;
  if stored_name is null or char_length(stored_name) not between 1 and 60 then
    raise exception 'invalid_shop_name' using errcode = '22023';
  end if;

  select household_id into scope_household_id from public.household_members where user_id = current_user_id;

  for attempt in 1..2 loop
    select id into found_shop_id
    from public.shops
    where name_key = lower(stored_name)
      and (
        (scope_household_id is not null and household_id = scope_household_id)
        or (scope_household_id is null and user_id = current_user_id)
      );
    if found_shop_id is not null then
      return found_shop_id;
    end if;
    -- The second round only looks again for the shop someone else just added under this name.
    exit when attempt = 2;

    -- A household uses a handful of shops; this only stops a runaway script.
    if (
      select count(*)
      from public.shops
      where (scope_household_id is not null and household_id = scope_household_id)
        or (scope_household_id is null and user_id = current_user_id)
    ) >= 200 then
      raise exception 'too_many_shops' using errcode = 'P0001';
    end if;

    new_shop_id := suggested_shop_id;
    if new_shop_id is null or exists (select 1 from public.shops where id = new_shop_id) then
      new_shop_id := gen_random_uuid();
    end if;
    insert into public.shops (id, household_id, user_id, name, created_by)
    values (
      new_shop_id,
      scope_household_id,
      case when scope_household_id is null then current_user_id end,
      stored_name,
      current_user_id
    )
    on conflict do nothing
    returning id into found_shop_id;
    if found_shop_id is not null then
      return found_shop_id;
    end if;
  end loop;

  raise exception 'invalid_shop' using errcode = 'P0001';
end;
$$;

revoke execute on function public.find_or_add_shop(uuid, text) from public, anon, authenticated;

-- G4's two-argument version; the version below takes the same two arguments and an optional shop.
drop function if exists public.set_shopping_item_state(uuid, text);

-- Moves a line between to_buy, have_at_home and bought (G4, G5) and keeps its purchase with it (see the header):
-- ticking it bought adds the purchase, at new_shop_name when given (null: no shop); moving it off bought deletes the
-- purchase. Ticking a bought line bought again with a shop sets that shop, without one leaves the purchase as it is.
-- Returns the purchase's shop id (null without a shop or a purchase).
create or replace function public.set_shopping_item_state(
  target_item_id uuid,
  new_state text,
  new_shop_id uuid default null,
  new_shop_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
  stored_shop_id uuid;
begin
  if new_state is null or new_state not in ('to_buy', 'have_at_home', 'bought') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if new_state <> 'bought' and (new_shop_id is not null or new_shop_name is not null) then
    raise exception 'invalid_shop' using errcode = '22023';
  end if;

  if new_state <> 'bought' then
    delete from public.purchases where item_id = target_item_id;
    if target_item.state is distinct from new_state then
      update public.shopping_items set state = new_state where id = target_item_id;
    end if;
    return null;
  end if;

  stored_shop_id := public.find_or_add_shop(new_shop_id, new_shop_name);
  if target_item.state = 'bought' then
    if new_shop_name is null then
      select shop_id into stored_shop_id from public.purchases where item_id = target_item_id;
      return stored_shop_id;
    end if;
    update public.purchases set shop_id = stored_shop_id where item_id = target_item_id;
    return stored_shop_id;
  end if;

  update public.shopping_items set state = 'bought' where id = target_item_id;
  insert into public.purchases (item_id, list_id, shop_id, bought_by, amount, unit)
  values (
    target_item_id,
    target_item.list_id,
    stored_shop_id,
    (select auth.uid()),
    coalesce(target_item.amount_override, target_item.amount),
    target_item.unit
  )
  on conflict (item_id) do update
  set shop_id = excluded.shop_id, bought_by = excluded.bought_by, bought_at = now(), amount = excluded.amount,
      unit = excluded.unit;
  return stored_shop_id;
end;
$$;

revoke execute on function public.set_shopping_item_state(uuid, text, uuid, text) from public, anon;
grant execute on function public.set_shopping_item_state(uuid, text, uuid, text) to authenticated;

-- Sets the shop of a bought line, found or added by name as above; a null name clears it. Returns the shop id (null
-- when cleared). A line that is not bought (any more) has no purchase to record it on: item_not_bought.
create or replace function public.set_shopping_item_shop(target_item_id uuid, new_shop_id uuid, new_shop_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.shopping_items := public.lock_editable_shopping_item(target_item_id);
  stored_shop_id uuid;
begin
  if target_item.state <> 'bought' then
    raise exception 'item_not_bought' using errcode = 'P0001';
  end if;
  stored_shop_id := public.find_or_add_shop(new_shop_id, new_shop_name);
  update public.purchases
  set shop_id = stored_shop_id
  where item_id = target_item_id and shop_id is distinct from stored_shop_id;
  return stored_shop_id;
end;
$$;

revoke execute on function public.set_shopping_item_shop(uuid, uuid, text) from public, anon;
grant execute on function public.set_shopping_item_shop(uuid, uuid, text) to authenticated;

-- Lines ticked bought before this migration get their purchase, without a shop or a shopper.
insert into public.purchases (item_id, list_id, bought_at, amount, unit)
select items.id, items.list_id, items.updated_at, coalesce(items.amount_override, items.amount), items.unit
from public.shopping_items as items
where items.state = 'bought'
on conflict (item_id) do nothing;

-- Live shops on bought lines (G6's publication); nothing changes without the publication or when it publishes every
-- table. Shops themselves are not published: the page reads them again when a purchase names one it does not know.
do $$
declare
  publication_publishes_all_tables boolean;
begin
  select puballtables into publication_publishes_all_tables
  from pg_catalog.pg_publication
  where pubname = 'supabase_realtime';

  if not found then
    raise notice 'No supabase_realtime publication: purchases are not published to Realtime (G7).';
    return;
  end if;
  if publication_publishes_all_tables then
    return;
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchases'
  ) then
    alter publication supabase_realtime add table public.purchases;
  end if;
end;
$$;

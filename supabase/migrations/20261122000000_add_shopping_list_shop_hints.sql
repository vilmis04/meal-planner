-- Store recommendations on the list (I1a): where each line of a list is usually bought, or was last bought.
--
-- get_shopping_list_shop_hints(target_list_id) looks, for every shown line of the list, at the purchases (G7) of the
-- same item on the caller's other lists: an item is its canonical ingredient (G1) when the line has one, else its name
-- in lower case, as in get_shop_insights() (I1). Only purchases with a shop count, and only the item's ten most recent
-- ones, so a change of habit shows within a few trips. With fewer than three, the line gets no hint. Otherwise:
--   * "usually": one shop has more than half of those purchases;
--   * "last": no shop has, so the hint is the shop of the most recent one.
-- The list's own purchases are left out, so ticking a line does not change the hints of the list being shopped.
--
-- History is the purchases table as it is: a purchase exists while its line is ticked bought, and every plan has a
-- list of its own, so the lines ticked on earlier plans' lists are the history. A line unticked again was not bought,
-- and leaves none.
--
-- It runs as the caller (security invoker), so row level security decides what counts, as on the list and in I1: the
-- purchases of plans the caller can open (their household's plans and their own individual plans, never another
-- member's individual plan) and the shops of their household (or their own). A purchase at a shop the caller cannot
-- read counts as one without a shop. Shops are grouped by name_key, so a person's own "Lidl" from before they joined a
-- household and the household's "Lidl" are one shop, named and identified as the household's. A list the caller
-- cannot open has no lines to give hints for.
--
-- Additive and re-runnable: the function is replaced. It can run before the app deploy.

create or replace function public.get_shopping_list_shop_hints(target_list_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  -- The ten most recent purchases of an item with a shop count, and it needs at least three for a hint (see above).
  with list_lines as (
    select
      items.id as item_id,
      coalesce('ingredient:' || items.ingredient_id::text, 'name:' || lower(items.name)) as item_key
    from public.shopping_items as items
    where items.list_id = target_list_id and items.in_plan and not items.is_removed
  ),
  history as (
    select
      coalesce('ingredient:' || items.ingredient_id::text, 'name:' || lower(items.name)) as item_key,
      shops.id as shop_id,
      shops.name_key as shop_key,
      shops.name as shop_name,
      shops.household_id is not null as is_household_shop,
      purchases.bought_at,
      purchases.item_id as purchase_id
    from public.purchases
    join public.shopping_items as items on items.id = purchases.item_id
    join public.shops on shops.id = purchases.shop_id
    where purchases.list_id <> target_list_id
  ),
  recent_history as (
    select *
    from (
      select
        history.*,
        row_number() over (partition by item_key order by bought_at desc, purchase_id) as recency
      from history
      where item_key in (select item_key from list_lines)
    ) as ranked
    where recency <= 10
  ),
  item_totals as (
    select item_key, count(*) as purchase_count
    from recent_history
    group by item_key
    having count(*) >= 3
  ),
  shop_names as (
    select
      shop_key,
      (array_agg(shop_id order by is_household_shop desc, shop_name))[1] as shop_id,
      (array_agg(shop_name order by is_household_shop desc, shop_name))[1] as shop_name
    from recent_history
    group by shop_key
  ),
  item_shop_totals as (
    select
      item_key,
      shop_key,
      count(*) as purchase_count,
      min(recency) as latest_recency
    from recent_history
    group by item_key, shop_key
  ),
  item_hints as (
    select
      item_totals.item_key,
      case when usual.purchase_count * 2 > item_totals.purchase_count then 'usually' else 'last' end as kind,
      case
        when usual.purchase_count * 2 > item_totals.purchase_count then usual.shop_key
        else (select shop_key from recent_history where item_key = item_totals.item_key and recency = 1)
      end as shop_key
    from item_totals
    cross join lateral (
      select shop_key, purchase_count
      from item_shop_totals
      where item_shop_totals.item_key = item_totals.item_key
      order by purchase_count desc, latest_recency
      limit 1
    ) as usual
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_id', list_lines.item_id,
        'kind', item_hints.kind,
        'shop_id', shop_names.shop_id,
        'shop_name', shop_names.shop_name
      )
      order by list_lines.item_id
    ),
    '[]'::jsonb
  )
  from list_lines
  join item_hints on item_hints.item_key = list_lines.item_key
  join shop_names on shop_names.shop_key = item_hints.shop_key;
$$;

revoke execute on function public.get_shopping_list_shop_hints(uuid) from public, anon;
grant execute on function public.get_shopping_list_shop_hints(uuid) to authenticated;

comment on function public.get_shopping_list_shop_hints(uuid) is
  'Store recommendations (I1a): for each shown line of a list, the shop its item is usually bought at, or was last '
  'bought at, from the caller''s purchases on other lists (at least three with a shop, the ten most recent).';

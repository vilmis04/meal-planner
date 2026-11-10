-- Shop insights (I1): where the viewer's household buys things, over a chosen range.
--
-- get_shop_insights(range_days) sums up the purchases (G7) the caller can read, bought in the last range_days days
-- (null: all of them): for each shop, how many lines were bought there and how many different items, and the items
-- bought there most often. Only purchases with a shop count towards a shop; those without one (skipped, or at a shop the
-- caller cannot read) are only counted, so the page can say they are left out.
--
-- It runs as the caller (security invoker), so row level security decides what is summed up, as on the list page:
-- purchases of the plans the caller can open (their household's plans and their own individual plans) and the shops of
-- their household (or their own, without one). Another member's individual plan, or another household's, is never seen.
-- A person who joined a household may still read shops of their own from before; shops are grouped by name_key, so
-- their "Lidl" and the household's "Lidl" are one shop, named as the household spells it.
--
-- An item is its canonical ingredient (G1) when the line has one, else its name in lower case (manual lines and lines
-- without an alias), and is named as it was spelled on the most recent of its lines.
--
-- Additive and re-runnable: the function is replaced. It can run before the app deploy.

create or replace function public.get_shop_insights(range_days integer default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- The items shown for each shop. SHOP_INSIGHT_TOP_ITEM_COUNT in app/utils/shopInsights.ts.
  top_item_count constant integer := 5;
  result jsonb;
begin
  -- SHOP_INSIGHT_RANGE_DAYS in app/utils/shopInsights.ts; ten years is plenty for "all time" to be null instead.
  if range_days is not null and range_days not between 1 and 3660 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  with visible_purchases as (
    select
      purchases.bought_at,
      shops.id as shop_id,
      shops.name_key as shop_key,
      shops.name as shop_name,
      shops.household_id is not null as is_household_shop,
      coalesce('ingredient:' || items.ingredient_id::text, 'name:' || lower(items.name)) as item_key,
      items.name as item_name
    from public.purchases
    join public.shopping_items as items on items.id = purchases.item_id
    left join public.shops on shops.id = purchases.shop_id
    where range_days is null or purchases.bought_at >= now() - make_interval(days => range_days)
  ),
  shop_totals as (
    select
      shop_key,
      (array_agg(shop_id order by is_household_shop desc, shop_name))[1] as shop_id,
      (array_agg(shop_name order by is_household_shop desc, shop_name))[1] as shop_name,
      count(*) as purchase_count,
      count(distinct item_key) as item_count
    from visible_purchases
    where shop_key is not null
    group by shop_key
  ),
  item_totals as (
    select
      shop_key,
      (array_agg(item_name order by bought_at desc))[1] as item_name,
      count(*) as purchase_count
    from visible_purchases
    where shop_key is not null
    group by shop_key, item_key
  ),
  ranked_items as (
    select
      shop_key,
      item_name,
      purchase_count,
      row_number() over (partition by shop_key order by purchase_count desc, item_name) as item_rank
    from item_totals
  )
  select jsonb_build_object(
    'shops', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', shop_totals.shop_id,
            'name', shop_totals.shop_name,
            'purchase_count', shop_totals.purchase_count,
            'item_count', shop_totals.item_count,
            'top_items', (
              select jsonb_agg(
                jsonb_build_object('name', ranked_items.item_name, 'purchase_count', ranked_items.purchase_count)
                order by ranked_items.item_rank
              )
              from ranked_items
              where ranked_items.shop_key = shop_totals.shop_key and ranked_items.item_rank <= top_item_count
            )
          )
          order by shop_totals.purchase_count desc, shop_totals.shop_name
        )
        from shop_totals
      ),
      '[]'::jsonb
    ),
    'without_shop_count', (select count(*) from visible_purchases where shop_key is null)
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.get_shop_insights(integer) from public, anon;
grant execute on function public.get_shop_insights(integer) to authenticated;

comment on function public.get_shop_insights(integer) is
  'Shop insights (I1): lines bought per shop and the most common items there, over the last range_days days (null: '
  'all), from the purchases the caller can read.';

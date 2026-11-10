-- Shop insights (I1): lines bought per shop over a range and the most common items there, from the purchases the
-- caller can read: their household's plans and their own individual plans, never another member's individual plan or
-- another household's. Purchases without a shop are only counted.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Other: Petras     Jonas has no household (until he joins Home below).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'petras@example.com', '{"full_name": "Petras"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f2', 'Other');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000003', 'owner');

insert into public.ingredients (id, name, category) values
  ('00000000-0000-0000-0000-0000000000a1', 'Insights chicken', 'meat_and_fish'),
  ('00000000-0000-0000-0000-0000000000a2', 'Insights milk', 'dairy_and_eggs');

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, anon;

create function pg_temp.list_id(plan_label text) returns uuid language sql stable as $$
  select id from public.shopping_lists where plan_id = (select id from created_plans where label = plan_label)
$$;
create function pg_temp.item_id(plan_label text, item_key text) returns uuid language sql stable as $$
  select id from public.shopping_items where list_id = pg_temp.list_id(plan_label) and generated_key = item_key
$$;
create function pg_temp.line(line_key text, line_name text, line_ingredient_id uuid default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object('key', line_key, 'ingredient_id', line_ingredient_id, 'name', line_name,
                            'category', 'other', 'amount', 1, 'unit', 'vnt.', 'is_extra', false)
$$;
create function pg_temp.generate(plan_label text, lines jsonb) returns void language sql as $$
  select public.apply_shopping_list_generation(
    (select id from created_plans where label = plan_label),
    (select source_version from public.shopping_lists where id = pg_temp.list_id(plan_label)),
    lines)
$$;
create function pg_temp.buy(plan_label text, item_key text, shop_id uuid, shop_name text) returns uuid
language sql as $$
  select public.set_shopping_item_state(pg_temp.item_id(plan_label, item_key), 'bought', shop_id, shop_name)
$$;
create function pg_temp.shop(shop_id text, shop_name text, purchase_count integer, item_count integer, top_items jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', shop_id, 'name', shop_name, 'purchase_count', purchase_count,
                            'item_count', item_count, 'top_items', top_items)
$$;
create function pg_temp.item(item_name text, purchase_count integer) returns jsonb language sql immutable as $$
  select jsonb_build_object('name', item_name, 'purchase_count', purchase_count)
$$;

set local role authenticated;

-- Ana: two household plans and one of her own.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created_plans values
  ('home_earlier', public.create_meal_plan('household', '2026-09-28', 3)),
  ('home_later', public.create_meal_plan('household', '2026-11-09', 3)),
  ('ana', public.create_meal_plan('individual', '2026-11-16', 3));
select pg_temp.generate('home_earlier', jsonb_build_array(
  pg_temp.line('chicken', 'Chicken', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('milk', 'Milk', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('eggs', 'Eggs'),
  pg_temp.line('salt', 'Salt')));
select pg_temp.generate('home_later', jsonb_build_array(
  pg_temp.line('chicken', 'Chicken thigh', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('eggs', 'EGGS')));
select pg_temp.generate('ana', jsonb_build_array(pg_temp.line('coffee', 'Coffee')));

select pg_temp.buy('home_earlier', 'chicken', '00000000-0000-0000-0000-00000000c001', 'Lidl');
select pg_temp.buy('home_earlier', 'milk', null, 'Lidl');
select pg_temp.buy('home_earlier', 'eggs', null, 'Lidl');
select pg_temp.buy('home_earlier', 'salt', null, null);
select pg_temp.buy('ana', 'coffee', '00000000-0000-0000-0000-00000000c002', 'Maxima');

-- Monika: the later household plan, and a plan of her own Ana cannot open.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into created_plans values ('monika', public.create_meal_plan('individual', '2026-11-16', 3));
select pg_temp.generate('monika', jsonb_build_array(pg_temp.line('bread', 'Bread')));
select pg_temp.buy('home_later', 'chicken', null, 'LIDL');
select pg_temp.buy('home_later', 'eggs', null, 'maxima');
select pg_temp.buy('monika', 'bread', '00000000-0000-0000-0000-00000000c003', 'Rimi');

-- Petras: six items at one shop of his household's, apples twice (spelled two ways, the earlier one a day ago).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
insert into created_plans values ('petras', public.create_meal_plan('individual', '2026-11-16', 3));
select pg_temp.generate('petras', jsonb_build_array(
  pg_temp.line('a', 'Apples'), pg_temp.line('b', 'Butter'), pg_temp.line('c', 'Carrots'),
  pg_temp.line('d', 'Dill'), pg_temp.line('e', 'Eggs'), pg_temp.line('f', 'Flour'), pg_temp.line('g', 'apples')));
select pg_temp.buy('petras', 'a', '00000000-0000-0000-0000-00000000c004', 'Lidl');
select pg_temp.buy('petras', item_key, null, 'Lidl') from unnest(array['b', 'c', 'd', 'e', 'f', 'g']) as item_key;

-- Jonas, still without a household: a plan of his own, at a shop of his own.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  '{"shops": [], "without_shop_count": 0}'::jsonb,
  'someone who bought nothing gets no shops');
insert into created_plans values ('jonas', public.create_meal_plan('individual', '2026-11-16', 3));
select pg_temp.generate('jonas', jsonb_build_array(pg_temp.line('tea', 'Tea')));
select pg_temp.buy('jonas', 'tea', '00000000-0000-0000-0000-00000000c005', 'LIDL');

-- The earlier household plan was shopped 40 days ago.
reset role;
update public.purchases set bought_at = now() - interval '40 days' where list_id = pg_temp.list_id('home_earlier');
update public.purchases set bought_at = now() - interval '1 day' where item_id = pg_temp.item_id('petras', 'a');
set local role authenticated;

-- Items per shop, all time (AC1, AC2)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  jsonb_build_object(
    'shops', jsonb_build_array(
      pg_temp.shop('00000000-0000-0000-0000-00000000c001', 'Lidl', 4, 3, jsonb_build_array(
        pg_temp.item('Chicken thigh', 2), pg_temp.item('Eggs', 1), pg_temp.item('Milk', 1))),
      pg_temp.shop('00000000-0000-0000-0000-00000000c002', 'Maxima', 2, 2, jsonb_build_array(
        pg_temp.item('Coffee', 1), pg_temp.item('EGGS', 1)))),
    'without_shop_count', 1),
  'Ana sees her household''s purchases and her own per shop, the most common items first, the line without a shop only '
  'counted');
select is(
  public.get_shop_insights(null),
  public.get_shop_insights(),
  'a null range is all time');
select is(
  public.get_shop_insights() #> '{shops,0,top_items,0,name}',
  '"Chicken thigh"'::jsonb,
  'lines of one ingredient are one item, named as its most recent line spells it');
select ok(
  public.get_shop_insights() #> '{shops,0,top_items}' @> '[{"name": "Eggs"}]'::jsonb
    and public.get_shop_insights() #> '{shops,1,top_items}' @> '[{"name": "EGGS"}]'::jsonb,
  'an item counts at the shop it was bought at');

-- A selectable range (AC1)
select is(
  public.get_shop_insights(30),
  jsonb_build_object(
    'shops', jsonb_build_array(
      pg_temp.shop('00000000-0000-0000-0000-00000000c002', 'Maxima', 2, 2, jsonb_build_array(
        pg_temp.item('Coffee', 1), pg_temp.item('EGGS', 1))),
      pg_temp.shop('00000000-0000-0000-0000-00000000c001', 'Lidl', 1, 1, jsonb_build_array(
        pg_temp.item('Chicken thigh', 1)))),
    'without_shop_count', 0),
  'the last 30 days leave out what was bought 40 days ago');
select is(
  (public.get_shop_insights(41) -> 'shops' -> 0 ->> 'purchase_count')::integer, 4,
  'the last 41 days take it in');
select throws_ok(
  $$ select public.get_shop_insights(0) $$, '22023', 'invalid_range', 'a range of no days is refused');
select throws_ok(
  $$ select public.get_shop_insights(3661) $$, '22023', 'invalid_range', 'a range of more than ten years is refused');

-- Only recorded purchases (AC3): unticking a line takes its purchase out
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('home_later', 'eggs')),
  'Ana unticks the eggs Monika bought at Maxima');
select is(
  public.get_shop_insights() -> 'shops' -> 1,
  pg_temp.shop('00000000-0000-0000-0000-00000000c002', 'Maxima', 1, 1, jsonb_build_array(pg_temp.item('Coffee', 1))),
  'they are no longer counted');
select lives_ok(
  format($$ select public.set_shopping_item_shop(%L, null, null) $$, pg_temp.item_id('home_earlier', 'milk')),
  'Ana clears the shop of the milk');
select results_eq(
  $$ select (public.get_shop_insights() #>> '{shops,0,purchase_count}')::integer,
            (public.get_shop_insights() ->> 'without_shop_count')::integer $$,
  $$ values (3, 2) $$,
  'it moves from Lidl to the purchases without a shop');

-- Household sharing
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  jsonb_build_object(
    'shops', jsonb_build_array(
      pg_temp.shop('00000000-0000-0000-0000-00000000c001', 'Lidl', 3, 2, jsonb_build_array(
        pg_temp.item('Chicken thigh', 2), pg_temp.item('Eggs', 1))),
      pg_temp.shop('00000000-0000-0000-0000-00000000c003', 'Rimi', 1, 1, jsonb_build_array(pg_temp.item('Bread', 1)))),
    'without_shop_count', 2),
  'Monika sees the household''s purchases and her own, not Ana''s individual plan');
select ok(
  not (public.get_shop_insights() -> 'shops') @> '[{"name": "Maxima"}]'::jsonb,
  'so Maxima, where only Ana''s own coffee was bought, is not hers to see');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  jsonb_build_object(
    'shops', jsonb_build_array(
      pg_temp.shop('00000000-0000-0000-0000-00000000c004', 'Lidl', 7, 6, jsonb_build_array(
        pg_temp.item('apples', 2), pg_temp.item('Butter', 1), pg_temp.item('Carrots', 1), pg_temp.item('Dill', 1),
        pg_temp.item('Eggs', 1)))),
    'without_shop_count', 0),
  'Petras sees only his own household''s Lidl, with its five most common items: lines without an ingredient are one '
  'item by their name whatever the case, spelled as the most recent one');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  jsonb_build_object(
    'shops', jsonb_build_array(
      pg_temp.shop('00000000-0000-0000-0000-00000000c005', 'LIDL', 1, 1, jsonb_build_array(pg_temp.item('Tea', 1)))),
    'without_shop_count', 0),
  'Jonas, without a household, sees his own shop');

-- Jonas joins Home: his own "LIDL" and the household's "Lidl" are one shop, named as the household spells it.
reset role;
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000004', 'member');
set local role authenticated;
select is(
  public.get_shop_insights() -> 'shops' -> 0,
  pg_temp.shop('00000000-0000-0000-0000-00000000c001', 'Lidl', 4, 3, jsonb_build_array(
    pg_temp.item('Chicken thigh', 2), pg_temp.item('Eggs', 1), pg_temp.item('Tea', 1))),
  'once in the household, Jonas''s own LIDL counts with the household''s Lidl');

-- A member who leaves stops seeing the household's purchases.
reset role;
delete from public.household_members where user_id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  public.get_shop_insights(),
  '{"shops": [], "without_shop_count": 1}'::jsonb,
  'Monika, out of the household, no longer reads its shops or purchases: her bread at its Rimi has no shop she can see');

-- Who may call it
select ok(
  not has_function_privilege('anon', 'public.get_shop_insights(integer)', 'execute'),
  'anon cannot call it');
select ok(
  has_function_privilege('authenticated', 'public.get_shop_insights(integer)', 'execute'),
  'signed-in people can');
select is(
  (select prosecdef from pg_catalog.pg_proc where oid = 'public.get_shop_insights(integer)'::regprocedure),
  false,
  'it runs as the caller, so row level security decides what it sums up');

select * from finish();
rollback;

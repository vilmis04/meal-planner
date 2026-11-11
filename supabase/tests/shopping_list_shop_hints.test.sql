-- Store recommendations on the list (I1a): for each shown line of a list, the shop its item is usually bought at (more
-- than half of its ten most recent purchases with a shop) or, without one, last bought at, once it has at least three;
-- from the caller's purchases on other lists, which row level security decides as on the list.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Other: Petras
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000003', 'petras@example.com', '{"full_name": "Petras"}');

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Home'),
  ('00000000-0000-0000-0000-0000000000f2', 'Other');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000003', 'owner');

insert into public.ingredients (id, name, category) values
  ('00000000-0000-0000-0000-0000000000a1', 'Hints milk', 'dairy_and_eggs'),
  ('00000000-0000-0000-0000-0000000000a2', 'Hints onion', 'fruit_and_vegetables');

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
-- The hint the caller gets for one line of a list, null without one.
create function pg_temp.hint(plan_label text, item_key text) returns jsonb language sql stable as $$
  select hint - 'item_id'
  from jsonb_array_elements(public.get_shopping_list_shop_hints(pg_temp.list_id(plan_label))) as hint
  where hint ->> 'item_id' = pg_temp.item_id(plan_label, item_key)::text
$$;
create function pg_temp.expected(hint_kind text, shop_id text, shop_name text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('kind', hint_kind, 'shop_id', shop_id, 'shop_name', shop_name)
$$;

set local role authenticated;

-- Ana: two earlier household plans, one of her own, and the household plan being shopped now.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created_plans values
  ('home_a', public.create_meal_plan('household', '2026-10-05', 3)),
  ('home_b', public.create_meal_plan('household', '2026-10-19', 3)),
  ('ana', public.create_meal_plan('individual', '2026-10-26', 3)),
  ('home_now', public.create_meal_plan('household', '2026-11-09', 3));
select pg_temp.generate('home_a', jsonb_build_array(
  pg_temp.line('milk', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('eggs', 'Eggs'), pg_temp.line('bread', 'Bread'), pg_temp.line('tea', 'Tea'),
  pg_temp.line('flour', 'Flour'), pg_temp.line('flour_bag', 'flour'),
  pg_temp.line('onion_1', 'Onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_2', 'Onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_3', 'Onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_4', 'Onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_5', 'Onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_6', 'Onion', '00000000-0000-0000-0000-0000000000a2')));
select pg_temp.generate('home_b', jsonb_build_array(
  pg_temp.line('milk', 'Milk 2.5%', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('eggs', 'EGGS'), pg_temp.line('bread', 'Bread'), pg_temp.line('tea', 'Tea'),
  pg_temp.line('flour', 'Flour'), pg_temp.line('flour_bag', 'Flour'),
  pg_temp.line('onion_7', 'Red onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_8', 'Red onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_9', 'Red onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_10', 'Red onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_11', 'Red onion', '00000000-0000-0000-0000-0000000000a2'),
  pg_temp.line('onion_12', 'Red onion', '00000000-0000-0000-0000-0000000000a2')));
select pg_temp.generate('ana', jsonb_build_array(
  pg_temp.line('milk', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('eggs', 'eggs'), pg_temp.line('bread', 'Bread')));
select pg_temp.generate('home_now', jsonb_build_array(
  pg_temp.line('milk', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('milk_removed', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('eggs', 'Eggs'), pg_temp.line('bread', 'Bread'), pg_temp.line('tea', 'Tea'),
  pg_temp.line('flour', 'Flour'), pg_temp.line('salt', 'Salt'),
  pg_temp.line('onion', 'Onion', '00000000-0000-0000-0000-0000000000a2')));

select is(
  public.get_shopping_list_shop_hints(pg_temp.list_id('home_now')),
  '[]'::jsonb,
  'a list without purchase history has no hints');

-- Milk at Lidl three times (spelled three ways); eggs at three shops; bread twice with a shop and once without; tea
-- twice; flour twice at Lidl, then twice at Maxima; onion six times at Maxima, then six times at Lidl.
select pg_temp.buy('home_a', 'milk', '00000000-0000-0000-0000-00000000c001', 'Lidl');
select pg_temp.buy('home_b', 'milk', null, 'LIDL');
select pg_temp.buy('ana', 'milk', null, 'lidl');
select pg_temp.buy('home_a', 'eggs', null, 'Lidl');
select pg_temp.buy('home_b', 'eggs', '00000000-0000-0000-0000-00000000c002', 'Maxima');
select pg_temp.buy('ana', 'eggs', '00000000-0000-0000-0000-00000000c003', 'Rimi');
select pg_temp.buy('home_a', 'bread', null, 'Lidl');
select pg_temp.buy('home_b', 'bread', null, 'Maxima');
select pg_temp.buy('ana', 'bread', null, null);
select pg_temp.buy('home_a', 'tea', null, 'Lidl');
select pg_temp.buy('home_b', 'tea', null, 'Lidl');
select pg_temp.buy('home_a', item_key, null, 'Lidl') from unnest(array['flour', 'flour_bag']) as item_key;
select pg_temp.buy('home_b', item_key, null, 'Maxima') from unnest(array['flour', 'flour_bag']) as item_key;
select pg_temp.buy('home_a', 'onion_' || line_number, null, 'Maxima') from generate_series(1, 6) as line_number;
select pg_temp.buy('home_b', 'onion_' || line_number, null, 'Lidl') from generate_series(7, 12) as line_number;
select public.remove_shopping_item(pg_temp.item_id('home_now', 'milk_removed'));

-- Monika: three teas at Rimi on a plan of her own, which Ana cannot open.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into created_plans values ('monika', public.create_meal_plan('individual', '2026-10-26', 3));
select pg_temp.generate('monika', jsonb_build_array(
  pg_temp.line('tea_1', 'Tea'), pg_temp.line('tea_2', 'Tea'), pg_temp.line('tea_3', 'Tea')));
select pg_temp.buy('monika', 'tea_' || line_number, null, 'Rimi') from generate_series(1, 3) as line_number;

-- Petras, in another household: milk three times at his household's Maxima.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
insert into created_plans values ('petras', public.create_meal_plan('individual', '2026-10-26', 3));
select pg_temp.generate('petras', jsonb_build_array(
  pg_temp.line('milk_1', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('milk_2', 'Milk', '00000000-0000-0000-0000-0000000000a1'),
  pg_temp.line('milk_3', 'Milk', '00000000-0000-0000-0000-0000000000a1')));
select pg_temp.buy('petras', 'milk_' || line_number, null, 'Maxima') from generate_series(1, 3) as line_number;
select is(
  public.get_shopping_list_shop_hints(pg_temp.list_id('home_now')),
  '[]'::jsonb,
  'someone outside the plan gets no hints for its list');

-- When each list was shopped: the onions of the first household plan longest ago, then that plan, the second one,
-- Ana's own and Monika's.
reset role;
update public.purchases set bought_at = now() - interval '30 days' where list_id = pg_temp.list_id('home_a');
update public.purchases set bought_at = now() - interval '40 days'
where item_id in (select id from public.shopping_items where list_id = pg_temp.list_id('home_a') and generated_key like 'onion_%');
update public.purchases set bought_at = now() - interval '20 days' where list_id = pg_temp.list_id('home_b');
update public.purchases set bought_at = now() - interval '10 days' where list_id = pg_temp.list_id('ana');
update public.purchases set bought_at = now() - interval '5 days' where list_id = pg_temp.list_id('monika');
set local role authenticated;

-- "Usually bought at" (AC1)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  pg_temp.hint('home_now', 'milk'),
  pg_temp.expected('usually', '00000000-0000-0000-0000-00000000c001', 'Lidl'),
  'an item bought at one shop three times is usually bought there, lines of one ingredient counted together and '
  'shops by name whatever the case');
select is(
  pg_temp.hint('home_now', 'onion'),
  pg_temp.expected('usually', '00000000-0000-0000-0000-00000000c001', 'Lidl'),
  'only the ten most recent purchases count: six at Lidl beat the four most recent of six at Maxima');

-- "Last bought at" (AC1)
select is(
  pg_temp.hint('home_now', 'eggs'),
  pg_temp.expected('last', '00000000-0000-0000-0000-00000000c003', 'Rimi'),
  'without a shop for more than half of the purchases, the hint is the most recent one''s shop (names whatever the '
  'case are one item)');
select is(
  pg_temp.hint('home_now', 'flour'),
  pg_temp.expected('last', '00000000-0000-0000-0000-00000000c002', 'Maxima'),
  'half is not usually: two at Lidl and two more recent at Maxima give the last shop');

-- Enough history (AC1)
select is(
  pg_temp.hint('home_now', 'bread'),
  null,
  'two purchases with a shop are not enough; one without a shop does not count');
select is(pg_temp.hint('home_now', 'salt'), null, 'an item never bought has no hint');
select is(
  (select count(*) from jsonb_array_elements(public.get_shopping_list_shop_hints(pg_temp.list_id('home_now'))) as hint
   where hint ->> 'item_id' = pg_temp.item_id('home_now', 'milk_removed')::text),
  0::bigint,
  'a removed line has no hint');
select is(
  jsonb_array_length(public.get_shopping_list_shop_hints(pg_temp.list_id('home_now'))),
  4,
  'the list has hints for milk, onion, eggs and flour only');

-- The list's own purchases are left out
select pg_temp.buy('home_now', 'eggs', null, 'Maxima');
select is(
  pg_temp.hint('home_now', 'eggs'),
  pg_temp.expected('last', '00000000-0000-0000-0000-00000000c003', 'Rimi'),
  'ticking a line of the list being shopped does not change its hints');
select is(
  pg_temp.hint('home_a', 'eggs'),
  pg_temp.expected('usually', '00000000-0000-0000-0000-00000000c002', 'Maxima'),
  'on another list, that purchase counts, and lines in any state get hints');
select public.set_shopping_item_state(pg_temp.item_id('home_now', 'eggs'), 'to_buy');
select is(
  pg_temp.hint('home_a', 'eggs'),
  null,
  'a line unticked again leaves no history');

-- Privacy follows row level security
select is(
  pg_temp.hint('home_now', 'tea'),
  null,
  'Ana''s two teas are not enough: Monika''s own plan is not counted for her');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  pg_temp.hint('home_now', 'tea'),
  pg_temp.expected('usually', '00000000-0000-0000-0000-00000000c003', 'Rimi'),
  'Monika''s hints count her own plan with the household''s: three teas at Rimi of five');
select is(
  pg_temp.hint('home_now', 'milk'),
  null,
  'Ana''s own plan never counts for Monika, nor does another household''s: two milks are not enough');

reset role;
set local role anon;
select throws_ok(
  'select public.get_shopping_list_shop_hints(gen_random_uuid())',
  '42501',
  null,
  'signed-out visitors cannot ask for hints');

select * from finish();
rollback;

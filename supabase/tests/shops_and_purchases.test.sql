-- Record the shop (G7): ticking a line bought adds its purchase, at a shop when one is given, in the same call;
-- moving it off bought deletes the purchase; the shop can be set or cleared afterwards; shops are found by name in the
-- caller's household (one per name, whatever the case and spacing) and shared by its members; nobody else reads them,
-- nor the purchases of a plan they cannot open, and nobody writes either table directly.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(50);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Other: Petras     Jonas has no household.
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

select case
  when exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    then ok(
      exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchases'
      ) or (select puballtables from pg_catalog.pg_publication where pubname = 'supabase_realtime'),
      'purchases is published to Realtime')
  else skip('there is no supabase_realtime publication in this database', 1)
end;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, anon;
insert into created_plans values
  ('home', public.create_meal_plan('household', '2026-11-09', 3)),
  ('own', public.create_meal_plan('individual', '2026-11-16', 3));

create function pg_temp.list_id(plan_label text) returns uuid language sql stable as $$
  select id from public.shopping_lists where plan_id = (select id from created_plans where label = plan_label)
$$;
create function pg_temp.item_id(item_key text) returns uuid language sql stable as $$
  select id from public.shopping_items where generated_key = item_key
$$;
create function pg_temp.line(line_key text, line_amount numeric, line_unit text) returns jsonb language sql immutable as $$
  select jsonb_build_object('key', line_key, 'name', line_key, 'category', 'other', 'amount', line_amount,
                            'unit', line_unit, 'is_extra', line_amount is null)
$$;
create function pg_temp.shop_of(item_key text) returns text language sql stable as $$
  select shops.name
  from public.purchases
  left join public.shops on shops.id = purchases.shop_id
  where purchases.item_id = pg_temp.item_id(item_key)
$$;
create function pg_temp.has_purchase(item_key text) returns boolean language sql stable as $$
  select exists (select 1 from public.purchases where item_id = pg_temp.item_id(item_key))
$$;

select public.apply_shopping_list_generation(
  (select id from created_plans where label = 'home'),
  (select source_version from public.shopping_lists where id = pg_temp.list_id('home')),
  jsonb_build_array(
    pg_temp.line('ingredient:chicken|g', 600, 'g'),
    pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.'),
    pg_temp.line('ingredient:milk|ml', 1000, 'ml'),
    pg_temp.line('ingredient:salt|', null, null)));
select public.apply_shopping_list_generation(
  (select id from created_plans where label = 'own'),
  (select source_version from public.shopping_lists where id = pg_temp.list_id('own')),
  jsonb_build_array(pg_temp.line('ingredient:coffee|g', 250, 'g')));

-- Ticking bought with a shop, or without one (AC1, AC2)
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:chicken|g'), 'bought', '00000000-0000-0000-0000-00000000c001',
                                 '  Lidl   Žirmūnai '),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'Ana ticks the chicken bought at a new shop, which keeps the id the app suggested');
select results_eq(
  $$ select name, name_key, household_id, user_id, created_by from public.shops $$,
  $$ values ('Lidl Žirmūnai', 'lidl žirmūnai', '00000000-0000-0000-0000-0000000000f1'::uuid, null::uuid,
             '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'the shop is stored trimmed with one space, belongs to the household and keys on its lower case');
select results_eq(
  $$ select state, purchases.bought_by, purchases.amount, purchases.unit, purchases.list_id
     from public.shopping_items join public.purchases on purchases.item_id = shopping_items.id
     where generated_key = 'ingredient:chicken|g' $$,
  $$ values ('bought', '00000000-0000-0000-0000-000000000001'::uuid, 600.00::numeric, 'g', pg_temp.list_id('home')) $$,
  'the line is bought and its purchase says who, what amount and which list');
select is(pg_temp.shop_of('ingredient:chicken|g'), 'Lidl Žirmūnai', 'the purchase is at that shop');
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:eggs|vnt.'), 'bought'), null,
  'the eggs are ticked bought without a shop (skipping it is allowed)');
select ok(pg_temp.has_purchase('ingredient:eggs|vnt.'), 'they still get a purchase');
select is(pg_temp.shop_of('ingredient:eggs|vnt.'), null, 'with no shop');
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:salt|'), 'bought'), null, 'a to-taste line is ticked bought');
select results_eq(
  $$ select amount, unit from public.purchases where item_id = pg_temp.item_id('ingredient:salt|') $$,
  $$ values (null::numeric, null::text) $$,
  'its purchase has no amount');
select lives_ok(
  format($$ select public.set_shopping_item_amount(%L, 1500, 'ml') $$, pg_temp.item_id('ingredient:milk|ml')),
  'Ana changes the milk to 1.5 l');
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:milk|ml'), 'bought', '00000000-0000-0000-0000-00000000c002',
                                 'LIDL žirmūnai'),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'ticking the milk at "LIDL žirmūnai" finds the shop Ana typed first, not a new one');
select is((select count(*) from public.shops)::integer, 1, 'there is still one shop');
select is(
  (select amount from public.purchases where item_id = pg_temp.item_id('ingredient:milk|ml')), 1500.00::numeric,
  'the purchase keeps the changed amount, which is what was bought');

-- Ticking bought again
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:chicken|g'), 'bought'),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'ticking a bought line bought again without a shop (a retry) keeps its shop');
select isnt(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:eggs|vnt.'), 'bought', null, 'Maxima'), null,
  'ticking the eggs bought again at Maxima adds Maxima with an id of its own and sets it');
select is(pg_temp.shop_of('ingredient:eggs|vnt.'), 'Maxima', 'the eggs are at Maxima now');

-- Setting the shop afterwards
select isnt(
  public.set_shopping_item_shop(pg_temp.item_id('ingredient:salt|'), null, 'Rimi'), null,
  'Ana records the salt at Rimi after ticking it');
select is(pg_temp.shop_of('ingredient:salt|'), 'Rimi', 'the salt is at Rimi');
select is(
  public.set_shopping_item_shop(pg_temp.item_id('ingredient:salt|'), null, null), null, 'and clears it again');
select ok(
  pg_temp.has_purchase('ingredient:salt|') and pg_temp.shop_of('ingredient:salt|') is null,
  'the salt is still bought, at no shop');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, null, 'Rimi') $$,
         (select id from public.shopping_items where generated_key is null)),
  'P0001', 'item_not_found', 'a line that does not exist reads as not found');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, null, '   ') $$, pg_temp.item_id('ingredient:salt|')),
  '22023', 'invalid_shop_name', 'a blank shop name is refused');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, null, %L) $$, pg_temp.item_id('ingredient:salt|'), repeat('x', 61)),
  '22023', 'invalid_shop_name', 'a shop name over 60 characters is refused');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, '00000000-0000-0000-0000-00000000c009', null) $$,
         pg_temp.item_id('ingredient:salt|')),
  '22023', 'invalid_shop', 'a shop id without a name is refused');
select throws_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy', null, 'Rimi') $$, pg_temp.item_id('ingredient:salt|')),
  '22023', 'invalid_shop', 'a shop only goes with ticking bought');

-- Un-buying deletes the purchase (state and purchase stay together)
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'Ana unticks the eggs');
select ok(not pg_temp.has_purchase('ingredient:eggs|vnt.'), 'their purchase is gone');
select ok(
  exists (select 1 from public.shops where name = 'Maxima'), 'the shop stays for the household to pick again');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, null, 'Maxima') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'P0001', 'item_not_bought', 'a line that is not bought has no purchase to record a shop on');
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'have_at_home') $$, pg_temp.item_id('ingredient:milk|ml')),
  'Ana moves the bought milk home');
select ok(not pg_temp.has_purchase('ingredient:milk|ml'), 'its purchase is gone too');
select is(
  (select count(*) from public.shopping_items where state = 'bought')::integer,
  (select count(*) from public.purchases)::integer,
  'every bought line has a purchase and no other line has one');

-- Rebuilds and removals
select public.apply_shopping_list_generation(
  (select id from created_plans where label = 'home'),
  (select source_version from public.shopping_lists where id = pg_temp.list_id('home')),
  jsonb_build_array(pg_temp.line('ingredient:chicken|g', 900, 'g'), pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.')));
select results_eq(
  $$ select shopping_items.amount, purchases.amount, shops.name
     from public.shopping_items
     join public.purchases on purchases.item_id = shopping_items.id
     join public.shops on shops.id = purchases.shop_id
     where generated_key = 'ingredient:chicken|g' $$,
  $$ values (900.00::numeric, 600.00::numeric, 'Lidl Žirmūnai') $$,
  'a rebuild keeps the purchase; the plan now needs 900 g and 600 g were bought');
select lives_ok(
  $$ select public.add_shopping_item(pg_temp.list_id('home'), '00000000-0000-0000-0000-00000000b001', 'Kava', 'pantry') $$,
  'Ana adds a manual line');
select lives_ok(
  $$ select public.set_shopping_item_state('00000000-0000-0000-0000-00000000b001', 'bought', null, 'Rimi') $$,
  'and ticks it bought at Rimi');
select lives_ok(
  $$ select public.remove_shopping_item('00000000-0000-0000-0000-00000000b001') $$, 'then removes it');
select ok(
  not exists (select 1 from public.purchases where item_id = '00000000-0000-0000-0000-00000000b001'),
  'its purchase goes with it');

-- Shops are shared within the household (AC3)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq(
  $$ select name from public.shops order by name $$,
  $$ values ('Lidl Žirmūnai'), ('Maxima'), ('Rimi') $$,
  'Monika sees the shops Ana added');
select is(
  public.set_shopping_item_state(pg_temp.item_id('ingredient:eggs|vnt.'), 'bought', '00000000-0000-0000-0000-00000000c003',
                                 'maxima'),
  (select id from public.shops where name = 'Maxima'), 'and buying the eggs at "maxima" uses the household''s Maxima');
select is(
  (select bought_by from public.purchases where item_id = pg_temp.item_id('ingredient:eggs|vnt.')),
  '00000000-0000-0000-0000-000000000002'::uuid, 'the purchase says Monika bought them');
select is(
  (select count(*) from public.purchases where list_id = pg_temp.list_id('own'))::integer, 0,
  'Monika reads no purchases of Ana''s individual plan');

-- Others see nothing
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is((select count(*) from public.shops)::integer, 0, 'Petras, of another household, reads none of Home''s shops');
select is((select count(*) from public.purchases)::integer, 0, 'nor any purchase');
select throws_ok(
  format($$ select public.set_shopping_item_shop(%L, null, 'Rimi') $$, pg_temp.item_id('ingredient:chicken|g')),
  'P0001', 'item_not_found', 'he cannot set the shop of a line of a plan he cannot open');
select throws_ok(
  $$ insert into public.shops (household_id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Iki') $$,
  '42501', null, 'nobody adds a shop directly');
select throws_ok(
  format($$ update public.purchases set shop_id = null where item_id = %L $$, pg_temp.item_id('ingredient:chicken|g')),
  '42501', null, 'nor changes a purchase directly');

-- Without a household, shops are one's own
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into created_plans values ('jonas', public.create_meal_plan('individual', '2026-11-09', 3));
select public.apply_shopping_list_generation(
  (select id from created_plans where label = 'jonas'),
  (select source_version from public.shopping_lists where id = pg_temp.list_id('jonas')),
  jsonb_build_array(pg_temp.line('ingredient:bread|vnt.', 1, 'vnt.')));
select lives_ok(
  $$ select public.set_shopping_item_state(pg_temp.item_id('ingredient:bread|vnt.'), 'bought', null, 'Maxima') $$,
  'Jonas, without a household, buys bread at his Maxima');
select results_eq(
  $$ select name, household_id, user_id from public.shops $$,
  $$ values ('Maxima', null::uuid, '00000000-0000-0000-0000-000000000004'::uuid) $$,
  'which is his own shop; he sees no household''s shops');

create temporary table known_items on commit drop as select pg_temp.item_id('ingredient:bread|vnt.') as id;
grant select on known_items to anon;
set local role anon;
select throws_ok(
  $$ select public.set_shopping_item_shop((select id from known_items), null, 'Rimi') $$,
  '42501', null, 'anonymous visitors cannot record a shop');

select * from finish();
rollback;

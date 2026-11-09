-- Crossing out bought items (G5): a line is ticked bought and back through set_shopping_item_state() (G4), bought
-- stays bought through rebuilds (also when the plan's amount changes or the plan stops and starts needing it), and
-- only people who can open the plan may tick it.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Fixtures, created as the migration owner.
--   Home:  Ana (owner), Monika     Jonas has no household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-000000000002', 'monika@example.com', '{"full_name": "Monika"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonas@example.com', '{"full_name": "Jonas"}');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Home');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'member');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated;
insert into created_plans values ('home', public.create_meal_plan('household', '2026-11-09', 3));

create function pg_temp.plan_id() returns uuid language sql stable as $$
  select id from created_plans where label = 'home'
$$;
create function pg_temp.list_id() returns uuid language sql stable as $$
  select id from public.shopping_lists where plan_id = pg_temp.plan_id()
$$;
create function pg_temp.source_version() returns bigint language sql stable as $$
  select source_version from public.shopping_lists where plan_id = pg_temp.plan_id()
$$;
create function pg_temp.item_id(item_key text) returns uuid language sql stable as $$
  select id from public.shopping_items where generated_key = item_key
$$;
create function pg_temp.state_of(item_key text) returns text language sql stable as $$
  select state from public.shopping_items where generated_key = item_key
$$;
create function pg_temp.line(line_key text, line_amount numeric, line_unit text) returns jsonb language sql immutable as $$
  select jsonb_build_object('key', line_key, 'name', line_key, 'category', 'other', 'amount', line_amount,
                            'unit', line_unit, 'is_extra', line_amount is null)
$$;
create function pg_temp.rebuild(lines jsonb) returns void language sql as $$
  select public.apply_shopping_list_generation(pg_temp.plan_id(), pg_temp.source_version(), lines)
$$;

select pg_temp.rebuild(jsonb_build_array(
  pg_temp.line('ingredient:chicken|g', 600, 'g'),
  pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.'),
  pg_temp.line('ingredient:salt|', null, null)));

-- Ticking a line bought and back (AC1)
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:chicken|g')),
  'Ana ticks the chicken bought');
select is(pg_temp.state_of('ingredient:chicken|g'), 'bought', 'it is stored as bought, not removed');
select is(
  (select is_removed from public.shopping_items where generated_key = 'ingredient:chicken|g'), false,
  'a bought line stays on the list');
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:chicken|g')),
  'ticking it bought again (a retry) is accepted');
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('ingredient:chicken|g')),
  'and it can be unticked');
select is(pg_temp.state_of('ingredient:chicken|g'), 'to_buy', 'it is to buy again');
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:salt|')),
  'a to-taste line can be ticked bought');
select lives_ok(
  $$ select public.add_shopping_item(pg_temp.list_id(), '00000000-0000-0000-0000-00000000b001', 'Kava', 'pantry') $$,
  'Ana adds a manual line');
select lives_ok(
  $$ select public.set_shopping_item_state('00000000-0000-0000-0000-00000000b001', 'bought') $$,
  'and ticks it bought');

-- Bought stays bought through rebuilds (AC1)
select pg_temp.rebuild(jsonb_build_array(pg_temp.line('ingredient:chicken|g', 600, 'g')));
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:chicken|g')),
  'the chicken is ticked bought again');
select lives_ok(
  $$ select pg_temp.rebuild(jsonb_build_array(
       pg_temp.line('ingredient:chicken|g', 900, 'g'),
       pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.'),
       pg_temp.line('ingredient:salt|', null, null))) $$,
  'the plan now needs more chicken and the list is rebuilt');
select results_eq(
  $$ select coalesce(generated_key, name), amount, state, in_plan from public.shopping_items order by source, generated_key $$,
  $$ values ('ingredient:chicken|g', 900.00::numeric, 'bought', true),
            ('ingredient:eggs|vnt.', 4.00, 'to_buy', true),
            ('ingredient:salt|', null, 'bought', true),
            ('Kava', null, 'bought', true) $$,
  'bought lines stay bought, with the plan''s new amount; the eggs (deleted while nobody had changed them) come back to buy');
select pg_temp.rebuild(jsonb_build_array(pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.')));
select results_eq(
  $$ select generated_key, state, in_plan from public.shopping_items where source = 'generated' order by generated_key $$,
  $$ values ('ingredient:chicken|g', 'bought', false), ('ingredient:eggs|vnt.', 'to_buy', true),
            ('ingredient:salt|', 'bought', false) $$,
  'a bought line the plan no longer needs is kept out of the plan, not lost');
select pg_temp.rebuild(jsonb_build_array(
  pg_temp.line('ingredient:chicken|g', 600, 'g'), pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.')));
select is(pg_temp.state_of('ingredient:chicken|g'), 'bought', 'and comes back bought when the plan needs it again');

-- Who can tick a line
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'Monika, a household member, ticks the eggs bought');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'P0001', 'item_not_found', 'Jonas cannot untick a line of a plan he cannot open');

create temporary table known_items on commit drop as select pg_temp.item_id('ingredient:eggs|vnt.') as id;
grant select on known_items to anon;
set local role anon;
select throws_ok(
  $$ select public.set_shopping_item_state((select id from known_items), 'bought') $$,
  '42501', null, 'anonymous visitors cannot tick a line');

select * from finish();
rollback;

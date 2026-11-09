-- Household shared list with live updates (G6): the list's tables are published to Realtime, the read policies that
-- Realtime checks for each subscriber let household members see a household plan's list and nobody else, and members
-- changing the list at the same time never overwrite each other's changes (different lines, or different fields of one
-- line), nor does a rebuild. Each list function locks the one line it changes and writes only its own fields, so two
-- calls on one line run one after the other and the second keeps the first's other fields.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

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

-- The publication Realtime reads changes from. Supabase always has it; a plain Postgres test database may not.
select case
  when exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    then ok(
      exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items'
      ) or (select puballtables from pg_catalog.pg_publication where pubname = 'supabase_realtime'),
      'shopping_items is published to Realtime')
  else skip('there is no supabase_realtime publication in this database', 1)
end;
select case
  when exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    then ok(
      exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_lists'
      ) or (select puballtables from pg_catalog.pg_publication where pubname = 'supabase_realtime'),
      'shopping_lists is published to Realtime')
  else skip('there is no supabase_realtime publication in this database', 1)
end;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated, anon;
insert into created_plans values
  ('home', public.create_meal_plan('household', '2026-11-09', 3)),
  ('own', public.create_meal_plan('individual', '2026-11-16', 3));

create function pg_temp.plan_id(plan_label text) returns uuid language sql stable as $$
  select id from created_plans where label = plan_label
$$;
create function pg_temp.list_id(plan_label text) returns uuid language sql stable as $$
  select id from public.shopping_lists where plan_id = pg_temp.plan_id(plan_label)
$$;
create function pg_temp.item_id(item_key text) returns uuid language sql stable as $$
  select id from public.shopping_items
  where generated_key = item_key and list_id = pg_temp.list_id('home')
$$;
create function pg_temp.line(line_key text, line_amount numeric, line_unit text) returns jsonb language sql immutable as $$
  select jsonb_build_object('key', line_key, 'name', line_key, 'category', 'other', 'amount', line_amount,
                            'unit', line_unit, 'is_extra', line_amount is null)
$$;
create function pg_temp.rebuild(plan_label text, lines jsonb) returns void language sql as $$
  select public.apply_shopping_list_generation(
    pg_temp.plan_id(plan_label),
    (select source_version from public.shopping_lists where plan_id = pg_temp.plan_id(plan_label)),
    lines)
$$;
create function pg_temp.people_columns() returns table (line text, state text, is_removed boolean, amount_override numeric)
language sql stable as $$
  select coalesce(generated_key, name), state, is_removed, amount_override
  from public.shopping_items
  where list_id = pg_temp.list_id('home')
  order by source, coalesce(generated_key, name)
$$;

select pg_temp.rebuild('home', jsonb_build_array(
  pg_temp.line('ingredient:chicken|g', 600, 'g'),
  pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.'),
  pg_temp.line('ingredient:milk|ml', 1000, 'ml'),
  pg_temp.line('ingredient:onion|g', 300, 'g')));
select pg_temp.rebuild('own', jsonb_build_array(pg_temp.line('ingredient:coffee|g', 250, 'g')));
select lives_ok(
  $$ select public.add_shopping_item(pg_temp.list_id('home'), '00000000-0000-0000-0000-00000000c001', 'Kava', 'pantry') $$,
  'Ana adds a manual line');

-- Who gets a list's changes: Realtime sends a change to a subscriber only when these reads would return it (AC1)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::integer from public.shopping_items where list_id = pg_temp.list_id('home')), 5,
  'Monika, a household member, reads every line of the household plan''s list');
select is(
  (select count(*)::integer from public.shopping_lists where plan_id = pg_temp.plan_id('home')), 1,
  'and the list itself, so she hears when the plan changes');
select is(
  (select count(*)::integer from public.shopping_items
   where list_id = (select lists.id from public.shopping_lists as lists
                    join created_plans on created_plans.id = lists.plan_id where created_plans.label = 'own')), 0,
  'but not the lines of Ana''s individual plan');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is(
  (select count(*)::integer from public.shopping_items), 0,
  'Jonas, outside the household, reads no lines');
select is(
  (select count(*)::integer from public.shopping_lists), 0,
  'nor any list');

set local role anon;
select throws_ok(
  $$ select count(*) from public.shopping_items $$,
  '42501', null, 'anonymous visitors cannot read lines at all');
set local role authenticated;

-- Members change the list at the same time (AC2, AC3)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:chicken|g')),
  'Monika ticks the chicken bought');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select state from public.shopping_items where id = pg_temp.item_id('ingredient:chicken|g')), 'bought',
  'Ana reads Monika''s tick');
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'bought') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'Ana ticks the eggs bought');
select lives_ok(
  format($$ select public.set_shopping_item_amount(%L, 800, 'g') $$, pg_temp.item_id('ingredient:chicken|g')),
  'and changes the amount of the chicken Monika ticked');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'have_at_home') $$, pg_temp.item_id('ingredient:milk|ml')),
  'Monika moves the milk home');
select lives_ok(
  format($$ select public.remove_shopping_item(%L) $$, pg_temp.item_id('ingredient:onion|g')),
  'and removes the onion');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_amount(%L, 500, 'g') $$, pg_temp.item_id('ingredient:onion|g')),
  'while Ana changes the onion''s amount');
select lives_ok(
  $$ select public.set_shopping_item_state('00000000-0000-0000-0000-00000000c001', 'bought') $$,
  'and ticks her coffee bought');

select results_eq(
  $$ select * from pg_temp.people_columns() $$,
  $$ values ('ingredient:chicken|g', 'bought', false, 800.00::numeric),
            ('ingredient:eggs|vnt.', 'bought', false, null),
            ('ingredient:milk|ml', 'have_at_home', false, null),
            ('ingredient:onion|g', 'to_buy', true, 500.00),
            ('Kava', 'bought', false, null) $$,
  'every change is kept: different lines, and different fields of the chicken and of the onion');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'Monika unticks the eggs Ana ticked');
select is(
  (select state from public.shopping_items where id = pg_temp.item_id('ingredient:eggs|vnt.')), 'to_buy',
  'the same field of the same line: the later change wins');

-- A rebuild by either member never writes people's columns (AC3)
select lives_ok(
  $$ select pg_temp.rebuild('home', jsonb_build_array(
       pg_temp.line('ingredient:chicken|g', 900, 'g'),
       pg_temp.line('ingredient:eggs|vnt.', 6, 'vnt.'),
       pg_temp.line('ingredient:milk|ml', 1500, 'ml'),
       pg_temp.line('ingredient:onion|g', 450, 'g'))) $$,
  'Monika''s page rebuilds the list after the plan changed');
select results_eq(
  $$ select * from pg_temp.people_columns() $$,
  $$ values ('ingredient:chicken|g', 'bought', false, 800.00::numeric),
            ('ingredient:eggs|vnt.', 'to_buy', false, null),
            ('ingredient:milk|ml', 'have_at_home', false, null),
            ('ingredient:onion|g', 'to_buy', true, 500.00),
            ('Kava', 'bought', false, null) $$,
  'everyone''s ticks, overrides, removals and the manual line are kept');
select results_eq(
  $$ select generated_key, amount from public.shopping_items
     where list_id = pg_temp.list_id('home') and source = 'generated' order by generated_key $$,
  $$ values ('ingredient:chicken|g', 900.00::numeric), ('ingredient:eggs|vnt.', 6.00),
            ('ingredient:milk|ml', 1500.00), ('ingredient:onion|g', 450.00) $$,
  'while the plan''s amounts follow the plan');

-- A member who leaves stops getting the list's changes at once
reset role;
select public.leave_household_for('00000000-0000-0000-0000-000000000002');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::integer from public.shopping_items) + (select count(*)::integer from public.shopping_lists), 0,
  'Monika, who left the household, reads none of its list any more');

select * from finish();
rollback;

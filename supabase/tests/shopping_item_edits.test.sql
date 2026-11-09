-- Add, edit, remove and "have at home" items (G4): the functions that change a list, what they accept, that a rebuild
-- keeps their changes, and that only people who can open the plan may use them.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(55);

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

select has_column('public', 'shopping_items', 'added_by', 'items remember who added a manual line');
select has_function('public', 'add_shopping_item', array['uuid', 'uuid', 'text', 'text', 'numeric', 'text'],
  'add_shopping_item() exists');

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
  pg_temp.line('ingredient:oats|g', 100, 'g'),
  pg_temp.line('ingredient:salt|', null, null)));

-- Adding a manual line (AC1)
select is(
  public.add_shopping_item(pg_temp.list_id(), '00000000-0000-0000-0000-00000000a001', '  Mixed   berries ',
    'fruit_and_vegetables', 300, 'g'),
  '00000000-0000-0000-0000-00000000a001'::uuid,
  'Ana adds a manual line and gets its id back');
select results_eq(
  $$ select source, name, category, amount, unit, state, in_plan, added_by, generated_key
     from public.shopping_items where id = '00000000-0000-0000-0000-00000000a001' $$,
  $$ values ('manual', 'Mixed berries', 'fruit_and_vegetables', 300.00::numeric, 'g', 'to_buy', true,
             '00000000-0000-0000-0000-000000000001'::uuid, null::text) $$,
  'it is stored with its name tidied, as a manual line Ana added');
select lives_ok(
  format($$ select public.add_shopping_item(%L, '00000000-0000-0000-0000-00000000a002', 'Kava', 'pantry') $$,
    pg_temp.list_id()),
  'a manual line may have no amount');
select is(
  public.add_shopping_item(pg_temp.list_id(), '00000000-0000-0000-0000-00000000a001', 'Other name', 'pantry'),
  '00000000-0000-0000-0000-00000000a001'::uuid,
  'adding the same id again is a retry');
select is(
  (select name from public.shopping_items where id = '00000000-0000-0000-0000-00000000a001'), 'Mixed berries',
  'and changes nothing');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), '   ', 'pantry') $$, pg_temp.list_id()),
  '22023', 'invalid_name', 'a name is needed');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), %L, 'pantry') $$, pg_temp.list_id(), repeat('a', 121)),
  '22023', 'invalid_name', 'a name is at most 120 characters');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'drinks') $$, pg_temp.list_id()),
  '22023', 'invalid_category', 'the category must be one of the list''s');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 0, 'g') $$, pg_temp.list_id()),
  '22023', 'invalid_amount', 'an amount is above zero');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 0.001, 'g') $$, pg_temp.list_id()),
  '22023', 'invalid_amount', 'and not rounded down to zero');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 2000000, 'g') $$, pg_temp.list_id()),
  '22023', 'invalid_amount', 'and at most a tonne');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 2, null) $$, pg_temp.list_id()),
  '22023', 'invalid_amount', 'an amount needs a unit');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 2, 'kg') $$, pg_temp.list_id()),
  '22023', 'invalid_unit', 'units are stored in their base unit (the app sends 2000 g)');
select throws_ok(
  format($$ select public.add_shopping_item(%L, gen_random_uuid(), 'Kava', 'pantry', 2, 'bags') $$, pg_temp.list_id()),
  '22023', 'invalid_unit', 'and must be one of the manual units');
select throws_ok(
  $$ select public.add_shopping_item('00000000-0000-0000-0000-0000000000aa', gen_random_uuid(), 'Kava', 'pantry') $$,
  'P0001', 'list_not_found', 'a list that does not exist is refused');

-- Changing an amount (AC1)
select lives_ok(
  format($$ select public.set_shopping_item_amount(%L, 800, 'g') $$, pg_temp.item_id('ingredient:chicken|g')),
  'Ana changes the chicken to 800 g');
select results_eq(
  format($$ select amount, amount_override from public.shopping_items where id = %L $$,
    pg_temp.item_id('ingredient:chicken|g')),
  $$ values (600.00::numeric, 800.00::numeric) $$,
  'a generated line keeps the plan''s amount and stores the change as an override');
select throws_ok(
  format($$ select public.set_shopping_item_amount(%L, 1, 'kg') $$, pg_temp.item_id('ingredient:chicken|g')),
  '22023', 'invalid_unit', 'a generated line keeps its unit');
select throws_ok(
  format($$ select public.set_shopping_item_amount(%L, -1, 'g') $$, pg_temp.item_id('ingredient:chicken|g')),
  '22023', 'invalid_amount', 'an amount is above zero');
select throws_ok(
  format($$ select public.set_shopping_item_amount(%L, 1, null) $$, pg_temp.item_id('ingredient:salt|')),
  'P0001', 'amount_not_editable', 'a to-taste line has no amount to change');
select lives_ok(
  format($$ select public.set_shopping_item_amount(%L, 4, 'vnt.') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'setting the plan''s amount again');
select is(
  (select amount_override from public.shopping_items where id = pg_temp.item_id('ingredient:eggs|vnt.')), null,
  'leaves no override');
select lives_ok(
  $$ select public.set_shopping_item_amount('00000000-0000-0000-0000-00000000a002', 2, 'pakuotė') $$,
  'a manual line gets an amount and a unit');
select results_eq(
  $$ select amount, unit, amount_override from public.shopping_items where id = '00000000-0000-0000-0000-00000000a002' $$,
  $$ values (2.00::numeric, 'pakuotė', null::numeric) $$,
  'stored as the line''s own amount');
select throws_ok(
  $$ select public.set_shopping_item_amount('00000000-0000-0000-0000-00000000a002', 2, null) $$,
  '22023', 'invalid_amount', 'a manual amount needs a unit');

-- Have at home (AC2)
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'have_at_home') $$, pg_temp.item_id('ingredient:oats|g')),
  'Ana has oats at home');
select is(
  (select state from public.shopping_items where id = pg_temp.item_id('ingredient:oats|g')), 'have_at_home',
  'the oats are at home');
select throws_ok(
  format($$ select public.set_shopping_item_state(%L, 'lost') $$, pg_temp.item_id('ingredient:oats|g')),
  '22023', 'invalid_state', 'only the list''s states are accepted');
select lives_ok(
  $$ select public.set_shopping_item_state('00000000-0000-0000-0000-00000000a002', 'have_at_home') $$,
  'manual lines can be at home too');

-- Removing (AC1)
select lives_ok(
  format($$ select public.remove_shopping_item(%L) $$, pg_temp.item_id('ingredient:salt|')),
  'Ana removes the salt');
select is(
  (select is_removed from public.shopping_items where id = pg_temp.item_id('ingredient:salt|')), true,
  'a generated line is only marked removed');
select lives_ok(
  format($$ select public.restore_shopping_item(%L) $$, pg_temp.item_id('ingredient:salt|')),
  'and can be brought back');
select is(
  (select is_removed from public.shopping_items where id = pg_temp.item_id('ingredient:salt|')), false,
  'it is on the list again');
select lives_ok(
  format($$ select public.remove_shopping_item(%L) $$, pg_temp.item_id('ingredient:salt|')),
  'Ana removes the salt again');
select lives_ok(
  $$ select public.add_shopping_item(pg_temp.list_id(), '00000000-0000-0000-0000-00000000a003', 'Napkins', 'other') $$,
  'Ana adds napkins');
select lives_ok(
  $$ select public.remove_shopping_item('00000000-0000-0000-0000-00000000a003') $$,
  'and removes them');
select is_empty(
  $$ select 1 from public.shopping_items where id = '00000000-0000-0000-0000-00000000a003' $$,
  'a manual line is deleted');
select throws_ok(
  $$ select public.restore_shopping_item('00000000-0000-0000-0000-00000000a003') $$,
  'P0001', 'item_not_found', 'so it cannot be restored, only added again');

-- Edits survive rebuilds (AC3)
reset role;
update public.meal_plans set snacks_on_list = false where id = pg_temp.plan_id();
set local role authenticated;
select lives_ok(
  $$ select pg_temp.rebuild(jsonb_build_array(
       pg_temp.line('ingredient:chicken|g', 900, 'g'),
       pg_temp.line('ingredient:eggs|vnt.', 6, 'vnt.'),
       pg_temp.line('ingredient:oats|g', 150, 'g'),
       pg_temp.line('ingredient:salt|', null, null))) $$,
  'the plan changes and the list is rebuilt with more of everything');
select results_eq(
  $$ select coalesce(generated_key, name), amount, amount_override, state, is_removed, in_plan
     from public.shopping_items order by source, generated_key, name $$,
  $$ values ('ingredient:chicken|g', 900.00::numeric, 800.00::numeric, 'to_buy', false, true),
            ('ingredient:eggs|vnt.', 6.00, null, 'to_buy', false, true),
            ('ingredient:oats|g', 150.00, null, 'have_at_home', false, true),
            ('ingredient:salt|', null, null, 'to_buy', true, true),
            ('Kava', 2.00, null, 'have_at_home', false, true),
            ('Mixed berries', 300.00, null, 'to_buy', false, true) $$,
  'the override, at home and removed stay; the plan''s amounts follow the plan; manual lines are kept');

reset role;
update public.meal_plans set snacks_on_list = true where id = pg_temp.plan_id();
set local role authenticated;
select lives_ok(
  $$ select pg_temp.rebuild(jsonb_build_array(pg_temp.line('ingredient:eggs|vnt.', 6, 'vnt.'))) $$,
  'a rebuild that no longer needs chicken, oats or salt');
select results_eq(
  $$ select generated_key, in_plan from public.shopping_items where source = 'generated' order by generated_key $$,
  $$ values ('ingredient:chicken|g', false), ('ingredient:eggs|vnt.', true), ('ingredient:oats|g', false),
            ('ingredient:salt|', false) $$,
  'edited lines are kept out of the plan rather than lost');

-- Who can change a list
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  format($$ select public.set_shopping_item_state(%L, 'to_buy') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'Monika, a household member, can change the household plan''s list');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.add_shopping_item(pg_temp.list_id(), gen_random_uuid(), 'Sneaky', 'other') $$,
  'P0001', 'list_not_found', 'Jonas cannot add to a list of a plan he cannot open');
select throws_ok(
  format($$ select public.set_shopping_item_amount(%L, 1, 'vnt.') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'P0001', 'item_not_found', 'nor change an amount');
select throws_ok(
  format($$ select public.set_shopping_item_state(%L, 'have_at_home') $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'P0001', 'item_not_found', 'nor mark it at home');
select throws_ok(
  format($$ select public.remove_shopping_item(%L) $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  'P0001', 'item_not_found', 'nor remove it');
select throws_ok(
  $$ select public.restore_shopping_item('00000000-0000-0000-0000-000000000000') $$,
  'P0001', 'item_not_found', 'an item that does not exist reads the same');

-- The individual plan's list is Ana's alone
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into created_plans values ('mine', public.create_meal_plan('individual', '2026-11-09', 1));
select lives_ok(
  $$ select public.add_shopping_item(
       (select id from public.shopping_lists where plan_id = (select id from created_plans where label = 'mine')),
       '00000000-0000-0000-0000-00000000a004', 'Tea', 'pantry') $$,
  'Ana adds to her individual list');
select throws_ok(
  $$ select public.add_shopping_item(pg_temp.list_id(), '00000000-0000-0000-0000-00000000a004', 'Tea', 'pantry') $$,
  '22023', 'invalid_item', 'an id already used on another list is refused');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_shopping_item('00000000-0000-0000-0000-00000000a004') $$,
  'P0001', 'item_not_found', 'Monika cannot change Ana''s individual list');

create temporary table known_lists on commit drop as select pg_temp.list_id() as id;
grant select on known_lists to anon;
set local role anon;
select throws_ok(
  $$ select public.add_shopping_item((select id from known_lists), gen_random_uuid(), 'Sneaky', 'other') $$,
  '42501', null, 'anonymous visitors cannot add');
reset role;
set local role authenticated;
select throws_ok(
  format($$ select public.lock_editable_shopping_item(%L) $$, pg_temp.item_id('ingredient:eggs|vnt.')),
  '42501', null, 'the helper that locks an item is not callable');

select * from finish();
rollback;

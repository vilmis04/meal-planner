-- Shopping lists (G2): one list per plan, the version that marks it out of date, apply_shopping_list_generation() and
-- what it keeps of people's changes, and who can read a list.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);

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

insert into public.recipes (id, name, meal_type, instructions, portion_days, main_proteins) values
  ('00000000-0000-0000-0000-0000000000e1', 'G2 test chicken stew', 'dinner', '', 2, '{poultry}'),
  ('00000000-0000-0000-0000-0000000000e2', 'G2 test porridge', 'breakfast', '', 1, '{egg_dairy}');
insert into public.recipe_ingredients (id, recipe_id, position, item, amount, unit) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 1, 'Vištienos filė', 300, 'g');

select has_table('public', 'shopping_lists', 'shopping lists exist');
select has_table('public', 'shopping_items', 'shopping items exist');
select col_is_unique('public', 'shopping_lists', 'plan_id', 'a plan has one list');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.shopping_lists'::regclass, 'public.shopping_items'::regclass)),
  'both tables have row level security');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated;
insert into created_plans values ('home', public.create_meal_plan('household', '2026-11-09', 3));

create function pg_temp.plan_id() returns uuid language sql stable as $$
  select id from created_plans where label = 'home'
$$;
create function pg_temp.slot_id(day integer, meal text) returns uuid language sql stable as $$
  select id from public.meal_plan_slots where plan_id = pg_temp.plan_id() and day_index = day and meal_type::text = meal
$$;
create function pg_temp.source_version() returns bigint language sql stable as $$
  select source_version from public.shopping_lists where plan_id = pg_temp.plan_id()
$$;
create function pg_temp.line(line_key text, line_amount numeric, line_unit text) returns jsonb language sql immutable as $$
  select jsonb_build_object('key', line_key, 'name', line_key, 'category', 'other', 'amount', line_amount,
                            'unit', line_unit, 'is_extra', line_amount is null)
$$;

-- One list per plan, made with it
select results_eq(
  $$ select count(*)::integer from public.shopping_lists where plan_id = pg_temp.plan_id() $$,
  $$ values (1) $$,
  'creating a plan creates its list');
select ok(
  (select generated_version < source_version from public.shopping_lists where plan_id = pg_temp.plan_id()),
  'a new list is out of date, so it is built when first opened');

-- What moves the version (AC1, AC2)
create temporary table versions (label text primary key, version bigint) on commit drop;
grant all on versions to authenticated;
insert into versions values ('start', pg_temp.source_version());

select public.set_meal_plan_slot(pg_temp.slot_id(0, 'dinner'), '00000000-0000-0000-0000-0000000000e1', 2);
select ok(pg_temp.source_version() > (select version from versions where label = 'start'),
  'choosing a recipe marks the list out of date');
insert into versions values ('slot', pg_temp.source_version());
select is(pg_temp.source_version() - (select version from versions where label = 'start'), 1::bigint,
  'a batch over two slots moves it once');

select public.set_meal_plan_slots_locked(array[pg_temp.slot_id(0, 'dinner'), pg_temp.slot_id(1, 'dinner')], false);
select is(pg_temp.source_version(), (select version from versions where label = 'slot'),
  'locking or unlocking does not change the list');

update public.meal_plans set snacks_on_list = false where id = pg_temp.plan_id();
select ok(pg_temp.source_version() > (select version from versions where label = 'slot'),
  'leaving snacks off the list marks it out of date');
insert into versions values ('snacks', pg_temp.source_version());
update public.meal_plans set snacks_on_list = true where id = pg_temp.plan_id();
select ok(pg_temp.source_version() > (select version from versions where label = 'snacks'),
  'putting snacks back marks it out of date again');
insert into versions values ('snacks back', pg_temp.source_version());
update public.meal_plans set include_snacks = false where id = pg_temp.plan_id();
select ok(pg_temp.source_version() > (select version from versions where label = 'snacks back'),
  'skipping snack slots marks it out of date');
insert into versions values ('skip snacks', pg_temp.source_version());

select public.set_meal_plan_participants(pg_temp.plan_id(), array['00000000-0000-0000-0000-000000000001'::uuid]);
select ok(pg_temp.source_version() > (select version from versions where label = 'skip snacks'),
  'taking a participant off marks it out of date');
insert into versions values ('one participant', pg_temp.source_version());
select public.set_meal_plan_participants(pg_temp.plan_id(),
  array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid]);
select ok(pg_temp.source_version() > (select version from versions where label = 'one participant'),
  'adding a participant marks it out of date');
insert into versions values ('two participants', pg_temp.source_version());

update public.profiles set diet = 'fish' where id = '00000000-0000-0000-0000-000000000001';
select ok(pg_temp.source_version() > (select version from versions where label = 'two participants'),
  'a participant changing their diet marks it out of date');
insert into versions values ('diet', pg_temp.source_version());

reset role;
insert into public.recipe_protein_swaps (id, recipe_id, diet, status, source_hash, model, prompt_version, generated_at)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'fish', 'ready', 'hash',
        'test-model', 1, now());
select ok(pg_temp.source_version() > (select version from versions where label = 'diet'),
  'a protein swap of a planned recipe becoming ready marks it out of date');
insert into versions values ('swap', pg_temp.source_version());
update public.recipe_protein_swaps set status = 'rejected' where id = '00000000-0000-0000-0000-0000000000d1';
select ok(pg_temp.source_version() > (select version from versions where label = 'swap'),
  'a ready swap being rejected marks it out of date');
insert into versions values ('swap rejected', pg_temp.source_version());
update public.recipe_protein_swaps set attempts = 1 where id = '00000000-0000-0000-0000-0000000000d1';
select is(pg_temp.source_version(), (select version from versions where label = 'swap rejected'),
  'other swap changes do not');

-- Writing a list
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, '[]') $$, pg_temp.plan_id(), pg_temp.source_version() - 1),
  'P0001', 'list_changed', 'a list built from an older version of the plan is refused');
select lives_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, %L, 1) $$, pg_temp.plan_id(), pg_temp.source_version(),
    jsonb_build_array(
      pg_temp.line('ingredient:chicken|g', 600, 'g'),
      pg_temp.line('ingredient:eggs|vnt.', 4, 'vnt.'),
      pg_temp.line('ingredient:oats|g', 100, 'g'),
      pg_temp.line('ingredient:salt|', null, null))),
  'Monika writes a list built from the current plan');
select results_eq(
  $$ select generated_key, amount, unit, is_extra, in_plan, state from public.shopping_items order by generated_key $$,
  $$ values ('ingredient:chicken|g', 600.00, 'g', false, true, 'to_buy'),
            ('ingredient:eggs|vnt.', 4.00, 'vnt.', false, true, 'to_buy'),
            ('ingredient:oats|g', 100.00, 'g', false, true, 'to_buy'),
            ('ingredient:salt|', null, null, true, true, 'to_buy') $$,
  'the lines are stored, the to-taste one as an extra without an amount');
select results_eq(
  $$ select generated_version = source_version, missing_swap_count from public.shopping_lists where plan_id = pg_temp.plan_id() $$,
  $$ values (true, 1) $$,
  'the list is up to date and remembers the swaps that were missing');

select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, %L) $$, pg_temp.plan_id(), pg_temp.source_version(),
    jsonb_build_array(pg_temp.line('same', 1, 'g'), pg_temp.line('same', 2, 'g'))),
  '22023', 'invalid_items', 'a key may appear once');
select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, '{}') $$, pg_temp.plan_id(), pg_temp.source_version()),
  '22023', 'invalid_items', 'the lines must be an array');
select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, %L) $$, pg_temp.plan_id(), pg_temp.source_version(),
    jsonb_build_array(pg_temp.line('bad', 1, null))),
  '23514', null, 'an amount needs a unit');

-- People's changes survive a rebuild (AC5). G4 and G5 will write these columns; here the owner does.
reset role;
update public.shopping_items set state = 'bought' where generated_key = 'ingredient:chicken|g';
update public.shopping_items set amount_override = 6 where generated_key = 'ingredient:eggs|vnt.';
update public.shopping_items set is_removed = true where generated_key = 'ingredient:salt|';
insert into public.shopping_items (list_id, source, name, category)
select id, 'manual', 'Kava', 'pantry' from public.shopping_lists where plan_id = pg_temp.plan_id();
update public.meal_plans set snacks_on_list = false where id = pg_temp.plan_id();

set local role authenticated;
select lives_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, %L) $$, pg_temp.plan_id(), pg_temp.source_version(),
    jsonb_build_array(pg_temp.line('ingredient:eggs|vnt.', 8, 'vnt.'), pg_temp.line('ingredient:milk|ml', 500, 'ml'))),
  'a rebuild without chicken, oats and salt, with more eggs and some milk');
select results_eq(
  $$ select coalesce(generated_key, name), amount, in_plan, state, is_removed, amount_override
     from public.shopping_items order by source, generated_key $$,
  $$ values ('ingredient:chicken|g', 600.00, false, 'bought', false, null::numeric),
            ('ingredient:eggs|vnt.', 8.00, true, 'to_buy', false, 6.00),
            ('ingredient:milk|ml', 500.00, true, 'to_buy', false, null),
            ('ingredient:salt|', null, false, 'to_buy', true, null),
            ('Kava', null, true, 'to_buy', false, null) $$,
  'changed lines stay (out of the plan when no longer needed), untouched ones go, new ones come, manual ones are kept');

reset role;
update public.meal_plans set snacks_on_list = true where id = pg_temp.plan_id();
set local role authenticated;
select lives_ok(
  format($$ select public.apply_shopping_list_generation(%L, %s, %L) $$, pg_temp.plan_id(), pg_temp.source_version(),
    jsonb_build_array(pg_temp.line('ingredient:chicken|g', 300, 'g'), pg_temp.line('ingredient:salt|', null, null))),
  'a rebuild that needs chicken and salt again');
select results_eq(
  $$ select generated_key, amount, in_plan, state, is_removed
     from public.shopping_items where source = 'generated' and generated_key <> 'ingredient:eggs|vnt.'
     order by generated_key $$,
  $$ values ('ingredient:chicken|g', 300.00, true, 'bought', false),
            ('ingredient:salt|', null::numeric, true, 'to_buy', true) $$,
  'lines that come back keep what people did with them; lines with nothing left go');
select is(
  (select count(*)::integer from public.shopping_items where generated_key = 'ingredient:eggs|vnt.'), 1,
  'the edited eggs stay, out of the plan');

reset role;
create temporary table item_times on commit drop as
select id, updated_at from public.shopping_items where generated_key = 'ingredient:chicken|g';
grant all on item_times to authenticated;
update public.meal_plans set snacks_on_list = false where id = pg_temp.plan_id();
set local role authenticated;
select public.apply_shopping_list_generation(pg_temp.plan_id(), pg_temp.source_version(),
  jsonb_build_array(pg_temp.line('ingredient:chicken|g', 300, 'g'), pg_temp.line('ingredient:salt|', null, null)));
select ok(
  (select items.updated_at = times.updated_at from public.shopping_items as items join item_times as times using (id)),
  'a line that did not change is not written again');

-- Who can read a list
select results_eq(
  $$ select count(*)::integer from public.shopping_items $$, $$ values (4) $$,
  'Monika, a household member, reads the household plan''s list');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is_empty($$ select 1 from public.shopping_lists $$, 'Jonas sees no list of a plan he cannot open');
select is_empty($$ select 1 from public.shopping_items $$, 'nor its items');
select throws_ok(
  format($$ select public.apply_shopping_list_generation(%L, 1, '[]') $$, pg_temp.plan_id()),
  'P0001', 'plan_not_found', 'Jonas cannot write it');
select throws_ok(
  $$ select public.apply_shopping_list_generation('00000000-0000-0000-0000-0000000000aa', 1, '[]') $$,
  'P0001', 'plan_not_found', 'a plan that does not exist reads the same');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.shopping_items (list_id, name, category, generated_key)
     select id, 'Sneaky', 'other', 'sneaky' from public.shopping_lists $$,
  '42501', null, 'items cannot be inserted directly');
select throws_ok(
  $$ update public.shopping_items set state = 'bought' $$,
  '42501', null, 'nor changed directly, until G4 and G5 allow their columns');
select throws_ok($$ delete from public.shopping_items $$, '42501', null, 'nor deleted');
select throws_ok(
  $$ update public.shopping_lists set generated_version = 99 $$,
  '42501', null, 'a list''s versions cannot be changed directly');
select throws_ok(
  $$ select public.mark_shopping_lists_stale(array[pg_temp.plan_id()]) $$,
  '42501', null, 'nor marked out of date by hand');

-- An individual plan's list is its owner's alone
insert into created_plans values ('mine', public.create_meal_plan('individual', '2026-11-09', 1));
select results_eq(
  $$ select count(*)::integer from public.shopping_lists where plan_id = (select id from created_plans where label = 'mine') $$,
  $$ values (1) $$,
  'an individual plan gets its list too');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.shopping_lists where plan_id = (select id from created_plans where label = 'mine') $$,
  'Monika cannot see Ana''s individual list');

set local role anon;
select throws_ok($$ select 1 from public.shopping_items $$, '42501', null, 'anonymous visitors read nothing');

-- Leaving the household takes Monika off the plan, which marks its list out of date
reset role;
insert into versions values ('before leaving', pg_temp.source_version());
delete from public.household_members where user_id = '00000000-0000-0000-0000-000000000002';
select ok(pg_temp.source_version() > (select version from versions where label = 'before leaving'),
  'a participant leaving the household marks the list out of date');

-- A recipe deleted from the library empties its slots, which marks the list out of date too
insert into versions values ('before delete', pg_temp.source_version());
delete from public.recipes where id = '00000000-0000-0000-0000-0000000000e1';
select ok(pg_temp.source_version() > (select version from versions where label = 'before delete'),
  'a planned recipe being deleted marks the list out of date');

-- Deleting the plan deletes its list and items
delete from public.meal_plans where id = pg_temp.plan_id();
select is_empty(
  format($$ select 1 from public.shopping_lists where plan_id = %L $$, pg_temp.plan_id()),
  'a deleted plan takes its list with it');
select is_empty(
  $$ select 1 from public.shopping_items where source = 'generated' $$,
  'and its items');

select * from finish();
rollback;

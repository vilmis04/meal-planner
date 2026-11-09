-- Lock, swap and regenerate (E5): meal_plan_slots.is_locked, set_meal_plan_slots_locked(), the lock a recipe chosen by
-- hand gets, and apply_meal_plan_generation() replacing unlocked recipes only.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(32);

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
  ('00000000-0000-0000-0000-0000000000e1', 'E5 test stew', 'dinner', '', 2, '{plant}'),
  ('00000000-0000-0000-0000-0000000000e2', 'E5 test salmon', 'dinner', '', 1, '{fish}'),
  ('00000000-0000-0000-0000-0000000000e3', 'E5 test porridge', 'breakfast', '', 1, '{egg_dairy}'),
  ('00000000-0000-0000-0000-0000000000e4', 'E5 test pancakes', 'breakfast', '', 1, '{egg_dairy}');

select has_column('public', 'meal_plan_slots', 'is_locked', 'slots have a lock');
select col_default_is('public', 'meal_plan_slots', 'is_locked', 'false', 'a new slot is not locked');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

create temporary table created_plans (label text primary key, id uuid) on commit drop;
grant all on created_plans to authenticated;
insert into created_plans values ('home', public.create_meal_plan('household', '2026-11-09', 3));
insert into created_plans values ('other', public.create_meal_plan('individual', '2026-11-09', 1));

create function pg_temp.slot_id(plan_label text, day integer, meal text) returns uuid language sql stable as $$
  select slots.id from public.meal_plan_slots as slots
  join created_plans on created_plans.id = slots.plan_id and created_plans.label = plan_label
  where slots.day_index = day and slots.meal_type::text = meal
$$;
create function pg_temp.slot_state(day integer, meal text) returns table (recipe_id uuid, is_locked boolean)
language sql stable as $$
  select recipe_id, is_locked from public.meal_plan_slots where id = pg_temp.slot_id('home', day, meal)
$$;

-- A recipe chosen by hand is locked
select public.set_meal_plan_slot(pg_temp.slot_id('home', 0, 'dinner'), '00000000-0000-0000-0000-0000000000e1', 2);
select results_eq(
  $$ select is_locked from public.meal_plan_slots
     where plan_id = (select id from created_plans where label = 'home') and meal_type = 'dinner' order by day_index $$,
  $$ values (true), (true), (false) $$,
  'a batch chosen by hand is locked on both days; the slots it does not fill are not');
select public.set_meal_plan_slot(pg_temp.slot_id('home', 2, 'dinner'), '00000000-0000-0000-0000-0000000000e2');
select public.set_meal_plan_slot(pg_temp.slot_id('home', 2, 'dinner'), null);
select results_eq(
  $$ select * from pg_temp.slot_state(2, 'dinner') $$, $$ values (null::uuid, false) $$,
  'an emptied slot is unlocked');

-- Locking and unlocking
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 0, 'dinner'), pg_temp.slot_id('home', 1, 'dinner')], false) $$,
  'Monika unlocks both days of the batch at once');
select results_eq(
  $$ select is_locked from public.meal_plan_slots
     where plan_id = (select id from created_plans where label = 'home') and meal_type = 'dinner' order by day_index $$,
  $$ values (false), (false), (false) $$,
  'both days are unlocked');
select lives_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 1, 'dinner')], true) $$,
  'a single filled slot can be locked');
select results_eq(
  $$ select * from pg_temp.slot_state(1, 'dinner') $$, $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, true) $$,
  'it is locked and keeps its recipe');
select lives_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 1, 'dinner'), pg_temp.slot_id('home', 1, 'dinner')], true) $$,
  'naming a slot twice is harmless');
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 0, 'breakfast')], true) $$,
  'P0001', 'slot_empty', 'an empty slot cannot be locked');
select lives_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 0, 'breakfast')], false) $$,
  'an empty slot can be unlocked');
select throws_ok(
  $$ select public.set_meal_plan_slots_locked('{}'::uuid[], true) $$,
  '22023', 'invalid_slots', 'at least one slot is named');
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 1, 'dinner'), null], true) $$,
  '22023', 'invalid_slots', 'a slot cannot be null');
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 1, 'dinner')], null) $$,
  '22023', 'invalid_slots', 'lock or unlock must be said');
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(
       array[pg_temp.slot_id('home', 1, 'dinner'), '00000000-0000-0000-0000-0000000000ff'], true) $$,
  'P0001', 'plan_not_found', 'an unknown slot reads as plan_not_found');
reset role;
-- Ana's own plan, which Monika cannot open, filled so that only access is in question.
update public.meal_plan_slots set recipe_id = '00000000-0000-0000-0000-0000000000e2'
where plan_id = (select id from created_plans where label = 'other') and meal_type = 'dinner';
-- Its slot id, read here because row level security hides the slot from Monika and Jonas.
create temporary table hidden_slot on commit drop as
  select id from public.meal_plan_slots where id = pg_temp.slot_id('other', 0, 'dinner');
create temporary table home_slot on commit drop as
  select id from public.meal_plan_slots where id = pg_temp.slot_id('home', 1, 'dinner');
grant select on hidden_slot, home_slot to authenticated;
set local role authenticated;
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[(select id from hidden_slot)], true) $$,
  'P0001', 'plan_not_found', 'Monika cannot lock a slot of Ana''s own plan');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 1, 'dinner'), pg_temp.slot_id('other', 0, 'dinner')], true) $$,
  '22023', 'invalid_slots', 'slots of two plans cannot be locked together');
select throws_ok(
  $$ update public.meal_plan_slots set is_locked = false $$,
  '42501', null, 'the lock cannot be changed directly');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array[(select id from home_slot)], false) $$,
  'P0001', 'plan_not_found', 'Jonas cannot unlock another household''s slot');
reset role;
set local role anon;
select throws_ok(
  $$ select public.set_meal_plan_slots_locked(array['00000000-0000-0000-0000-0000000000ff'::uuid], true) $$,
  '42501', null, 'anon cannot lock slots');
reset role;

-- Regenerating: unlocked recipes are replaced, locked ones refuse the write
-- Now: day 0 dinner stew (unlocked), day 1 dinner stew (locked), day 0 breakfast empty.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $$[
    {"day_index": 0, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e2", "note": "recently_planned",
     "previous_recipe_id": "00000000-0000-0000-0000-0000000000e1"},
    {"day_index": 0, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e3", "note": null,
     "previous_recipe_id": null}
  ]$$::jsonb),
  2,
  'a generated recipe replaces an unlocked one that is still what the server read');
select results_eq(
  $$ select * from pg_temp.slot_state(0, 'dinner') $$, $$ values ('00000000-0000-0000-0000-0000000000e2'::uuid, false) $$,
  'the slot holds the new recipe, unlocked');
select is(
  (select fill_note from public.meal_plan_slots where id = pg_temp.slot_id('home', 0, 'dinner')), 'recently_planned',
  'with the generator''s note');

select throws_ok(
  $$ select public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $j$[
    {"day_index": 1, "meal_type": "dinner", "recipe_id": "00000000-0000-0000-0000-0000000000e2", "note": null,
     "previous_recipe_id": "00000000-0000-0000-0000-0000000000e1"}
  ]$j$::jsonb) $$,
  'P0001', 'plan_changed', 'a locked slot is never written');
select throws_ok(
  $$ select public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $j$[
    {"day_index": 0, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e4", "note": null,
     "previous_recipe_id": "00000000-0000-0000-0000-0000000000e4"},
    {"day_index": 1, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e4", "note": null}
  ]$j$::jsonb) $$,
  'P0001', 'plan_changed', 'a slot that holds another recipe than the server read refuses the whole generation');
select is(
  (select recipe_id from public.meal_plan_slots where id = pg_temp.slot_id('home', 1, 'breakfast')), null,
  'and nothing of it is written');
select throws_ok(
  $$ select public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $j$[
    {"day_index": 0, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e4", "note": null}
  ]$j$::jsonb) $$,
  'P0001', 'plan_changed', 'without previous_recipe_id the slot must be empty, as E4''s app expects');
select throws_ok(
  $$ select public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $j$[
    {"day_index": 2, "meal_type": "dinner", "recipe_id": null, "note": null, "previous_recipe_id": 7}
  ]$j$::jsonb) $$,
  '22023', 'invalid_assignments', 'previous_recipe_id is a recipe id or null');

-- A locked slot whose recipe was deleted counts as open
reset role;
update public.meal_plan_slots set is_locked = true where id = pg_temp.slot_id('home', 0, 'breakfast');
delete from public.recipes where id = '00000000-0000-0000-0000-0000000000e3';
set local role authenticated;
select results_eq(
  $$ select * from pg_temp.slot_state(0, 'breakfast') $$, $$ values (null::uuid, true) $$,
  'deleting a recipe empties its slot and leaves the lock');
select is(
  public.apply_meal_plan_generation((select id from created_plans where label = 'home'), $$[
    {"day_index": 0, "meal_type": "breakfast", "recipe_id": "00000000-0000-0000-0000-0000000000e4", "note": null}
  ]$$::jsonb),
  1,
  'such a slot can be filled again');
select results_eq(
  $$ select * from pg_temp.slot_state(0, 'breakfast') $$, $$ values ('00000000-0000-0000-0000-0000000000e4'::uuid, false) $$,
  'and is unlocked once filled by the generator');

-- The lock does not move updated_at; what the plan holds is the same
reset role;
alter table public.meal_plans disable trigger meal_plans_set_updated_at;
update public.meal_plans set updated_at = '2026-01-01' where id = (select id from created_plans where label = 'home');
alter table public.meal_plans enable trigger meal_plans_set_updated_at;
set local role authenticated;
select public.set_meal_plan_slots_locked(array[pg_temp.slot_id('home', 0, 'dinner')], true);
select is(
  (select updated_at from public.meal_plans where id = (select id from created_plans where label = 'home')),
  '2026-01-01'::timestamptz,
  'locking a slot does not mark the shopping list out of date');

reset role;
select * from finish();
rollback;

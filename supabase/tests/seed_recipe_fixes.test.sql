-- Seeded recipe fixes (20261128000000_fix_seeded_recipe_contents.sql): recipes match their slides, counted items are
-- pieces, bread is slices, ids survive the fix, every text is in English and shopping lists of affected plans go stale.
-- Run with `supabase test db` against a local stack (see README, "Database tests").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- AC1: one recipe from each part of the change list has its slide's lines, macros and portion days.
select results_eq(
  $$ select ingredient.position::int, ingredient.item, ingredient.amount, ingredient.unit
     from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where recipe.meal_type = 'breakfast' and recipe.name = 'Plakti kiaušiniai su feta'
     order by ingredient.position $$,
  $$ values (1, 'Kiaušiniai'::text, 2.00::numeric, 'vnt.'::text), (2, 'Fetos sūris', 20.00, 'g'),
            (3, 'Pomidoras', 1.00, 'vnt.'), (4, 'Svogūnas', null, null), (5, 'Avokadas', 0.50, 'vnt.'),
            (6, 'Šviesios duonos riekelė', 1.00, 'vnt.'), (7, 'Druska', null, null), (8, 'Pipirai', null, null),
            (9, 'Švieži žalumynai', null, null), (10, 'Šviežios daržovės', null, null) $$,
  '5.1: Plakti kiaušiniai su feta has its slide lines, the lettuce gone');
select results_eq(
  $$ select calories_kcal, carbohydrates, protein, fat from public.recipes
     where meal_type = 'breakfast' and name = 'Plakti kiaušiniai su feta' $$,
  $$ values (400.00::numeric, 40.00::numeric, 26.00::numeric, 19.00::numeric) $$,
  '5.1: Plakti kiaušiniai su feta has its slide macros');
select results_eq(
  $$ select ingredient.item, ingredient.amount, ingredient.unit
     from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where recipe.meal_type = 'lunch' and recipe.name = 'Pomidorinis troškinys' and ingredient.position <= 4
     order by ingredient.position $$,
  $$ values ('Liesa jautienos malta mėsa'::text, 330.00::numeric, 'g'::text), ('Konservuoti pomidorai', 1.00, 'skardinė'),
            ('Ryžiai (sausi)', 80.00, 'g'), ('Raudonoji paprika', 1.00, 'vnt.') $$,
  '5.2: Pomidorinis troškinys has the slide amounts');
select results_eq(
  $$ select ingredient.item, ingredient.amount, ingredient.unit
     from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where recipe.meal_type = 'snack' and recipe.name = 'Pupelių brownie' and ingredient.position = 8 $$,
  $$ values ('Kokosų aliejus arba sviestas'::text, 12.50::numeric, 'g'::text) $$,
  '5.3: Pupelių brownie has its coconut oil (a quarter of the tray)');
select results_eq(
  $$ select ingredient.amount from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where recipe.meal_type = 'dinner' and recipe.name = 'Kugelio pusbrolis' and ingredient.item = 'Graikiškas jogurtas' $$,
  $$ values (140.00::numeric) $$,
  'U7: a 2-day recipe stores both portions of its serving yogurt');
select results_eq(
  $$ select name, portion_days::int from public.recipes
     where (meal_type, name) in (('lunch', 'Vištiena su bulvėmis orkaitėje'), ('lunch', 'Vištiena su morkomis ir grietinėle'))
     order by name $$,
  $$ values ('Vištiena su bulvėmis orkaitėje'::text, 2), ('Vištiena su morkomis ir grietinėle', 2) $$,
  '5.2 and 5.4: recipes the plans serve on two days are 2-day recipes');
select results_eq(
  $$ select calories_kcal from public.recipes where meal_type = 'dinner' and name = 'Lašiša su šviežių daržovių salotomis' $$,
  $$ values (530.00::numeric) $$,
  '2.3: the salmon salad has its worked-out calories');
select results_eq(
  $$ select name from public.recipes
     where name in ('Avinžirnių ir burokėlių salotos su feta', 'Burokėlių salotos su pupelėmis',
                    'Lašišos salotos su burokėliais ir medaus-citrinų padažu',
                    'Avinžirnių ir burokėlių salotas su feta', 'Burokėlių salotas su pupelėmis',
                    'Lašišos salotos su burokėlais ir medaus-citrinų padažu')
     order by name $$,
  $$ values ('Avinžirnių ir burokėlių salotos su feta'::text), ('Burokėlių salotos su pupelėmis'),
            ('Lašišos salotos su burokėliais ir medaus-citrinų padažu') $$,
  'the three name typos are fixed and the old names are gone');
select is_empty(
  $$ select id from public.recipes where meal_type = 'breakfast' and name = 'Avižinė košė su grūdėta varške' $$,
  'the recipe with no ingredients and no steps is deleted');
select is(
  (select count(*)::int from public.recipes
   where name in ('Pusryčių sumuštinis su avokadu ir kiaušiniais', 'Avižų košė', 'Grikiai su avokadu',
                  'Per naktį mirkytos avižos', 'Karšti sumuštiniai su rūkyta vištiena', 'Orkaitėje kepta pusryčių košė',
                  'Klasikinė šakšuka', 'Vištienos ir ryžių troškinukas', 'Makaronai su jautiena',
                  'Vištienos kotletukai su PikNik sūrio įdaru', 'Česnakinės krevetės su ryžiais',
                  'Varškės apkepas su obuoliais ir cinamonu', 'Sluoksniuotos salotos su vištiena', 'Kiaušinių keksiukai',
                  'Lašišos sriuba', 'Pats paprasčiausias tinginys', 'Keptas obuolys su varškės kremu',
                  'Iššūkio obuolių pyragas', 'Naminė granola', 'Pusryčių sumuštiniai su lašiša ir apelsinu',
                  'Granola su jogurtu, obuoliais ir cinamonu', 'Sumuštiniai su humusu ir kiaušiniu',
                  'Kiaušiniai su humusu, duona ir daržovėmis', 'Kavos jogurtas su granola ir uogomis', 'Varškėčiai',
                  'Kinietiška vištiena su daržovėmis', 'Varškėčiai su pievagrybių padažu', 'Kreminiai makaronai su lašiša',
                  'Vištienos ir bulvių salotos', 'Tuno salotos su jogurtiniu garstyčių padažu',
                  'Burokėlių sriuba su mėsos kukuliais', 'Vištienos sparneliai BBQ padaže',
                  'Pupelių troškinys su burata sūriu', 'Omletas', 'Grikiai su dviem kiaušiniais',
                  'Grikiai su kiaušiniu ir sviestu', 'Avižinė košė su bananu ir kiaušiniu', 'Grikiai su avokadu ir lašiša',
                  'Minkšti varškės vafliukai', 'Juodos duonos riekelė su plaktais kiaušiniais',
                  'Varškės pado pica su mocarela', 'Grūdėtos varškės salotos su lašiša')),
  42, '5.5: the 42 new recipes are present');
select is_empty(
  $$ select recipe.name from public.recipes recipe
     where not exists (select 1 from public.recipe_ingredients ingredient where ingredient.recipe_id = recipe.id) $$,
  'every recipe has ingredients');

-- AC2: counted items are pieces.
select results_eq(
  $$ select recipe.name, ingredient.amount, ingredient.unit
     from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where (recipe.name, ingredient.item) in (('Avokado duonelė', 'Avokadas'),
                                              ('Burokėlių salotos su pupelėmis', 'Virti/kepti burokėliai'),
                                              ('Avižinė košė su bananu ir riešutų sviestu', 'Bananas'),
                                              ('Agurkų sushi', 'Agurkas'))
     order by recipe.name $$,
  $$ values ('Agurkų sushi'::text, 1.00::numeric, 'vnt.'::text), ('Avižinė košė su bananu ir riešutų sviestu', 1.00, 'vnt.'),
            ('Avokado duonelė', 0.50, 'vnt.'), ('Burokėlių salotos su pupelėmis', 2.00, 'vnt.') $$,
  'U1: a count on the slide is stored in pieces, even where it also gave a weight');

-- AC3: bread is slices.
select is_empty(
  $$ select item from public.recipe_ingredients where unit = 'riekelė' $$,
  'U2: no line counts bread in the riekelė unit any more');
select is_empty(
  $$ select recipe.name, ingredient.item from public.recipe_ingredients ingredient
     join public.recipes recipe on recipe.id = ingredient.recipe_id
     where ingredient.item ilike '%duon%' and ingredient.item not ilike '%duonos riekelė'
       -- a choice of bread or buckwheat, and a snack whose slide has not been checked yet
       and ingredient.item <> 'Juoda duona arba grikiai (sausi)'
       and recipe.name <> 'Sumuštinis su kreminiu sūriu / avokadu ir paukštiena' $$,
  'U2: bread is a counted slice everywhere else');
select results_eq(
  $$ select alias.item, ingredient.name from public.ingredient_aliases alias
     join public.ingredients ingredient on ingredient.id = alias.ingredient_id
     where alias.item in ('Šviesios duonos riekelė', 'Juodos duonos riekelė', 'Tarkuotas LIGHT sūris')
     order by alias.item collate "C" $$,
  $$ values ('Juodos duonos riekelė'::text, 'Juoda duona'::text), ('Tarkuotas LIGHT sūris', 'Sūris light'),
            ('Šviesios duonos riekelė', 'Šviesi duona') $$,
  'slices map to their bread, light cheese is kept apart from cheese');

-- AC5: every text is in English.
select is_empty(
  $$ select kind, source_text, locale from public.missing_content_translations $$,
  'no recipe, line or ingredient is missing a translation');
select is_empty(
  $$ select item from public.unmapped_ingredient_items $$,
  'every item maps to a canonical ingredient');
select results_eq(
  $$ select translation.name from public.recipe_translations translation
     join public.recipes recipe on recipe.id = translation.recipe_id
     where translation.locale = 'en' and recipe.name = 'Klasikinė šakšuka' $$,
  $$ values ('Classic shakshuka'::text) $$,
  'a new recipe has its English name');

-- AC4 and AC6: running the fix again keeps recipe and line ids, and makes an affected plan's list stale.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
create temporary table fix_plan (id uuid) on commit drop;
insert into fix_plan values (public.create_meal_plan('individual', '2026-11-09', 3));
reset role;

update public.meal_plan_slots
set recipe_id = (select id from public.recipes where meal_type = 'breakfast' and name = 'Plakti kiaušiniai su feta')
where plan_id = (select id from fix_plan) and day_index = 0 and meal_type = 'breakfast';
update public.shopping_lists
set generated_version = source_version
where plan_id = (select id from fix_plan);

create temporary table fix_before on commit drop as
select recipe.id as recipe_id, ingredient.id as line_id
from public.recipes recipe
join public.recipe_ingredients ingredient on ingredient.recipe_id = recipe.id and ingredient.position = 1
where recipe.meal_type = 'breakfast' and recipe.name = 'Plakti kiaušiniai su feta';

\ir ../migrations/20261128000000_fix_seeded_recipe_contents.sql

select results_eq(
  $$ select recipe.id, ingredient.id
     from public.recipes recipe
     join public.recipe_ingredients ingredient on ingredient.recipe_id = recipe.id and ingredient.position = 1
     where recipe.meal_type = 'breakfast' and recipe.name = 'Plakti kiaušiniai su feta' $$,
  $$ select recipe_id, line_id from fix_before $$,
  'running the fix again keeps the recipe id and its line ids');
select ok(
  (select recipe_id is not null from public.meal_plan_slots
   where plan_id = (select id from fix_plan) and day_index = 0 and meal_type = 'breakfast'),
  'a meal plan slot on a fixed recipe keeps its recipe');
select ok(
  (select source_version > generated_version from public.shopping_lists where plan_id = (select id from fix_plan)),
  'the shopping list of a plan with a fixed recipe is stale, so it rebuilds');
select is(
  (select count(*)::int from public.recipes), 164, 'running the fix again adds nothing');

select * from finish();
rollback;

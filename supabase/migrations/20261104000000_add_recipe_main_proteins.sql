-- Recipe protein metadata (D1): the proteins that decide whether a recipe fits a diet.
-- The vocabulary is PROTEINS in shared/utils/diet.ts; the ladder (which diet allows which protein)
-- lives only there, and isRecipeCompatible() reads this column against it.
--
-- What is tagged: the meat or fish in the dish. A dish with chicken and some cheese is {poultry}.
-- egg_dairy or plant is tagged only when there is no meat or fish, so it never hides a meat.
-- Several tags mean the dish contains all of them (BLT: bacon and chicken).
-- Judgment calls are commented next to the recipe.
--
-- Additive and safe for the previous app version, so run it before deploying the code that reads it.
-- The column has no default once tagged: any later seed migration must set main_proteins itself.

alter table public.recipes
  add column main_proteins text[] not null default '{}';

comment on column public.recipes.main_proteins is
  'Proteins that decide diet fit (PROTEINS in shared/utils/diet.ts). Meat or fish if any, else egg_dairy or plant.';

-- egg_dairy: 59
update public.recipes
set main_proteins = '{egg_dairy}'
where (name, meal_type) in (
  ('Avižiniai keksiukai', 'breakfast'),
  ('Avižinė košė su grūdėta varške', 'breakfast'),
  ('Avižinė košė su kietuoju sūriu ir kiaušiniu', 'breakfast'),
  ('Avižinė košė su kivi ir jogurtu', 'breakfast'),
  ('Avižinė košė su vaisiais ir jogurtu', 'breakfast'),
  ('Avokado duonelė', 'breakfast'),
  ('Avokado sumuštiniai su keptais kiaušiniais', 'breakfast'),
  ('Chia pudingas', 'breakfast'),
  ('Grikiai su kiaušiniais', 'breakfast'),
  ('Grikiai su kiaušiniais ir pesto padažu', 'breakfast'),
  ('Grikių/bulgur košė su sūriu', 'breakfast'),
  ('Grūdėtos varškės paplotėliai su gvakamole', 'breakfast'),
  ('Juodos duonos sumuštinis su plaktais kiaušiniais', 'breakfast'),
  ('Kefyro blynai', 'breakfast'),
  ('Kiaušinienė su grūdėta varške', 'breakfast'),
  ('Minkšti vafliukai', 'breakfast'),
  ('Obuolinė granola', 'breakfast'),
  ('Perlinių kruopų košė', 'breakfast'),
  ('Plakti kiaušiniai su feta', 'breakfast'),
  ('Sumuštiniai su kiaušinių užtepėle', 'breakfast'),
  ('Sumuštinis su avokadu ir grūdėta varške', 'breakfast'),
  ('Tortilija su varške', 'breakfast'),
  ('Tortilijos suktinukas su kiaušiniais', 'breakfast'),
  ('Šokoladinė avižų košė', 'breakfast'),
  ('Graikiškos salotos', 'lunch'),
  ('Makaronai su pomidorų padažu ir feta', 'lunch'),
  ('Salotos su keptais batatais', 'lunch'),
  ('Avinžirnių ir burokėlių salotas su feta', 'dinner'),
  ('Brokolių ir kiaušinių sūrio keksiukai', 'dinner'),
  ('Burata salotos su citrininiu garstyčių padažu', 'dinner'),
  ('Burokėlių salotas su pupelėmis', 'dinner'),
  ('Grūdėtos varškės salotos', 'dinner'),
  ('Izraelietiška šakšuka', 'dinner'),
  ('Keptas varškės sūris', 'dinner'),
  ('Kugelio pusbrolis', 'dinner'),
  ('Mocarela sūrio salotos', 'dinner'),
  ('Orkaitėje kepti varškėčiai', 'dinner'),
  ('Pomidorų salotos su burrata sūriu', 'dinner'),
  ('Salotos su halloumi sūriu', 'dinner'),
  ('Trinta brokolių sriuba', 'dinner'),                  -- "Sultinys" read as vegetable broth
  ('Varškės apkepas su žalumynais', 'dinner'),
  ('Varškės bandelės orkaitėje', 'dinner'),
  ('Įdaryti kiaušiniai', 'dinner'),
  ('Baltyminiai sūreliai', 'snack'),
  ('Baltyminio pudingo desertas', 'snack'),              -- gelatin is not a main protein
  ('Burokėlių sriuba užkandžiui', 'snack'),              -- "Sultinys" read as vegetable broth
  ('Chia pudingas', 'snack'),
  ('Džiovintas varškės sūris', 'snack'),
  ('Džiugo sūris su daržovėmis', 'snack'),
  ('Grūdėta varškė', 'snack'),
  ('Kefyras', 'snack'),
  ('Kinder country desertas', 'snack'),
  ('Liesa varškė su uogomis/vaisiais', 'snack'),
  ('Naminiai bananiniai ledai', 'snack'),
  ('Natūralus jogurtas su uogomis ir riešutų sviestu', 'snack'),
  ('Obuolys su riešutiniu kremu', 'snack'),
  ('PikNik sūrio lazdelės su daržovėmis', 'snack'),
  ('Pusriebė varškė su uogomis/vaisiais', 'snack'),
  ('Varškės sūris su medumi ir uogomis', 'snack')
);

-- plant: 12
update public.recipes
set main_proteins = '{plant}'
where (name, meal_type) in (
  ('Avižinė košė su bananu ir riešutų sviestu', 'breakfast'),
  ('Sumuštiniai su humusu', 'breakfast'),
  ('Augalinės sočios salotos', 'lunch'),
  ('Tofu karis', 'lunch'),
  ('Trinta moliūgų sriuba', 'dinner'),                   -- "Sultinys" read as vegetable broth
  ('Humusas su daržovių lazdelėmis', 'snack'),
  ('Lęšių trapukai', 'snack'),
  ('Pupelių brownie', 'snack'),
  ('Riešutai ir juodasis šokoladas', 'snack'),
  ('Spragėsiai su druska', 'snack'),
  ('Trapučiai / tortilija su riešutų sviestu ir bananu', 'snack'),
  ('Vaisiai', 'snack')
);

-- fish: 24
update public.recipes
set main_proteins = '{fish}'
where (name, meal_type) in (
  ('Benedikto kiaušiniai', 'breakfast'),                 -- served with salmon
  ('Grikiai su avokadu ir rūkyta/sūdyta lašiša', 'breakfast'),
  ('Kruasanas su lašiša', 'breakfast'),
  ('Sumuštinis su lašišos užtepėle', 'breakfast'),
  ('Cukinijų ir varškės blyneliai', 'lunch'),            -- served with salmon
  ('Kapoti menkės kepsniukai su bulvių koše', 'lunch'),
  ('Krevetės su ryžiais', 'lunch'),
  ('Lašišos kepsnys', 'lunch'),
  ('Lašišos kepsnys su keptomis daržovėmis', 'lunch'),
  ('Lydekos kepsneliai', 'lunch'),
  ('Makaronai su krevetėmis', 'lunch'),
  ('Makaronai su tunu', 'lunch'),
  ('Pica', 'lunch'),                                     -- smoked salmon topping
  ('Plovas su lašiša', 'lunch'),
  ('Spageti su lašiša citrinų padaže', 'lunch'),
  ('Tuno ir avinžirnių salotos su feta sūriu', 'lunch'),
  ('Jūrų lydeka su daržovėmis', 'dinner'),
  ('Lašiša su šviežių daržovių salotomis', 'dinner'),
  ('Lašišos salotos su burokėlais ir medaus-citrinų padažu', 'dinner'),
  ('Morkų wrapai su lašiša ir kreminiu sūriu', 'dinner'),
  ('Salotos su tunu', 'dinner'),
  ('Tuno salotos su kepta duona', 'dinner'),
  ('Česnakiniai lašišos iešmeliai', 'dinner'),
  ('Agurkų sushi', 'snack')
);

-- poultry: 16
update public.recipes
set main_proteins = '{poultry}'
where (name, meal_type) in (
  ('Karšti picos sumuštiniai', 'breakfast'),             -- turkey or pork ham: tagged with the turkey option
  ('Graikiškas dubuo', 'lunch'),
  ('Kreminiai pesto makaronai su vištiena ir daržovėmis', 'lunch'),
  ('Meduje kepta vištiena', 'lunch'),
  ('Paukštienos kotletukai su keptais svogūnais ir pievagrybiais', 'lunch'),
  ('Salotos su vištiena ir kiaušiniu', 'lunch'),
  ('Vištiena su bulvėmis orkaitėje', 'lunch'),
  ('Vištiena su morkomis ir grietinėle', 'lunch'),
  ('Vištienos šlaunelių mėsa su makaronais', 'lunch'),
  ('Brokolių salotos su vištiena', 'dinner'),
  ('Dubenėlis su vištiena ir žaliuoju avokadų padažu', 'dinner'),
  ('Pikantiški varškės kamuoliukai', 'dinner'),          -- smoked chicken
  ('Salotos su vištiena ir riešutų padažu', 'dinner'),
  ('Vištienos sriuba su frikadelėmis', 'dinner'),
  ('Rūkyta vištiena / kalakutiena su šviežiomis daržovėmis', 'snack'),
  ('Sumuštinis su kreminiu sūriu / avokadu ir paukštiena', 'snack')
);

-- pork: 6
update public.recipes
set main_proteins = '{pork}'
where (name, meal_type) in (
  ('Karšti sumuštiniai kepyklėje', 'breakfast'),         -- ham
  ('Tortilija su kumpiu ir sūriu', 'breakfast'),
  ('Užkepti kiaulienos kepsniai', 'lunch'),
  ('Pik Nik varškėtukai', 'dinner'),                     -- Pik Nik cheese sausage, read as pork
  ('Varškės pado pica', 'dinner'),                       -- ham
  ('Mini cukinijų picos', 'snack')                       -- ham
);

-- beef: 5
update public.recipes
set main_proteins = '{beef}'
where (name, meal_type) in (
  ('Jautienos čili troškinys', 'lunch'),
  ('Pomidorinis troškinys', 'lunch'),                    -- lean beef mince
  ('Tortilijos čeburėkas', 'lunch'),                     -- lean beef mince
  ('BIG MAC jautienos kotletukai', 'dinner'),
  ('Vytinta jautiena su daržovėmis', 'snack')
);

-- pork and poultry: 1
update public.recipes
set main_proteins = '{pork,poultry}'
where (name, meal_type) in (
  ('BLT sumuštinis', 'lunch')                            -- bacon and chicken
);

-- Every recipe must now be tagged: the not-empty check below fails the migration if a name above
-- did not match. Later seeds must set the column themselves.
alter table public.recipes
  alter column main_proteins drop default;

alter table public.recipes
  add constraint recipes_main_proteins_supported check (
    main_proteins <@ array['egg_dairy', 'plant', 'fish', 'poultry', 'pork', 'beef', 'other_meat']::text[]
  ),
  add constraint recipes_main_proteins_not_empty check (cardinality(main_proteins) > 0);

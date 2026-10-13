-- Number of days one cooked batch of the recipe is meant to cover.
-- 1 = cook and eat the same day; 2 = "dviems dienoms" (one portion cooked for two days).
alter table public.recipes
  add column portion_days smallint not null default 1,
  add constraint recipes_portion_days_positive check (portion_days >= 1);

comment on column public.recipes.portion_days is
  'Days covered by one cooked batch (2 for recipes marked "dviems dienoms").';

update public.recipes
set portion_days = 2
where (name, meal_type) in (
  ('Užkepti kiaulienos kepsniai', 'lunch'),
  ('Cukinijų ir varškės blyneliai', 'lunch'),
  ('Pomidorinis troškinys', 'lunch'),
  ('Kreminiai pesto makaronai su vištiena ir daržovėmis', 'lunch'),
  ('Kapoti menkės kepsniukai su bulvių koše', 'lunch'),
  ('Meduje kepta vištiena', 'lunch'),
  ('Jautienos čili troškinys', 'lunch'),
  ('Vištienos šlaunelių mėsa su makaronais', 'lunch'),
  ('Paukštienos kotletukai su keptais svogūnais ir pievagrybiais', 'lunch'),
  ('Makaronai su tunu', 'lunch'),
  ('BIG MAC jautienos kotletukai', 'dinner'),
  ('Vištienos sriuba su frikadelėmis', 'dinner'),
  ('Pikantiški varškės kamuoliukai', 'dinner'),
  ('Trinta moliūgų sriuba', 'dinner'),
  ('Kugelio pusbrolis', 'dinner'),
  ('Morkų wrapai su lašiša ir kreminiu sūriu', 'dinner'),
  ('Varškės apkepas su žalumynais', 'dinner')
);

-- Ingredient canonicalisation (G1): one canonical ingredient, with a shopping category, for every free-text
-- recipe_ingredients.item, so the shopping list (G2) can merge "Kiaušiniai" and "Kiaušiniai (M)" into one line and
-- group lines by category (G3).
--
-- ingredients holds the canonical names (Lithuanian, like the recipes, until X1b adds translations) and their
-- category. The categories are INGREDIENT_CATEGORIES in shared/utils/ingredient.ts, in the order the list shows them.
-- on_shopping_list is false for an ingredient that is never bought (tap water): G2 leaves it off the list.
--
-- ingredient_aliases maps an item, spelled exactly as recipes (or protein swaps) write it, to its ingredient. Matching
-- is exact on purpose: a new spelling is not guessed, it shows up in public.unmapped_ingredient_items and in the
-- report (docs/ingredient-mapping-report.md, `npm run ingredients:report`) and is mapped here in a later migration.
-- Every canonical name is also an alias of itself, so an AI protein swap naming "Tofu" or "Vištienos filė" matches.
--
-- The mapping below was written for all 240 distinct seeded items and reviewed one by one. The rules it follows:
--   * a variant of the same product is merged: size ("Morka (didelė)"), state ("Grikiai (sausi)", "Virti/kepti
--     burokėliai"), spelling ("Sezamų sėklos"), a recipe's prep ("Agurkų lazdelės");
--   * a variant a shopper must not swap is kept apart: lactose free, light or lean, whole grain, smoked, a named
--     cheese ("Džiugo sūris"), cherry tomatoes;
--   * a choice ("A arba B", "A / B") takes the first option, the recipe's own default;
--   * a list of several seasonings or vegetables, all "to taste", takes the generic "Prieskoniai", "Šviežios
--     daržovės" or "Švieži žalumynai";
--   * canned or ready goods are canned ("Virti avinžirniai" are bought as canned chickpeas).
-- Other judgment calls are commented next to the alias.
--
-- Additive and re-runnable: tables and policies are created if missing and every row is upserted, so running it
-- again puts the reviewed mapping back. Recipes are untouched, so it can run before or after the app deploy.

create table if not exists public.ingredients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null,
  on_shopping_list boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint ingredients_name_key unique (name),
  constraint ingredients_name_length check (char_length(btrim(name)) between 1 and 120),
  -- INGREDIENT_CATEGORIES in shared/utils/ingredient.ts.
  constraint ingredients_category_supported check (
    category in (
      'fruit_and_vegetables', 'meat_and_fish', 'dairy_and_eggs', 'grains_and_bread', 'pantry', 'frozen', 'other'
    )
  )
);

comment on table public.ingredients is
  'Canonical ingredients (G1): the name shopping lists merge by and the category they group by.';
comment on column public.ingredients.on_shopping_list is
  'False for an ingredient that is never bought (tap water); shopping lists leave it out.';

create table if not exists public.ingredient_aliases (
  item          text primary key,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  created_at    timestamptz not null default now()
);

create index if not exists ingredient_aliases_ingredient_idx on public.ingredient_aliases (ingredient_id);

comment on table public.ingredient_aliases is
  'An ingredient item exactly as recipes and protein swaps spell it, mapped to its canonical ingredient (G1).';

-- Content tables: readable by signed-in users, written only by migrations and the service role (as recipes).
alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;

drop policy if exists "ingredients are readable by authenticated users" on public.ingredients;
create policy "ingredients are readable by authenticated users"
  on public.ingredients for select to authenticated using (true);

drop policy if exists "ingredient aliases are readable by authenticated users" on public.ingredient_aliases;
create policy "ingredient aliases are readable by authenticated users"
  on public.ingredient_aliases for select to authenticated using (true);

-- Canonical ingredients, by category in list order.
insert into public.ingredients (name, category, on_shopping_list)
values
  -- fruit_and_vegetables: 36
  ('Agurkas', 'fruit_and_vegetables', true),
  ('Avokadas', 'fruit_and_vegetables', true),
  ('Bananas', 'fruit_and_vegetables', true),
  ('Batatai', 'fruit_and_vegetables', true),
  ('Bazilikas', 'fruit_and_vegetables', true),
  ('Brokolis', 'fruit_and_vegetables', true),
  ('Bulvės', 'fruit_and_vegetables', true),
  ('Burokėliai', 'fruit_and_vegetables', true),
  ('Citrina', 'fruit_and_vegetables', true),
  ('Citrinos sultys', 'fruit_and_vegetables', true),
  ('Cukinija', 'fruit_and_vegetables', true),
  ('Česnakas', 'fruit_and_vegetables', true),
  ('Kivis', 'fruit_and_vegetables', true),
  ('Krapai', 'fruit_and_vegetables', true),
  ('Laimas', 'fruit_and_vegetables', true),
  ('Laimo sultys', 'fruit_and_vegetables', true),
  ('Laiškiniai česnakai', 'fruit_and_vegetables', true),
  ('Moliūgas', 'fruit_and_vegetables', true),
  ('Morka', 'fruit_and_vegetables', true),
  ('Obuolys', 'fruit_and_vegetables', true),
  ('Paprika', 'fruit_and_vegetables', true),
  ('Petražolės', 'fruit_and_vegetables', true),
  ('Pievagrybiai', 'fruit_and_vegetables', true),
  ('Pomidoras', 'fruit_and_vegetables', true),
  ('Raudonasis svogūnas', 'fruit_and_vegetables', true),
  ('Ridikėliai', 'fruit_and_vegetables', true),
  ('Rukola', 'fruit_and_vegetables', true),
  ('Salotų lapai', 'fruit_and_vegetables', true),
  ('Svogūnas', 'fruit_and_vegetables', true),
  ('Svogūnų laiškai', 'fruit_and_vegetables', true),
  ('Špinatai', 'fruit_and_vegetables', true),
  ('Šviežios daržovės', 'fruit_and_vegetables', true),
  ('Švieži vaisiai', 'fruit_and_vegetables', true),
  ('Švieži žalumynai', 'fruit_and_vegetables', true),
  ('Uogos', 'fruit_and_vegetables', true),
  ('Vyšniniai pomidorai', 'fruit_and_vegetables', true),
  -- meat_and_fish: 16
  ('Jūrų lydekos filė', 'meat_and_fish', true),
  ('Kiaulienos išpjova', 'meat_and_fish', true),
  ('Krevetės', 'meat_and_fish', true),
  ('Kumpis', 'meat_and_fish', true),
  ('Lašišos filė', 'meat_and_fish', true),
  ('Liesa jautienos malta mėsa', 'meat_and_fish', true),
  ('Malta vištiena', 'meat_and_fish', true),
  ('Menkės filė', 'meat_and_fish', true),
  ('Pik Nik sūrio dešrelė', 'meat_and_fish', true),
  ('Rūkyta lašiša', 'meat_and_fish', true),
  ('Rūkyta šoninė', 'meat_and_fish', true),
  ('Rūkyta vištiena', 'meat_and_fish', true),
  ('Vištienos filė', 'meat_and_fish', true),
  ('Vištienos kaulai', 'meat_and_fish', true),
  ('Vištienos šlaunelių mėsa', 'meat_and_fish', true),
  ('Vytinta jautiena', 'meat_and_fish', true),
  -- dairy_and_eggs: 29
  ('Augalinis pienas', 'dairy_and_eggs', true),
  ('Baltyminiai sūreliai', 'dairy_and_eggs', true),
  ('Burrata sūris', 'dairy_and_eggs', true),
  ('Džiovintas varškės sūris', 'dairy_and_eggs', true),
  ('Džiugo sūris', 'dairy_and_eggs', true),
  ('Fetos sūris', 'dairy_and_eggs', true),
  ('Ghee sviestas', 'dairy_and_eggs', true),
  ('Graikiškas jogurtas', 'dairy_and_eggs', true),
  ('Grietinėlė', 'dairy_and_eggs', true),
  ('Grūdėta varškė', 'dairy_and_eggs', true),
  ('Halloumi sūris', 'dairy_and_eggs', true),
  ('Jogurtas be laktozės', 'dairy_and_eggs', true),
  ('Kefyras', 'dairy_and_eggs', true),
  ('Kiaušiniai', 'dairy_and_eggs', true),
  ('Kietasis sūris', 'dairy_and_eggs', true),
  ('Kreminis sūris', 'dairy_and_eggs', true),
  ('Kreminis sūris be laktozės', 'dairy_and_eggs', true),
  ('Liesa varškė', 'dairy_and_eggs', true),
  ('Mocarela', 'dairy_and_eggs', true),
  ('Mocarela light', 'dairy_and_eggs', true),
  ('Natūralus jogurtas', 'dairy_and_eggs', true),
  ('Pienas', 'dairy_and_eggs', true),
  ('Pienas be laktozės', 'dairy_and_eggs', true),
  ('PikNik sūrio lazdelės', 'dairy_and_eggs', true),
  ('Pusriebė varškė', 'dairy_and_eggs', true),
  ('Sūris', 'dairy_and_eggs', true),
  ('Sviestas', 'dairy_and_eggs', true),
  ('Varškė', 'dairy_and_eggs', true),
  ('Varškės sūris', 'dairy_and_eggs', true),
  -- grains_and_bread: 18
  ('Avižiniai dribsniai', 'grains_and_bread', true),
  ('Duona', 'grains_and_bread', true),
  ('Grikiai', 'grains_and_bread', true),
  ('Juoda duona', 'grains_and_bread', true),
  ('Kruasanas', 'grains_and_bread', true),
  ('Kukurūzų miltai', 'grains_and_bread', true),
  ('Lęšių trapučiai', 'grains_and_bread', true),
  ('Makaronai', 'grains_and_bread', true),
  ('Miltai', 'grains_and_bread', true),
  ('Perlinės kruopos', 'grains_and_bread', true),
  ('Pilno grūdo duona', 'grains_and_bread', true),
  ('Pilno grūdo makaronai', 'grains_and_bread', true),
  ('Pilno grūdo tortilija', 'grains_and_bread', true),
  ('Ryžiai', 'grains_and_bread', true),
  ('Ryžių trapučiai', 'grains_and_bread', true),
  ('Šviesi duona', 'grains_and_bread', true),
  ('Tortilija', 'grains_and_bread', true),
  ('Viso grūdo miltai', 'grains_and_bread', true),
  -- pantry: 52
  ('Actas', 'pantry', true),
  ('Aliejus', 'pantry', true),
  ('Alyvuogės', 'pantry', true),
  ('Alyvuogių aliejus', 'pantry', true),
  ('Baltymų milteliai', 'pantry', true),
  ('Chia sėklos', 'pantry', true),
  ('Cinamonas', 'pantry', true),
  ('Citrinpipiriai', 'pantry', true),
  ('Česnako milteliai', 'pantry', true),
  ('Druska', 'pantry', true),
  ('Garstyčios', 'pantry', true),
  ('Itališkos žolelės', 'pantry', true),
  ('Juodasis šokoladas', 'pantry', true),
  ('Kakava', 'pantry', true),
  ('Kepimo milteliai', 'pantry', true),
  ('Kinder šokoladukas', 'pantry', true),
  ('Kokoso drožlės', 'pantry', true),
  ('Kokosų pienas light', 'pantry', true),
  ('Konservuotas tunas', 'pantry', true),
  ('Konservuoti avinžirniai', 'pantry', true),
  ('Konservuoti pomidorai', 'pantry', true),
  ('Konservuotos pupelės', 'pantry', true),
  ('Konservuotos raudonosios pupelės', 'pantry', true),
  ('Kukurūzai', 'pantry', true),
  ('Lęšiai', 'pantry', true),
  ('Liesas majonezas', 'pantry', true),
  ('Majonezas', 'pantry', true),
  ('Malta paprika', 'pantry', true),
  ('Marinuoti agurkėliai', 'pantry', true),
  ('Medus', 'pantry', true),
  ('Migdolai', 'pantry', true),
  ('Moliūgų sėklos', 'pantry', true),
  ('Pesto padažas', 'pantry', true),
  ('Petražolių prieskoniai', 'pantry', true),
  ('Picos prieskoniai', 'pantry', true),
  ('Pipirai', 'pantry', true),
  ('Pomidorų padažas', 'pantry', true),
  ('Prieskoniai', 'pantry', true),
  ('Provanso žolelės', 'pantry', true),
  ('Raugintos daržovės', 'pantry', true),
  ('Riešutų sviestas', 'pantry', true),
  ('Rūkyta paprika', 'pantry', true),
  ('Saldiklis', 'pantry', true),
  ('Sezamo sėklos', 'pantry', true),
  ('Sėklos', 'pantry', true),
  ('Sojų padažas', 'pantry', true),
  ('Spragėsiai', 'pantry', true),
  ('Sultinys', 'pantry', true),
  ('Vanilė', 'pantry', true),
  ('Vištienos prieskoniai', 'pantry', true),
  ('Želė', 'pantry', true),
  ('Žuvies prieskoniai', 'pantry', true),
  -- frozen: 1
  ('Šaldytos vyšnios', 'frozen', true),
  -- other: 3
  ('Humusas', 'other', true),
  ('Tofu', 'other', true),
  ('Vanduo', 'other', false)
on conflict (name) do update
set category = excluded.category,
    on_shopping_list = excluded.on_shopping_list;

-- Every seeded item, grouped by the ingredient it maps to. The subquery returns null for a canonical name that is
-- not above, and the not-null ingredient_id then aborts the migration instead of dropping the alias.
insert into public.ingredient_aliases (item, ingredient_id)
select alias.item, (select ingredient.id from public.ingredients ingredient where ingredient.name = alias.ingredient_name)
from (values
  ('Agurkai', 'Agurkas'),
  ('Agurkas', 'Agurkas'),
  ('Agurkų lazdelės', 'Agurkas'),  -- cut from a cucumber
  ('Avokadas', 'Avokadas'),
  ('Bananas', 'Bananas'),
  ('Saldžios bulvės (batatai)', 'Batatai'),
  ('Bazilikas', 'Bazilikas'),
  ('Švieži baziliko lapeliai', 'Bazilikas'),
  ('Brokolis', 'Brokolis'),
  ('Bulvės', 'Bulvės'),
  ('Bulvės (didelės)', 'Bulvės'),
  ('Virti/kepti burokėliai', 'Burokėliai'),
  ('Citrina', 'Citrina'),
  ('Citrina (sultys ir nutarkuota žievelė)', 'Citrina'),
  ('Citrinos sultys', 'Citrinos sultys'),
  ('Citrinos sultys arba actas', 'Citrinos sultys'),  -- first option
  ('Cukinija', 'Cukinija'),
  ('Česnakas', 'Česnakas'),
  ('Kivis', 'Kivis'),
  ('Krapai / kiti žalumynai', 'Krapai'),  -- first option
  ('Laimas', 'Laimas'),
  ('Laimo sultys', 'Laimo sultys'),
  ('Laiškiniai česnakai', 'Laiškiniai česnakai'),
  ('Moliūgas', 'Moliūgas'),
  ('Morka', 'Morka'),
  ('Morka (didelė)', 'Morka'),
  ('Morkos', 'Morka'),
  ('Obuolys', 'Obuolys'),
  ('Paprika', 'Paprika'),  -- the vegetable (bell pepper) in all three recipes
  ('Paprikos', 'Paprika'),
  ('Raudonoji paprika', 'Paprika'),
  ('Petražolės', 'Petražolės'),
  ('Pievagrybiai', 'Pievagrybiai'),
  ('Pievagrybiai / paprika / kitos daržovės', 'Pievagrybiai'),  -- first option
  ('Pomidorai', 'Pomidoras'),
  ('Pomidorai (arba konservuoti)', 'Pomidoras'),  -- first option
  ('Pomidoras', 'Pomidoras'),
  ('Pomidoras (didesnis)', 'Pomidoras'),
  ('Raudonasis svogūnas', 'Raudonasis svogūnas'),
  ('Ridikėliai', 'Ridikėliai'),
  ('Rukola', 'Rukola'),
  ('Lapinės salotos', 'Salotų lapai'),
  ('Salotų lapai', 'Salotų lapai'),
  ('Svogūnas', 'Svogūnas'),
  ('Svogūnlaiškiai', 'Svogūnų laiškai'),
  ('Špinatai', 'Špinatai'),
  ('Agurkai, pomidorai, kitos daržovės', 'Šviežios daržovės'),  -- a list of vegetables
  ('Daržovės', 'Šviežios daržovės'),
  ('Daržovių salotos', 'Šviežios daržovės'),  -- a side salad of vegetables
  ('Kitos daržovės', 'Šviežios daržovės'),
  ('Kitos mėgstamos daržovės', 'Šviežios daržovės'),
  ('Salotos, pomidoras, agurkas, raudonas svogūnas, krapai, mėtos', 'Šviežios daržovės'),  -- a list of vegetables
  ('Šviežios arba raugintos daržovės', 'Šviežios daržovės'),  -- first option
  ('Šviežios daržovės', 'Šviežios daržovės'),
  ('Švieži vaisiai', 'Švieži vaisiai'),
  ('Vaisiai / uogos', 'Švieži vaisiai'),  -- first option
  ('Petražolės, svogūnų laiškai, pipirai', 'Švieži žalumynai'),  -- a list of fresh herbs (and pepper)
  ('Švieži žalumynai', 'Švieži žalumynai'),
  ('Žalumynai', 'Švieži žalumynai'),
  ('Mėgstamos uogos', 'Uogos'),
  ('Uogos', 'Uogos'),
  ('Pomidoriukai', 'Vyšniniai pomidorai'),
  ('Vyšniniai pomidorai', 'Vyšniniai pomidorai'),
  ('Vyšniniai pomidoriukai', 'Vyšniniai pomidorai'),
  ('Jūrinės lydekos filė', 'Jūrų lydekos filė'),
  ('Žuvis (jūrų lydeka)', 'Jūrų lydekos filė'),
  ('Kiaulienos išpjova', 'Kiaulienos išpjova'),
  ('Krevetės', 'Krevetės'),
  ('Kalakutienos/kiaulienos kumpis', 'Kumpis'),
  ('Kumpis', 'Kumpis'),
  ('Lašiša', 'Lašišos filė'),
  ('Lašiša (neapdorota)', 'Lašišos filė'),
  ('Lašišos filė', 'Lašišos filė'),
  ('Liesa jautienos malta mėsa', 'Liesa jautienos malta mėsa'),
  ('Malta paukštiena', 'Malta vištiena'),
  ('Malta vištiena', 'Malta vištiena'),
  ('Malta vištiena arba filė', 'Malta vištiena'),  -- first option
  ('Menkės filė', 'Menkės filė'),
  ('Pik Nik sūrio dešrelė', 'Pik Nik sūrio dešrelė'),
  ('Rūkyta lašiša', 'Rūkyta lašiša'),
  ('Sūdyta/rūkyta lašiša', 'Rūkyta lašiša'),  -- salted or smoked: one shelf
  ('Rūkyta šoninė', 'Rūkyta šoninė'),
  ('Rūkyta vištiena', 'Rūkyta vištiena'),
  ('Keptos paukštienos mėsa (be riebalų)', 'Vištienos filė'),  -- lean poultry meat, bought as chicken fillet
  ('Keptos vištienos filė (svertas neapdorotas)', 'Vištienos filė'),  -- weighed raw
  ('Vištienos filė', 'Vištienos filė'),
  ('Vištienos krūtinėlė', 'Vištienos filė'),
  ('Vištienos kaulai/paukštiena sultiniui', 'Vištienos kaulai'),
  ('Vištienos šlaunelių mėsa', 'Vištienos šlaunelių mėsa'),
  ('Vytinta jautiena', 'Vytinta jautiena'),
  ('Augalinis pienas arba natūralus jogurtas', 'Augalinis pienas'),  -- first option
  ('Baltyminiai sūreliai', 'Baltyminiai sūreliai'),
  ('Burrata sūris', 'Burrata sūris'),
  ('Džiovintas varškės sūris', 'Džiovintas varškės sūris'),
  ('Džiugo sūris', 'Džiugo sūris'),
  ('Fetos arba graikiškas sūris', 'Fetos sūris'),
  ('Fetos arba ožkos sūris', 'Fetos sūris'),  -- first option
  ('Fetos sūris', 'Fetos sūris'),
  ('Fetos sūris (arba burata likutis)', 'Fetos sūris'),  -- first option
  ('Ghee sviestas', 'Ghee sviestas'),
  ('Ghee sviestas arba aliejus', 'Ghee sviestas'),  -- first option
  ('Ghee sviestas arba alyvuogių aliejus', 'Ghee sviestas'),  -- first option
  ('Graikiškas jogurtas', 'Graikiškas jogurtas'),
  ('Grietinėlė (sojų Alpro arba 12% rieb.)', 'Grietinėlė'),  -- soy or 12% cream: one product on the list
  ('Liesa grietinėlė 12%', 'Grietinėlė'),
  ('Sojų grietinėlė arba liesa grietinėlė 12%', 'Grietinėlė'),  -- soy or 12% cream: one product on the list
  ('Grūdėta varškė', 'Grūdėta varškė'),
  ('Halloumi sūris', 'Halloumi sūris'),
  ('Jogurtas be laktozės / graikiškas', 'Jogurtas be laktozės'),  -- first option; lactose free is kept apart
  ('Kefyras', 'Kefyras'),
  ('Kiaušiniai', 'Kiaušiniai'),
  ('Kiaušiniai (M)', 'Kiaušiniai'),
  ('Kietasis sūris', 'Kietasis sūris'),
  ('Tarkuotas kietas sūris', 'Kietasis sūris'),
  ('Kreminis sūris', 'Kreminis sūris'),
  ('Kreminis sūris arba varškės užtepėlė', 'Kreminis sūris'),  -- first option
  ('Kreminis sūris be laktozės', 'Kreminis sūris be laktozės'),  -- lactose free is kept apart
  ('Liesa varškė', 'Liesa varškė'),
  ('Varškė 0.5%', 'Liesa varškė'),  -- 0.5% fat is lean
  ('Mocarela', 'Mocarela'),
  ('Mocarela sūris', 'Mocarela'),
  ('Mocarela light', 'Mocarela light'),
  ('Mocarela light sūris', 'Mocarela light'),
  ('Natūralus jogurtas', 'Natūralus jogurtas'),
  ('Natūralus/graikiškas jogurtas', 'Natūralus jogurtas'),  -- first option
  ('Pienas', 'Pienas'),
  ('Pienas (be laktozės)', 'Pienas be laktozės'),  -- lactose free is kept apart
  ('PikNik sūrio lazdelės', 'PikNik sūrio lazdelės'),
  ('Pusriebė varškė', 'Pusriebė varškė'),
  ('Fermentinis sūris', 'Sūris'),  -- "sūris" usually means ripened cheese
  ('Sūris', 'Sūris'),
  ('Tarkuotas sūris', 'Sūris'),
  ('Sviestas', 'Sviestas'),
  ('Sviestas/ghee arba kepimo aliejus', 'Sviestas'),  -- first option
  ('Varškė', 'Varškė'),
  ('Varškė 9%', 'Varškė'),
  ('Varškės sūris', 'Varškės sūris'),
  ('Varškės sūris (13%)', 'Varškės sūris'),
  ('Avižiniai dribsniai', 'Avižiniai dribsniai'),
  ('Avižų miltai (sublendintos avižos)', 'Avižiniai dribsniai'),  -- blended oats
  ('Duona', 'Duona'),
  ('Grikiai arba ryžiai (sausi)', 'Grikiai'),  -- first option
  ('Grikiai (sausi)', 'Grikiai'),
  ('Juoda duona', 'Juoda duona'),
  ('Juoda duona arba grikiai (sausi)', 'Juoda duona'),  -- first option
  ('Kruasanas', 'Kruasanas'),
  ('Kukurūzų miltai', 'Kukurūzų miltai'),
  ('Lęšių trapukai', 'Lęšių trapučiai'),
  ('Garnyras (makaronai/kruopos)', 'Makaronai'),  -- first option of the side
  ('Makaronai (sausi)', 'Makaronai'),
  ('Spaghetti makaronai', 'Makaronai'),
  ('Miltai', 'Miltai'),
  ('Perlinės kruopos (sausos)', 'Perlinės kruopos'),
  ('Pilno grūdo duona', 'Pilno grūdo duona'),
  ('Viso grūdo duona (šviesi, kvadratinė)', 'Pilno grūdo duona'),  -- "viso grūdo" and "pilno grūdo" both mean whole grain
  ('Pilno grūdo makaronai (sausi)', 'Pilno grūdo makaronai'),
  ('Viso grūdo spagečiai', 'Pilno grūdo makaronai'),
  ('Pilno grūdo tortilija', 'Pilno grūdo tortilija'),
  ('Basmati ryžiai', 'Ryžiai'),  -- any rice
  ('Ryžiai (rudieji/laukiniai/basmati, sausi)', 'Ryžiai'),  -- any rice
  ('Ryžiai (sausi)', 'Ryžiai'),
  ('Ryžių trapučiai', 'Ryžių trapučiai'),
  ('Šviesi duona', 'Šviesi duona'),
  ('Šviesi forminė duona', 'Šviesi duona'),
  ('Tortilija', 'Tortilija'),
  ('Viso grūdo miltai', 'Viso grūdo miltai'),
  ('Actas', 'Actas'),
  ('Aliejus', 'Aliejus'),
  ('Alyvuogės', 'Alyvuogės'),
  ('Alyvuogių aliejus', 'Alyvuogių aliejus'),
  ('Baltymų milteliai', 'Baltymų milteliai'),
  ('Chia sėklos', 'Chia sėklos'),
  ('Cinamonas', 'Cinamonas'),
  ('Citrinpipiriai', 'Citrinpipiriai'),
  ('Citrinpipiriai / citrinos sultys / prieskoniai', 'Citrinpipiriai'),  -- first option
  ('Prieskoniai (citrinpipiriai)', 'Citrinpipiriai'),
  ('Česnako milteliai', 'Česnako milteliai'),
  ('Česnako milteliai / petražolės', 'Česnako milteliai'),  -- first option
  ('Druska', 'Druska'),
  ('Garstyčios', 'Garstyčios'),
  ('Itališkos žolelės', 'Itališkos žolelės'),
  ('Itališkos žolelės / picos prieskoniai', 'Itališkos žolelės'),  -- first option
  ('Juodasis šokoladas', 'Juodasis šokoladas'),
  ('Kakava', 'Kakava'),
  ('Kepimo milteliai', 'Kepimo milteliai'),
  ('Kinder šokoladukas', 'Kinder šokoladukas'),
  ('Kokoso drožlės / cinamonas / aguonos', 'Kokoso drožlės'),  -- first option
  ('Kokosų pienas light', 'Kokosų pienas light'),
  ('Konservuotas tunas savo sultyse', 'Konservuotas tunas'),
  ('Konservuoti avinžirniai', 'Konservuoti avinžirniai'),
  ('Virti avinžirniai', 'Konservuoti avinžirniai'),  -- cooked chickpeas are bought canned
  ('Konservuoti pomidorai', 'Konservuoti pomidorai'),
  ('Konservuotos pupelės', 'Konservuotos pupelės'),
  ('Konservuotos raudonosios pupelės', 'Konservuotos raudonosios pupelės'),
  ('Kukurūzai', 'Kukurūzai'),  -- canned sweetcorn (a salad with tuna)
  ('Lęšiai (sausi)', 'Lęšiai'),
  ('Liesas majonezas', 'Liesas majonezas'),
  ('Liesas majonezas arba graikiškas jogurtas', 'Liesas majonezas'),  -- first option
  ('Light majonezas', 'Liesas majonezas'),
  ('Majonezas', 'Majonezas'),
  ('Malta paprika arba muskatas', 'Malta paprika'),  -- first option
  ('Marinuoti agurkėliai', 'Marinuoti agurkėliai'),
  ('Marinuotų agurkėlių skystis', 'Marinuoti agurkėliai'),  -- the brine comes with the jar
  ('Medus', 'Medus'),
  ('Migdolai', 'Migdolai'),
  ('Moliūgų sėklos', 'Moliūgų sėklos'),
  ('Pesto padažas', 'Pesto padažas'),
  ('Petražolių prieskoniai', 'Petražolių prieskoniai'),  -- dried parsley
  ('Picos prieskoniai', 'Picos prieskoniai'),
  ('Pipirai', 'Pipirai'),
  ('Pomidorų padažas', 'Pomidorų padažas'),
  ('Ciberžolė, karis, kmynai, imbieras', 'Prieskoniai'),  -- a list of spices
  ('Druska, pipirai, mėgstami prieskoniai', 'Prieskoniai'),  -- a list of spices
  ('Druska, pipirai, raudonos paprikos prieskoniai', 'Prieskoniai'),  -- a list of spices
  ('Mėgstami prieskoniai', 'Prieskoniai'),
  ('Prieskoniai', 'Prieskoniai'),
  ('Rūkyta/saldžioji paprika, druska, pipirai', 'Prieskoniai'),  -- a list of spices
  ('Provanso žolelės', 'Provanso žolelės'),
  ('Raugintos arba šviežios daržovės', 'Raugintos daržovės'),  -- first option
  ('Riešutų sviestas', 'Riešutų sviestas'),
  ('Žemės riešutų sviestas', 'Riešutų sviestas'),  -- any nut butter
  ('Rūkyta paprika', 'Rūkyta paprika'),
  ('Saldiklis', 'Saldiklis'),
  ('Saldiklis (eritritolis, skonio lašiukai ar medus)', 'Saldiklis'),
  ('Saldiklis / medus', 'Saldiklis'),  -- first option
  ('Sezamo sėklos', 'Sezamo sėklos'),
  ('Sezamų sėklos', 'Sezamo sėklos'),  -- spelling variant
  ('Sėklos', 'Sėklos'),
  ('Sojų padažas', 'Sojų padažas'),
  ('Spragėsiai', 'Spragėsiai'),
  ('Sultinys', 'Sultinys'),
  ('Vanilė', 'Vanilė'),
  ('Vištienos prieskoniai', 'Vištienos prieskoniai'),
  ('Želė', 'Želė'),
  ('Žuvies prieskoniai', 'Žuvies prieskoniai'),
  ('Žuvies žolelės ir prieskoniai', 'Žuvies prieskoniai'),
  ('Šaldytos vyšnios (arba kitos uogos)', 'Šaldytos vyšnios'),  -- first option
  ('Humusas', 'Humusas'),
  ('Kietas tofu', 'Tofu'),
  ('Vanduo', 'Vanduo')
) as alias (item, ingredient_name)
on conflict (item) do update
set ingredient_id = excluded.ingredient_id;

-- Each canonical name is an alias of itself; an item already mapped above keeps its mapping.
insert into public.ingredient_aliases (item, ingredient_id)
select ingredient.name, ingredient.id
from public.ingredients ingredient
on conflict (item) do nothing;

-- Items with no alias yet: seeded recipe items, and the replacements of ready protein swaps (D2), which the AI names
-- freely. The report lists them; a pgTAP test keeps the seeded recipes at none. Not exposed through the API: read it
-- with the service role or in the SQL editor.
create or replace view public.unmapped_ingredient_items
with (security_invoker = true) as
select
  'recipe'::text as source,
  recipe_ingredient.item,
  count(*)::integer as uses,
  count(distinct recipe_ingredient.recipe_id)::integer as recipes,
  array_remove(array_agg(distinct recipe_ingredient.unit), null) as units
from public.recipe_ingredients recipe_ingredient
where not exists (
  select 1 from public.ingredient_aliases alias where alias.item = recipe_ingredient.item
)
group by recipe_ingredient.item
union all
select
  'protein_swap'::text as source,
  swap_item.item,
  count(*)::integer as uses,
  count(distinct swap_item.recipe_id)::integer as recipes,
  array_remove(array_agg(distinct swap_item.unit), null) as units
from public.recipe_protein_swap_items swap_item
join public.recipe_protein_swaps swap on swap.id = swap_item.swap_id
where swap.status = 'ready'
  and not exists (
    select 1 from public.ingredient_aliases alias where alias.item = swap_item.item
  )
group by swap_item.item;

comment on view public.unmapped_ingredient_items is
  'Recipe and ready protein swap items with no ingredient alias (G1). Map them in a new migration.';

revoke all on public.unmapped_ingredient_items from anon, authenticated;
grant select on public.unmapped_ingredient_items to service_role;

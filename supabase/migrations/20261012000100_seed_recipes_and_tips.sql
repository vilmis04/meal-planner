-- Seed data: recipes, snacks and tips (instructions have source citation markers removed).

-- Breakfast / lunch / dinner recipes

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Plakti kiaušiniai su feta', 'breakfast', 'Kiaušinius išplakti su prieskoniais, juos galima pagardinti ir šviežiais žalumynais. Kepti ant vidutinės ugnies, nuolat maišant. Supjaustyti pomidoriukus, svogūną ir avokadą smulkiai, pagardinti prieskoniais, sumaišyti. Sudėti į lėkštę salotas, kiaušinienę. Uždėti kiaušinį, užtrupinti fetą. Šalia daržovės ir šviesios duonos riekelė.', 370, 43, 19, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (2, 'Fetos sūris', 20::numeric, 'g'::text),
      (3, 'Vyšniniai pomidorai', 50::numeric, 'g'::text),
      (4, 'Svogūnas', 20::numeric, 'g'::text),
      (5, 'Avokadas', 40::numeric, 'g'::text),
      (6, 'Šviesi duona', 30::numeric, 'g'::text),
      (7, 'Salotų lapai', 30::numeric, 'g'::text),
      (8, 'Prieskoniai', null::numeric, null::text),
      (9, 'Švieži žalumynai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grikiai su kiaušiniais', 'breakfast', 'Grikius išvirti arba užpilti karštu vandeniu. Paruoštus pagardinti druska. Kiaušinį išvirti. Uždėti kiaušinį, užtrupinti fetą. Šalia daržovės ir šviesios duonos riekelė.', 370, 27, 22, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grikiai (sausi)', 50::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Fetos sūris', 20::numeric, 'g'::text),
      (4, 'Šviesi duona', 30::numeric, 'g'::text),
      (5, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (6, 'Druska', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižinė košė su bananu ir riešutų sviestu', 'breakfast', 'Avižas išvirti vandens pagrindu, įdėti žiupsnelį druskos ir nuolat maišyti. Paruoštą košę dedame į dubenėlį, pabarstome cinamonu, dedame riešutų sviestą, pjaustytą bananą.', 400, 59, 19, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 50::numeric, 'g'::text),
      (2, 'Vanduo', 200::numeric, 'ml'::text),
      (3, 'Bananas', 100::numeric, 'g'::text),
      (4, 'Riešutų sviestas', 15::numeric, 'g'::text),
      (5, 'Cinamonas', null::numeric, null::text),
      (6, 'Druska', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kiaušinienė su grūdėta varške', 'breakfast', 'Viską, išskyrus aliejų, sumaišome kartu. Aliejų įkaitiname keptuvėje ir maišant kepame iki pilno iškepimo. Patiekiame su duona ir daržovėmis.', 400, 40, 26, 19)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (2, 'Grūdėta varškė', 100::numeric, 'g'::text),
      (3, 'Aliejus', 5::numeric, 'g'::text),
      (4, 'Šviesi duona', 30::numeric, 'g'::text),
      (5, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (6, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Sumuštinis su avokadu ir grūdėta varške', 'breakfast', 'Dviejų šviesios duonos riekelių paskrudinkite. Avokadą sutrinkite šakute, įberkite šiek tiek druskos, pipirų ir tepkite ant duonos. Uždėkite ant viršaus grūdėtos varškės ir pjaustytą pomidorą.', 400, 39, 17, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Šviesi duona', 60::numeric, 'g'::text),
      (2, 'Avokadas', 50::numeric, 'g'::text),
      (3, 'Grūdėta varškė', 100::numeric, 'g'::text),
      (4, 'Pomidoras', 80::numeric, 'g'::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Karšti sumuštiniai kepyklėje', 'breakfast', 'Duoneles pertepti kreminiu sūriu, uždėti visus ingredientus tolygiai, ant viršaus uždėti pomidorų padažą ir itališkas žoleles. Kepti sumuštinių kepyklėje.', 615, 63, 36, 23)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Šviesi duona', 60::numeric, 'g'::text),
      (2, 'Kreminis sūris', 20::numeric, 'g'::text),
      (3, 'Pomidorų padažas', 15::numeric, 'g'::text),
      (4, 'Itališkos žolelės', null::numeric, null::text),
      (5, 'Kumpis', 40::numeric, 'g'::text),
      (6, 'Sūris', 30::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kruasanas su lašiša', 'breakfast', 'Kruasaną įpjauti, pertepti pasirinkta užtepėle, sudėti ingredientus (salotos lapas, kreminis sūris, lašiša/kumpelis, pomidoro griežinėlis). Šalia šviežios daržovės.', 412, 39, 17, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kruasanas', 1::numeric, 'vnt.'::text),
      (2, 'Kreminis sūris', 20::numeric, 'g'::text),
      (3, 'Sūdyta/rūkyta lašiša', 40::numeric, 'g'::text),
      (4, 'Salotų lapai', 10::numeric, 'g'::text),
      (5, 'Pomidoras', 30::numeric, 'g'::text),
      (6, 'Šviežios daržovės', 100::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vištiena su bulvėmis orkaitėje', 'lunch', 'Vištieną ištriname prieskoniais. Bulves nulupti, supjaustyti dalimis, pagardinti prieskoniais ir aliejumi. Viską kepti orkaitėje 200°C apie 35 min. Patiekti su šviežiomis arba raugintomis daržovėmis. Porciją dalinti į dvi dalis.', 435, 39, 42, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos krūtinėlė', 250::numeric, 'g'::text),
      (2, 'Bulvės', 300::numeric, 'g'::text),
      (3, 'Aliejus', 10::numeric, 'g'::text),
      (4, 'Prieskoniai', null::numeric, null::text),
      (5, 'Šviežios arba raugintos daržovės', 150::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Užkepti kiaulienos kepsniai', 'lunch', 'Kiaulienos kepsnius plonai išmušti mėsos plaktuku, pabarstyti druska, pipirais, prieskoniais. Kepimo formą ištiesti kepimo popieriumi, sudėti kepsnelius, dėti pomidoro ir pievagrybių griežinėlius, aptepti majonezu ir pabarstyti sūriu. Kepti 190°C orkaitėje apie 25-30 min. Patiekti su garnyru (ryžiai/grikiai/makaronai/bulguras) ir daržovėmis. Receptas 2 dienoms.', 480, 45.5, 35, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaulienos išpjova', 250::numeric, 'g'::text),
      (2, 'Pomidorai', 100::numeric, 'g'::text),
      (3, 'Pievagrybiai', 80::numeric, 'g'::text),
      (4, 'Majonezas', 20::numeric, 'g'::text),
      (5, 'Sūris', 40::numeric, 'g'::text),
      (6, 'Grikiai (sausi)', 120::numeric, 'g'::text),
      (7, 'Šviežios daržovės', 150::numeric, 'g'::text),
      (8, 'Druska', null::numeric, null::text),
      (9, 'Pipirai', null::numeric, null::text),
      (10, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Cukinijų ir varškės blyneliai', 'lunch', 'Sutarkuojame cukiniją, pabarstome druska ir paliekame minutei, tuomet nuspaudžiame skystį. Sumaišome su varške, kiaušiniais, prieskoniais, smulkintu česnaku ir miltais. Kepame keptuvėje ant aliejaus arba ghee sviesto. Patiekiame su graikišku jogurtu ir lašiša. Porcija 2 dienoms.', 500, 34, 52, 12.5)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Cukinija', 300::numeric, 'g'::text),
      (2, 'Varškė', 200::numeric, 'g'::text),
      (3, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (4, 'Miltai', 40::numeric, 'g'::text),
      (5, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (6, 'Aliejus', 10::numeric, 'g'::text),
      (7, 'Graikiškas jogurtas', 60::numeric, 'g'::text),
      (8, 'Sūdyta/rūkyta lašiša', 50::numeric, 'g'::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tuno ir avinžirnių salotos su feta sūriu', 'lunch', 'Daržoves (pomidoras, agurkas, raudonasis svogūnas) susmulkinti. Viską sumaišyti su tunu, avinžirniais, alyvuogių aliejumi, citrinos sultimis, prieskoniais ir sutrupinti fetos sūrį. Šalia paskrudinta duonos riekelė.', 460, 36, 32, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Konservuotas tunas savo sultyse', 120::numeric, 'g'::text),
      (2, 'Konservuoti avinžirniai', 100::numeric, 'g'::text),
      (3, 'Fetos sūris', 30::numeric, 'g'::text),
      (4, 'Pomidoras', 80::numeric, 'g'::text),
      (5, 'Agurkas', 80::numeric, 'g'::text),
      (6, 'Raudonasis svogūnas', 20::numeric, 'g'::text),
      (7, 'Alyvuogių aliejus', 10::numeric, 'g'::text),
      (8, 'Citrinos sultys', 10::numeric, 'ml'::text),
      (9, 'Šviesi duona', 30::numeric, 'g'::text),
      (10, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('BIG MAC jautienos kotletukai', 'dinner', 'Bulves supjaustyti skiltelėmis, pagardinti prieskoniais ir aliejumi, kepti orkaitėje 190°C apie 30 min. Daržoves susmulkinti, apkepinti, sudėti į jautienos faršą kartu su prieskoniais ir garstyčiomis. Išmaišyti, sudėti į keksiukų formėles ir kepti orkaitėje 12-15 min. Aptepti pomidorų padažu ir palaikyti dar kelias minutes. Patiekti su salotomis, daržovėmis ir bulvėmis. Porcija 2 dienoms.', 480, 30, 33.5, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa jautienos malta mėsa', 250::numeric, 'g'::text),
      (2, 'Bulvės', 200::numeric, 'g'::text),
      (3, 'Svogūnas', 30::numeric, 'g'::text),
      (4, 'Morka', 30::numeric, 'g'::text),
      (5, 'Garstyčios', 10::numeric, 'g'::text),
      (6, 'Pomidorų padažas', 20::numeric, 'g'::text),
      (7, 'Aliejus', 10::numeric, 'g'::text),
      (8, 'Salotų lapai', 100::numeric, 'g'::text),
      (9, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vištienos sriuba su frikadelėmis', 'dinner', 'Išsivirti sultinį iš daržovių, prieskonių bei vištienos kaulų/paukštienos. Į verdantį sultinį sudėti smulkintas bulves. Po 10-15 min suformuoti kukulius iš maltos mėsos ir sumesti į sriubą. Keptuvėje apkepinti morką su svogūnu ir suberti į sriubą. Įberti žalumynų. Patiekti su skrudinta šviesia duona bei šaukštu graikiško jogurto. Porcija 2 dienoms.', 480, 55, 27, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos kaulai/paukštiena sultiniui', 200::numeric, 'g'::text),
      (2, 'Malta paukštiena', 200::numeric, 'g'::text),
      (3, 'Bulvės', 250::numeric, 'g'::text),
      (4, 'Morka', 80::numeric, 'g'::text),
      (5, 'Svogūnas', 50::numeric, 'g'::text),
      (6, 'Šviesi duona', 60::numeric, 'g'::text),
      (7, 'Graikiškas jogurtas', 30::numeric, 'g'::text),
      (8, 'Švieži žalumynai', null::numeric, null::text),
      (9, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Varškės pado pica', 'dinner', 'Grūdėtą varškę, kiaušinį, miltus ir prieskonius sublenderiuoti. Masę pilti ant kepimo popieriumi išklotos skardos, suformuoti apskritimą. Kepame 180°C orkaitėje ~15 min. Ištraukus sudėti pagardus (pomidorų padažas, kumpis, sūris, daržovės, itališki žalumynai) ir grąžinti į orkaitę kelioms minutėms, kol išsilydys sūris.', 580, 41, 54, 21)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grūdėta varškė', 200::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Miltai', 50::numeric, 'g'::text),
      (4, 'Pomidorų padažas', 30::numeric, 'g'::text),
      (5, 'Kumpis', 50::numeric, 'g'::text),
      (6, 'Sūris', 40::numeric, 'g'::text),
      (7, 'Šviežios daržovės', 50::numeric, 'g'::text),
      (8, 'Itališkos žolelės', null::numeric, null::text),
      (9, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avinžirnių ir burokėlių salotas su feta', 'dinner', 'Burokėlius pasmulkinti kubeliais, svogūną susmulkinti, agurką supjaustyti. Sumaišyti visas daržoves su avinžirniais ir špinatais. Paruošti padažą iš graikiško jogurto, medaus, citrinų sulčių, garstyčių bei prieskonių, užpilti ant salotų. Užtrupinti fetos sūrį.', 433, 57, 24, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Virti/kepti burokėliai', 150::numeric, 'g'::text),
      (2, 'Konservuoti avinžirniai', 120::numeric, 'g'::text),
      (3, 'Fetos sūris', 40::numeric, 'g'::text),
      (4, 'Špinatai', 40::numeric, 'g'::text),
      (5, 'Agurkas', 80::numeric, 'g'::text),
      (6, 'Svogūnas', 20::numeric, 'g'::text),
      (7, 'Graikiškas jogurtas', 30::numeric, 'g'::text),
      (8, 'Medus', 5::numeric, 'g'::text),
      (9, 'Citrinos sultys', 10::numeric, 'ml'::text),
      (10, 'Garstyčios', 5::numeric, 'g'::text),
      (11, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Burokėlių salotas su pupelėmis', 'dinner', 'Burokėlius ir obuolį susmulkiname, sudedame į dubenį kartu su pupelėmis, pagardiname prieskoniais, graikišku jogurtu ir išmaišome. Patiekiama su paskrudinta šviesios duonos riekele.', 480, 60, 21, 4)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Virti/kepti burokėliai', 150::numeric, 'g'::text),
      (2, 'Konservuotos raudonosios pupelės', 120::numeric, 'g'::text),
      (3, 'Obuolys', 100::numeric, 'g'::text),
      (4, 'Graikiškas jogurtas', 40::numeric, 'g'::text),
      (5, 'Šviesi duona', 30::numeric, 'g'::text),
      (6, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tortilija su kumpiu ir sūriu', 'breakfast', 'Tortiliją ištepti pomidorų padažu, sudėti kumpį, sūrį, prieskonius. Sulenkti per puse ir kepti keptuvėje su dangčiu ant mažos ugnies, kol sūris išsilydys. Šalia daržovės.', 430, 47, 21, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Kumpis', 40::numeric, 'g'::text),
      (3, 'Sūris', 30::numeric, 'g'::text),
      (4, 'Pomidorų padažas', 15::numeric, 'g'::text),
      (5, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (6, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grikiai su avokadu ir rūkyta/sūdyta lašiša', 'breakfast', 'Grikius išvirti arba užpilti karštu vandeniu. Paruoštus pagardinti druska. Įdėti pjaustytą avokadą, lašišą bei virtą kiaušinį. Pagardinti citrinpipiriais ir žalumynais.', 455, 46, 19, 19)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grikiai (sausi)', 50::numeric, 'g'::text),
      (2, 'Sūdyta/rūkyta lašiša', 40::numeric, 'g'::text),
      (3, 'Avokadas', 40::numeric, 'g'::text),
      (4, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Citrinpipiriai', null::numeric, null::text),
      (7, 'Švieži žalumynai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižinė košė su vaisiais ir jogurtu', 'breakfast', 'Avižas išvirti vandens pagrindu, virimo pabaigoje įmaišyti šaukštelį medaus. Įsidėti į dubenėlį, papuošti graikišku jogurtu ir norimu vaisiumi.', 350, 44, 12, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 50::numeric, 'g'::text),
      (2, 'Vanduo', 200::numeric, 'ml'::text),
      (3, 'Medus', 7::numeric, 'g'::text),
      (4, 'Graikiškas jogurtas', 50::numeric, 'g'::text),
      (5, 'Švieži vaisiai', 100::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grikiai su kiaušiniais ir pesto padažu', 'breakfast', 'Grikius išvirti arba užpilti iš vakaro karštu vandeniu (pasūdyti). Kiaušinius išvirti. Grikius sumaišyti su pesto padažu, uždėti virtus kiaušinius, šalia pomidoras ir kitos daržovės.', 440, 43, 23, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grikiai (sausi)', 50::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Pesto padažas', 15::numeric, 'g'::text),
      (4, 'Pomidoras', 50::numeric, 'g'::text),
      (5, 'Šviežios daržovės', 50::numeric, 'g'::text),
      (6, 'Druska', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Šokoladinė avižų košė', 'breakfast', 'Avižas užpilame pienu/vandeniu, dedame druskos ir verdame ant vidutinės kaitros nuolat maišant. Virimo pabaigoje įmaišyti juodąjį šokoladą. Patiekiama su vaisiais/uogomis, riešutų sviestu ir cinamonu.', 465, 70, 15, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 60::numeric, 'g'::text),
      (2, 'Pienas', 200::numeric, 'ml'::text),
      (3, 'Juodasis šokoladas', 15::numeric, 'g'::text),
      (4, 'Riešutų sviestas', 10::numeric, 'g'::text),
      (5, 'Švieži vaisiai', 80::numeric, 'g'::text),
      (6, 'Cinamonas', null::numeric, null::text),
      (7, 'Druska', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tortilijos suktinukas su kiaušiniais', 'breakfast', 'Virtą kiaušinį, sūrį ir smulkintą česnaką sutarkuoti, sumaišyti su majonezu ir pipirais. Pertepti tortiliją, susukti, supjaustyti. Patiekti su daržovėmis.', 480, 20, 18, 23)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Sūris', 30::numeric, 'g'::text),
      (4, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (5, 'Majonezas', 15::numeric, 'g'::text),
      (6, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (7, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kefyro blynai', 'breakfast', 'Kefyrą, kiaušinį, saldiklį, vanilę, tirpintą sviestą išplakti. Suberti miltus su kepimo milteliais, išmaišyti ir palikti 10 min. Kepame keptuvėje iš abiejų pusių. Patiekiame su jogurtu ir kivi/granatų sėklomis/uogomis.', 435, 49, 19, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kefyras', 150::numeric, 'ml'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Miltai', 50::numeric, 'g'::text),
      (4, 'Sviestas', 10::numeric, 'g'::text),
      (5, 'Kepimo milteliai', 3::numeric, 'g'::text),
      (6, 'Graikiškas jogurtas', 40::numeric, 'g'::text),
      (7, 'Švieži vaisiai', 50::numeric, 'g'::text),
      (8, 'Saldiklis', null::numeric, null::text),
      (9, 'Vanilė', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pomidorinis troškinys', 'lunch', 'Apkepinti maltą jautieną, suberti smulkintas daržoves (paprika, svogūnas, česnakas, morka) ir prieskonius. Pakepinti porą minučių. Supilti vandens/sultinio, konservuotus pomidorus, suberti ryžius ir virti ~15-20 min. Porcija 2 dienoms.', 475, 37, 33, 19)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa jautienos malta mėsa', 200::numeric, 'g'::text),
      (2, 'Konservuoti pomidorai', 200::numeric, 'g'::text),
      (3, 'Ryžiai (sausi)', 50::numeric, 'g'::text),
      (4, 'Paprika', 60::numeric, 'g'::text),
      (5, 'Svogūnas', 40::numeric, 'g'::text),
      (6, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (7, 'Morka', 50::numeric, 'g'::text),
      (8, 'Vanduo', 200::numeric, 'ml'::text),
      (9, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kreminiai pesto makaronai su vištiena ir daržovėmis', 'lunch', 'Makaronus išvirti pasūdytame vandenyje (pasilikti pusę samtelio vandens). Vištieną supjaustyti, pakepinti aliejuje iki auksinės spalvos. Suberti česnaką, špinatus, sudėti pesto padažą, makaronus, įpilti makaronų virimo vandens ir įmaišyti kreminį sūrį. Porcija 2 dienoms.', 500, 38, 45, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Makaronai (sausi)', 100::numeric, 'g'::text),
      (2, 'Vištienos krūtinėlė', 250::numeric, 'g'::text),
      (3, 'Pesto padažas', 30::numeric, 'g'::text),
      (4, 'Kreminis sūris', 30::numeric, 'g'::text),
      (5, 'Špinatai', 40::numeric, 'g'::text),
      (6, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (7, 'Aliejus', 10::numeric, 'g'::text),
      (8, 'Druska', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kapoti menkės kepsniukai su bulvių koše', 'lunch', 'Menkę sukapoti smulkiais kubeliais, sumaišyti su smulkintu svogūnu, tarkuota morka, miltais, prieskoniais ir kiaušiniu. Kepti keptuvėje iš abiejų pusių. Išvirti bulves, sutrinti pilant karštą pieną. Patiekti su bulvių koše ir šviežiomis daržovėmis. Porcija 2 dienoms.', 490, 32.5, 32.5, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Menkės filė', 250::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Miltai', 20::numeric, 'g'::text),
      (4, 'Svogūnas', 30::numeric, 'g'::text),
      (5, 'Morka', 40::numeric, 'g'::text),
      (6, 'Bulvės', 250::numeric, 'g'::text),
      (7, 'Pienas', 50::numeric, 'ml'::text),
      (8, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (9, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tortilijos čeburėkas', 'lunch', 'Maltą jautieną apkepinti sausoje keptuvėje su prieskoniais (galima įdėti svogūną, česnaką, morką). Tortilijos kraštus sudrėkinti vandeniu, sudėti jautieną bei sūrį ant vienos pusės ir užlenkti perpus, kraštus prispaudžiant šakute. Pašauti į orkaitę/gruzdintuvę 185°C ~7-10 min.', 420, 21, 34, 21)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Liesa jautienos malta mėsa', 120::numeric, 'g'::text),
      (3, 'Sūris', 30::numeric, 'g'::text),
      (4, 'Svogūnas', 10::numeric, 'g'::text),
      (5, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (6, 'Morka', 10::numeric, 'g'::text),
      (7, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pikantiški varškės kamuoliukai', 'dinner', 'Varškę sumaišyti su smulkinta rūkyta vištiena, kiaušiniu, miltais, kepimo milteliais ir prieskoniais. Drėgnomis rankomis suformuoti kamuoliukus. Kepti karšto oro gruzdintuvėje arba orkaitėje 185°C ~15 min. Patiekti su padažu (graikiškas jogurtas, pomidorų padažas, česnakas) bei daržovėmis. Porcija 2 dienoms.', 490, 29, 61, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Varškė', 250::numeric, 'g'::text),
      (2, 'Rūkyta vištiena', 120::numeric, 'g'::text),
      (3, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (4, 'Miltai', 40::numeric, 'g'::text),
      (5, 'Kepimo milteliai', 3::numeric, 'g'::text),
      (6, 'Graikiškas jogurtas', 40::numeric, 'g'::text),
      (7, 'Pomidorų padažas', 20::numeric, 'g'::text),
      (8, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (9, 'Šviežios daržovės', 100::numeric, 'g'::text),
      (10, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Trinta moliūgų sriuba', 'dinner', 'Moliūgą, bulves ir svogūną supjaustyti, apšlakstyti aliejumi, pabarstyti itališkomis žolelėmis ir kepkite orkaitėje 185°C ~20 min. Sudėti daržoves į puodą, įpilti sultinio, prieskonių ir sutrinti trintuvu. Patiekti su skrudintomis šviesios duonos riekelėmis. Porcija 2 dienoms.', 380, 55, 18, 6)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Moliūgas', 400::numeric, 'g'::text),
      (2, 'Bulvės', 200::numeric, 'g'::text),
      (3, 'Svogūnas', 80::numeric, 'g'::text),
      (4, 'Sultinys', 300::numeric, 'ml'::text),
      (5, 'Aliejus', 10::numeric, 'g'::text),
      (6, 'Šviesi duona', 60::numeric, 'g'::text),
      (7, 'Itališkos žolelės', null::numeric, null::text),
      (8, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lašišos salotos su burokėlais ir medaus-citrinų padažu', 'dinner', 'Daržoves (burokėliai, špinatai/salotos, svogūnas, agurkai) susmulkinti ir sudėti į dubenį. Ant viršaus sudėti pasmulkintą lašišą ir sėklas. Užpilti padažu iš alyvuogių aliejaus, citrinos sulčių ir medaus. Patiekti su šviesia duonele.', 410, 40, 16, 19)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Sūdyta/rūkyta lašiša', 60::numeric, 'g'::text),
      (2, 'Virti/kepti burokėliai', 100::numeric, 'g'::text),
      (3, 'Špinatai', 50::numeric, 'g'::text),
      (4, 'Agurkas', 80::numeric, 'g'::text),
      (5, 'Svogūnas', 20::numeric, 'g'::text),
      (6, 'Moliūgų sėklos', 10::numeric, 'g'::text),
      (7, 'Alyvuogių aliejus', 10::numeric, 'g'::text),
      (8, 'Citrinos sultys', 10::numeric, 'ml'::text),
      (9, 'Medus', 5::numeric, 'g'::text),
      (10, 'Šviesi duona', 30::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Dubenėlis su vištiena ir žaliuoju avokadų padažu', 'dinner', 'Vištieną apkepinti keptuvėje su prieskoniais ir susmulkinti. Supjaustyti norimas daržoves ir sudėti į indą. Padažui sutrinti avokadą, žalumynus, graikišką jogurtą, vandenį ir citrinos sultis. Užpilti padažą ant salotų, išmaišyti. Šalia skrudinta duonos riekelė.', 450, 40, 50, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos krūtinėlė', 150::numeric, 'g'::text),
      (2, 'Avokadas', 50::numeric, 'g'::text),
      (3, 'Graikiškas jogurtas', 30::numeric, 'g'::text),
      (4, 'Šviežios daržovės', 120::numeric, 'g'::text),
      (5, 'Švieži žalumynai', 15::numeric, 'g'::text),
      (6, 'Citrinos sultys', 10::numeric, 'ml'::text),
      (7, 'Šviesi duona', 30::numeric, 'g'::text),
      (8, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pomidorų salotos su burrata sūriu', 'dinner', 'Pomidoriukus susmulkinti perpus, sudėti į indą kartu su rukola. Įmaišyti pesto padažą, druską ir pipirus. Uždtėti buratos sūrį ir papuošti baziliko lapeliais.', 420, 11, 16, 36)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Burrata sūris', 125::numeric, 'g'::text),
      (2, 'Vyšniniai pomidorai', 150::numeric, 'g'::text),
      (3, 'Rukola', 40::numeric, 'g'::text),
      (4, 'Pesto padažas', 15::numeric, 'g'::text),
      (5, 'Švieži baziliko lapeliai', 5::numeric, 'g'::text),
      (6, 'Druska', null::numeric, null::text),
      (7, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

-- Snacks

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Rūkyta vištiena / kalakutiena su šviežiomis daržovėmis', 'snack', '130g rūkytos vištienos/kalakutienos patiekti su šviežiomis daržovėmis.', 220, 5, 24, 11)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Rūkyta vištiena', 130::numeric, 'g'::text),
      (2, 'Šviežios daržovės', 100::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Chia pudingas', 'snack', 'Du v.š. Chia sėklyčių sumaišyti su 100g graikiško jogurto (2.5%) bei medumi ir palikti brinkti pernakt. Prieš valgant užsidėti uogų ar vaisių.', 230, 10, 16, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Chia sėklos', 25::numeric, 'g'::text),
      (2, 'Graikiškas jogurtas', 100::numeric, 'g'::text),
      (3, 'Medus', 7::numeric, 'g'::text),
      (4, 'Švieži vaisiai', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grūdėta varškė', 'snack', '200g grūdėtos varškės (iki 5% riebumo).', 204, 6, 22, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grūdėta varškė', 200::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Natūralus jogurtas su uogomis ir riešutų sviestu', 'snack', '200g natūralaus jogurto (2.5%) sumaišyti su sauja uogų, 10g riešutų sviesto ir cinamonu.', 270, 18, 21, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Graikiškas jogurtas', 200::numeric, 'g'::text),
      (2, 'Švieži vaisiai', 50::numeric, 'g'::text),
      (3, 'Riešutų sviestas', 10::numeric, 'g'::text),
      (4, 'Cinamonas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kefyras', 'snack', '500g kefyro (2.5%).', 270, 23, 17, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kefyras', 500::numeric, 'ml'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vytinta jautiena su daržovėmis', 'snack', '40g vytintos jautienos su agurku ir pomidoru.', 114, 3, 24, 1.8)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vytinta jautiena', 40::numeric, 'g'::text),
      (2, 'Agurkas', 50::numeric, 'g'::text),
      (3, 'Pomidoras', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('PikNik sūrio lazdelės su daržovėmis', 'snack', '4 vnt. PikNik lazdelių su agurku ir pomidoru.', 265, 4, 23, 17)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'PikNik sūrio lazdelės', 4::numeric, 'vnt.'::text),
      (2, 'Agurkas', 50::numeric, 'g'::text),
      (3, 'Pomidoras', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Džiugo sūris su daržovėmis', 'snack', '40g Džiugo sūrio gabaliukai su agurku ir pomidoru.', 175, 4, 15, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Džiugo sūris', 40::numeric, 'g'::text),
      (2, 'Agurkas', 50::numeric, 'g'::text),
      (3, 'Pomidoras', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Varškės sūris su medumi ir uogomis', 'snack', '100g varškės sūrio (13%) su šaukšteliu medaus ir uogomis.', 245, 11, 20, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Varškės sūris', 100::numeric, 'g'::text),
      (2, 'Medus', 7::numeric, 'g'::text),
      (3, 'Švieži vaisiai', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Liesa varškė su uogomis/vaisiais', 'snack', '180g liesos varškės sumaišyti su cinamonu, sauja uogų arba vienu vaisiumi bei saldikliu.', 207, 13, 36, 1)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Varškė', 180::numeric, 'g'::text),
      (2, 'Švieži vaisiai', 100::numeric, 'g'::text),
      (3, 'Cinamonas', null::numeric, null::text),
      (4, 'Saldiklis', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Naminiai bananiniai ledai', 'snack', 'Šaldytą bananą sutrinti elektriniu trintuvu su šlakeliu pieno/vandens ir šaukšteliu kakavos.', 150, 32, 2, 1)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Bananas', 120::numeric, 'g'::text),
      (2, 'Pienas', 30::numeric, 'ml'::text),
      (3, 'Kakava', 5::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Spragėsiai su druska', 'snack', '50g spragėsių su druska.', 207, 30, 5, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Spragėsiai', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Trapučiai / tortilija su riešutų sviestu ir bananu', 'snack', 'Tortilija arba pora ryžių trapučių su 15g riešutų sviesto, puse banano ar uogomis bei cinamonu.', 240, 40, 7, 7)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Riešutų sviestas', 15::numeric, 'g'::text),
      (3, 'Bananas', 50::numeric, 'g'::text),
      (4, 'Cinamonas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vaisiai', 'snack', 'Apie 300g pasirinktų norimų vaisių.', 150, 42, 0, 0)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Švieži vaisiai', 300::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Riešutai ir juodasis šokoladas', 'snack', '10 vnt. migdolų ar kitų riešutų (nekepintų, nesūdytų) ir 30g juodojo šokolado (ne mažiau 70%).', 270, 20, 5, 19)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Migdolai', 15::numeric, 'g'::text),
      (2, 'Juodasis šokoladas', 30::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Sumuštinis su kreminiu sūriu / avokadu ir paukštiena', 'snack', 'Pilno grūdo duonos riekelė arba du trapučiai su kreminiu sūriu (20g) arba trintu avokadu (40g) ir paukštienos kumpeliu/rūkyta vištiena.', 192, 10, 23, 3)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Šviesi duona', 30::numeric, 'g'::text),
      (2, 'Kreminis sūris', 20::numeric, 'g'::text),
      (3, 'Rūkyta vištiena', 40::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Humusas su daržovių lazdelėmis', 'snack', '100g humuso su agurkų, morkų, salierų, paprikos lazdelėmis.', 192, 10, 23, 3)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Humusas', 100::numeric, 'g'::text),
      (2, 'Šviežios daržovės', 150::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lęšių trapukai', 'snack', '70g ''Ustukių'' mini lęšių trapukų.', 235, null, 14.7, null)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lęšių trapukai', 70::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Džiovintas varškės sūris', 'snack', '50g Dvaro džiovinto varškės sūrio (20% rieb.).', 175, 1.6, 18.7, 10.0)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Džiovintas varškės sūris', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Obuolys su riešutiniu kremu', 'snack', 'Didesnį obuolį supjaustyti skiltelėmis, pabarstyti cinamonu. Graikišką jogurtą sumaišyti su riešutų sviestu (arba proteinu) ir mirkyti obuolio skilteles.', 230, 34, 8, 8)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Obuolys', 150::numeric, 'g'::text),
      (2, 'Graikiškas jogurtas', 50::numeric, 'g'::text),
      (3, 'Riešutų sviestas', 15::numeric, 'g'::text),
      (4, 'Cinamonas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Agurkų sushi', 'snack', 'Agurką skustuku supjaustyti juostelėmis, sudėti vieną šalia kitos užleidžiant kraštus, pertepti kreminiu sūriu, uždėti lašišą arba tuną, susukti ir supjaustyti.', 220, 3, 10, 17)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Agurkas', 150::numeric, 'g'::text),
      (2, 'Kreminis sūris', 30::numeric, 'g'::text),
      (3, 'Sūdyta/rūkyta lašiša', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Baltyminio pudingo desertas', 'snack', 'Želė pakuotę ištirpiname su 250ml karšto vandens, blenderiu įmaišome 400g graikiško jogurto, galima įdėti uogų. Supilstyti į indelius (2 porcijos).', 150, 10, 19, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Želė', 1::numeric, 'pakuotė'::text),
      (2, 'Graikiškas jogurtas', 200::numeric, 'g'::text),
      (3, 'Vanduo', 125::numeric, 'ml'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pupelių brownie', 'snack', 'Avižas sutrinti iki miltų, sudėti konservuotas raudonąsias pupeles, kepimo miltelius, medų, kokosų aliejų/sviestą, riešutų sviestą, kakavą, cinamoną ir sutrinti iki vientisos masės. Kepti 180°C 25 min. (Receptas 4 porcijoms).', 220, 32.5, 20, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 20::numeric, 'g'::text),
      (2, 'Konservuotos raudonosios pupelės', 60::numeric, 'g'::text),
      (3, 'Kepimo milteliai', 2::numeric, 'g'::text),
      (4, 'Medus', 10::numeric, 'g'::text),
      (5, 'Riešutų sviestas', 10::numeric, 'g'::text),
      (6, 'Kakava', 5::numeric, 'g'::text),
      (7, 'Cinamonas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Mini cukinijų picos', 'snack', 'Cukiniją supjaustyti 1.5-2 cm storio apskritimais, iškloti skardą. Paskirstyti pomidorų padažą, uždėti saliamio/kumpelio, sūrio, prieskonių ir kepti orkaitėje 15-20 min.', 290, 9, 16, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Cukinija', 200::numeric, 'g'::text),
      (2, 'Pomidorų padažas', 20::numeric, 'g'::text),
      (3, 'Kumpis', 30::numeric, 'g'::text),
      (4, 'Sūris', 30::numeric, 'g'::text),
      (5, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Burokėlių sriuba užkandžiui', 'snack', 'Ištirpinti sultinio kubelius vandenyje, suberti pjaustytas bulves ir lauro lapus. Keptuvėje pakepinti svogūną, morką ir burokėlius, tuomet viską sukrėsti į puodą ir virti iki suminkštės. Patiekiant galima įsidėti graikiško jogurto.', 210, 40, 7, 3)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Virti/kepti burokėliai', 150::numeric, 'g'::text),
      (2, 'Bulvės', 100::numeric, 'g'::text),
      (3, 'Morka', 50::numeric, 'g'::text),
      (4, 'Svogūnas', 30::numeric, 'g'::text),
      (5, 'Sultinys', 200::numeric, 'ml'::text),
      (6, 'Graikiškas jogurtas', 20::numeric, 'g'::text)
) as v (position, item, amount, unit);

-- Tips and recommendations

insert into public.tips (tip, tags) values
  ('Mitybos plane galima keisti patiekalus: pusryčius su pusryčiais, pietus su pietumis, vakarienę su vakariene.', array['nutrition', 'meal_substitution', 'planning']),
  ('Mitybos planas sudarytas 4 valgymams kas 3–5 valandas. Rekomenduojama tarp vakarienės ir pusryčių išlaikyti 12 valandų tarpą.', array['meal_timing', 'routine', 'schedule']),
  ('Svorio kritimo tempas skiriasi dėl genetikos, metabolizmo, hormonų, raumenų masės, miego bei streso lygio. Vertinkite savo progresą ilguoju laikotarpiu.', array['weight_loss', 'progress', 'mindset']),
  ('Porcijas šeimoje rekomenduojama dalinti lygiai iš šeimos narių skaičiaus, o norintys daugiau įsideda papildomai.', array['family', 'portions', 'planning']),
  ('Daržovėms pirmenybę teikite šviežioms bei raugintoms (rekomenduojama valgyti kasdien). Šaldytos daržovės taip pat kupinos vitaminų. Marinuotas daržoves vartokite labai retai dėl cukraus kiekio.', array['vegetables', 'fermented_food', 'health']),
  ('Kaip avokado pusę išlaikyti nepajuodavusią: apšlakstyti citrinų sultimis, suvynioti į maistinę plėvelę ir laikyti šaldytuve.', array['avocado', 'storage', 'tips']),
  ('Rinkitės graikišką jogurtą iki 4% riebumo bei grūdėtą varškę iki 5% riebumo.', array['dairy_products', 'yogurt', 'cottage_cheese']),
  ('Riešutų sviestą rinkitės tik tokį, kurio sudėtyje yra 100% riešutai (be pridėtinio aliejaus ir cukraus).', array['nut_butter', 'products', 'labels']),
  ('Tortilijas laikykite užsegamame maišelyje arba apvyniokite maistine plėvele, kad nebūtų oro tarpų – taip jos išliks minkštos ilgesnį laiką.', array['tortillas', 'storage', 'tips']),
  ('Duoną, mėsą ir kitus produktus galima užsišaldyti. Duona atšyla iškart ištraukus iš šaldiklio ir pašildžius sausoje keptuvėje arba orkaitėje.', array['freezing', 'bread', 'storage']),
  ('Garnyrus galima keisti vieną kitu tais pačiais gramais (ryžiai, grikiai, makaronai, bolivinė balanda, perlinės kruopos). Jei recepte numatyta 60 g kruopų, galima keisti į 300 g bulvių.', array['side_dishes', 'substitutions', 'potatoes']),
  ('Produktų pakeitimai: 100 g vištienos = 100 g baltos žuvies; 100 g jautienos = 100 g lašišos/upėtakio; avokadą galima keisti humusu arba varškės užtepėle.', array['substitutions', 'alternatives', 'nutrition']),
  ('Lengviausias būdas paruošti kruopas (grikius ar avižas): užpilti karštu vandeniu iš vakaro, įberti druskos ir palikti pernakt. Ryte užteks tik pasišildyti.', array['grains', 'cooking', 'quick']),
  ('Saldiklius (stevia, ksilitolį, eritritolį, skonio lašiukus) naudokite vietoje cukraus, tačiau pamažu mažinkite saldinimą apskritai.', array['sweeteners', 'sugar', 'health']),
  ('Maistą būtina sverti maistinėmis svarstyklėmis. Nesveriamos tik šviežios daržovės ir prieskoniai.', array['scale', 'weighing', 'calories']);

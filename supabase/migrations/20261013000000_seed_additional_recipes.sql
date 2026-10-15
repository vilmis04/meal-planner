-- Seed data, part 2: additional recipes from the second meal plans (weeks 1-2 breakfasts, lunches, dinners and extra snacks).
-- Recipes whose (name, meal_type) already exist in the first seed migration are not repeated.

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Karšti picos sumuštiniai', 'breakfast', 'Kumpį sutarkuoti/susmulkinti, sūrį sutarkuoti, daržoves susmulkinti. Viską sumaišyti su pomidorų padažu ir picos prieskoniais. Tepti ant duonelių ir pašauti į orkaitę/karšto oro gruzdintuvę 180C iki 10 min.', 400, 36, 30, 11)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kalakutienos/kiaulienos kumpis', 60::numeric, 'g'::text),
      (2, 'Mocarela light sūris', 50::numeric, 'g'::text),
      (3, 'Marinuoti agurkėliai', null::numeric, null::text),
      (4, 'Picos prieskoniai', null::numeric, null::text),
      (5, 'Pomidorų padažas', null::numeric, null::text),
      (6, 'Svogūnas', 0.5::numeric, 'vnt.'::text),
      (7, 'Pievagrybiai / paprika / kitos daržovės', null::numeric, null::text),
      (8, 'Šviesi duona', 3::numeric, 'riekelė'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avokado sumuštiniai su keptais kiaušiniais', 'breakfast', 'Avokadą sutrinti su prieskoniais, užtepti ant paskrudintos duonos. Įkaitintoje keptuvėje iškepti du kiaušinius (galite ir suplakti, jei norite). Iškepusius kiaušinius uždėti ant duonos. Šalia šviežios daržovės, galite užsidėti marinuotų svogūnų.', 400, 59, 19, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avokadas', 50::numeric, 'g'::text),
      (2, 'Šviesi duona', 2::numeric, 'riekelė'::text),
      (3, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (4, 'Citrinpipiriai', null::numeric, null::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Aliejus', 1::numeric, 'a.š.'::text),
      (7, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grūdėtos varškės paplotėliai su gvakamole', 'breakfast', 'Grūdėtą varškę su kiaušiniais ir prieskoniais išplakti. Gausis skysta masė. Į kepimo popieriumi išklotą skardą supilkite gautą masę ir formuokite norimo dydžio paplotėlius. Kepkite 170C 30 min. Gvakamolei visus ingredientus susmulkinkite (avokadą sutrinkite) ir sumaišykite kartu. Ant paplotėlių dėkite gvakamolės ir valgykite.', 445, 10, 34, 31)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grūdėta varškė', 200::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Pipirai', null::numeric, null::text),
      (5, 'Itališkos žolelės', null::numeric, null::text),
      (6, 'Avokadas', 50::numeric, 'g'::text),
      (7, 'Pomidoras', 1::numeric, 'vnt.'::text),
      (8, 'Svogūnas', 0.25::numeric, 'vnt.'::text),
      (9, 'Švieži žalumynai', null::numeric, null::text),
      (10, 'Laimo sultys', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Minkšti vafliukai', 'breakfast', 'Visus ingredientus sutrinti elektriniu trintuvu ir kepti įkaitintoje vaflinėje. Patiekti su graikišku jogurtu (60g), uogomis ir/ar kivi.', 490, 57, 26, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (2, 'Pienas', 80::numeric, 'ml'::text),
      (3, 'Viso grūdo miltai', 70::numeric, 'g'::text),
      (4, 'Saldiklis', null::numeric, null::text),
      (5, 'Sviestas', 5::numeric, 'g'::text),
      (6, 'Cinamonas', null::numeric, null::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Kepimo milteliai', 0.5::numeric, 'a.š.'::text),
      (9, 'Graikiškas jogurtas', 60::numeric, 'g'::text),
      (10, 'Švieži vaisiai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Salotos su vištiena ir kiaušiniu', 'lunch', 'Pagardinti vištieną prieskoniais ir iškepti orkaitėje/karšto oro gruzdintuvėje. Daržoves susmulkinti. Padažą sumaišyti. Iškeptą vištieną supjaustyti gabaliukais, sumaišyti viską kartu, suberti sūrį. Šalia duonos riekelė.', 470, 21, 54, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos filė', 130::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Šviežios daržovės', null::numeric, null::text),
      (4, 'Salotų lapai', null::numeric, null::text),
      (5, 'Kietasis sūris', 10::numeric, 'g'::text),
      (6, 'Šviesi duona', 1::numeric, 'riekelė'::text),
      (7, 'Graikiškas jogurtas', 60::numeric, 'g'::text),
      (8, 'Rūkyta paprika', null::numeric, null::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Pipirai', null::numeric, null::text),
      (11, 'Marinuotų agurkėlių skystis', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Meduje kepta vištiena', 'lunch', 'Vištieną supjaustome gabaliukais, pagardiname prieskoniais ir dedame kepti į įkaitintą keptuvę. Apkepiname, atidedame į atskirą lėkštę ir į keptuvę pilame padažo ingredientus, išmaišome ir grąžiname vištieną. Sumažiname kaitrą ir troškiname vištieną dar keletą minučių. Patiekiame su ryžiais. Porcija dviems dienoms. (Vietoje filė galima naudoti 250g šlaunelių mėsos.)', 480, 60, 40, 7.5)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos filė', 300::numeric, 'g'::text),
      (2, 'Prieskoniai', null::numeric, null::text),
      (3, 'Aliejus', 10::numeric, 'ml'::text),
      (4, 'Ryžiai (sausi)', 100::numeric, 'g'::text),
      (5, 'Sojų padažas', 20::numeric, 'ml'::text),
      (6, 'Medus', 40::numeric, 'g'::text),
      (7, 'Citrinos sultys', null::numeric, null::text),
      (8, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Jautienos čili troškinys', 'lunch', 'Mėsą apkepti SAUSOJE keptuvėje. Į puodą sudedame konservuotas daržoves ir mėsą, kai apkeps. Susmulkiname česnaką, svogūną, apkepame ir metame į puodą. Paprieskoniuojame. Įpilame vieną stiklinę vandens, patroškiname 10-15 min. Troškinimo gale įdedame juodą šokoladą, išmaišome. Patiekti su laimu ir jogurtu. Porcija dviems dienoms; vienai porcijai yra apie 400-450g troškinio.', 450, 44, 38, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa jautienos malta mėsa', 300::numeric, 'g'::text),
      (2, 'Konservuoti pomidorai', 1::numeric, 'skardinė'::text),
      (3, 'Konservuotos pupelės', 1::numeric, 'skardinė'::text),
      (4, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (5, 'Svogūnas', 1::numeric, 'vnt.'::text),
      (6, 'Švieži žalumynai', null::numeric, null::text),
      (7, 'Prieskoniai', null::numeric, null::text),
      (8, 'Juodasis šokoladas', 10::numeric, 'g'::text),
      (9, 'Laimas', 1::numeric, 'skiltelė'::text),
      (10, 'Graikiškas jogurtas', 40::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vištiena su morkomis ir grietinėle', 'lunch', 'Morką sutarkuoti, svogūną ir česnaką sukapoti ir pakepinti ghee svieste. Vištieną ištrinti prieskoniais, supjaustyti norimais gabaliukais. Apkepus daržovėms sudėti vištieną ir apkepti iš abiejų pusių, sudėti grietinėlę ir troškinti apie 15 min ant silpnos kaitros. Patiekti su norimu garnyru ir gausiai šviežių daržovių.', 485, 52, 42, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos filė', 300::numeric, 'g'::text),
      (2, 'Prieskoniai', null::numeric, null::text),
      (3, 'Morka', 1::numeric, 'vnt.'::text),
      (4, 'Svogūnas', 1::numeric, 'vnt.'::text),
      (5, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (6, 'Liesa grietinėlė 12%', 100::numeric, 'ml'::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text),
      (9, 'Ghee sviestas', 5::numeric, 'g'::text),
      (10, 'Garnyras (makaronai/kruopos)', 100::numeric, 'g'::text),
      (11, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grūdėtos varškės salotos', 'dinner', 'Daržoves supjaustyti norimo dydžio gabalėliais, sumaišyti su grūdėta varške ir prieskoniais.', 380, 18, 27, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grūdėta varškė', 200::numeric, 'g'::text),
      (2, 'Agurkas', null::numeric, null::text),
      (3, 'Svogūnas', null::numeric, null::text),
      (4, 'Vyšniniai pomidorai', null::numeric, null::text),
      (5, 'Avokadas', 0.5::numeric, 'vnt.'::text),
      (6, 'Krapai / kiti žalumynai', null::numeric, null::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lašiša su šviežių daržovių salotomis', 'dinner', 'Lašišą pagardinti prieskoniais ir išsikepti karšto oro gruzdintuvėje/keptuvėje ar orkaitėje. Iš smulkintų daržovių, jogurto ir pasirinktų prieskonių sumaišyti salotas. Šalia patiekti ryžius.', null, 38, 30, 29)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lašišos filė', 150::numeric, 'g'::text),
      (2, 'Citrinpipiriai', null::numeric, null::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Agurkai, pomidorai, kitos daržovės', null::numeric, null::text),
      (5, 'Graikiškas jogurtas', 50::numeric, 'g'::text),
      (6, 'Česnako milteliai / petražolės', null::numeric, null::text),
      (7, 'Pipirai', null::numeric, null::text),
      (8, 'Ryžiai (sausi)', 50::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Brokolių ir kiaušinių sūrio keksiukai', 'dinner', 'Brokolius apvirti minutę ir gerai susmulkinti, tuomet sumaišyti su sūriu, jogurtu, išplaktais kiaušiniais. Sudėti smulkintus žoleles, permaišyti ir supilti į silikonines keksiukų formeles. Kepti 180C apie 15 min. Po kepimo atvėsinti 3-5 min ir skanauti. Šalia riekelė juodos duonos (arba dvi šviesios).', 365, 24, 29, 21)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Brokolis', 100::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Graikiškas jogurtas', 50::numeric, 'g'::text),
      (4, 'Tarkuotas sūris', 15::numeric, 'g'::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text),
      (7, 'Itališkos žolelės', null::numeric, null::text),
      (8, 'Svogūnas', 0.25::numeric, 'vnt.'::text),
      (9, 'Juoda duona', 1::numeric, 'riekelė'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Įdaryti kiaušiniai', 'dinner', 'Kiaušinius kietai išvirti (į verdantį vandenį dėti acto ar citrinos sulčių, kad lengviau nusiluptų), perpjauti pusiau. Trynius sumaišyti su visais ingredientais ir įdaryti kiaušinius. Šalia daržovės ir duonos riekelė (apie 60g).', 380, 23, 20, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 4::numeric, 'vnt.'::text),
      (2, 'Citrinos sultys arba actas', 1::numeric, 'a.š.'::text),
      (3, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (4, 'Tarkuotas sūris', 20::numeric, 'g'::text),
      (5, 'Light majonezas', 1::numeric, 'v.š.'::text),
      (6, 'Graikiškas jogurtas', 1::numeric, 'v.š.'::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text),
      (9, 'Švieži žalumynai', null::numeric, null::text),
      (10, 'Šviežios daržovės', null::numeric, null::text),
      (11, 'Duona', 60::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Salotos su vištiena ir riešutų padažu', 'dinner', 'Vištieną pamarinuojame norimais prieskoniais. Pamarinuotą vištieną dedame kepti į orkaitę/gruzdintuvę. Tuo tarpu susipjaustome daržoves. Visus padažui skirtus ingredientus sudedame į įkaitintą keptuvę, paliekame silpną kaitrą, maišome iki vienalytės masės. Ant daržovių sudedame iškeptą vištieną ir užpilame padažu.', 430, 13, 25, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos filė', 130::numeric, 'g'::text),
      (2, 'Šviežios daržovės', null::numeric, null::text),
      (3, 'Žemės riešutų sviestas', 15::numeric, 'g'::text),
      (4, 'Sojų padažas', 2::numeric, 'v.š.'::text),
      (5, 'Medus', 1::numeric, 'v.š.'::text),
      (6, 'Citrinos sultys', 0.5::numeric, 'citrinos'::text),
      (7, 'Actas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Brokolių salotos su vištiena', 'dinner', 'Vištieną (sverti neapdorotą) iškepti orkaitėje su mėgstamais prieskoniais. Brokolį ir obuolį supjaustyti, vištieną susmulkinti. Viską sumaišyti su jogurtu, pagardinti prieskoniais.', 440, 30, 43, 7)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Brokolis', 0.25::numeric, 'galvos'::text),
      (2, 'Keptos vištienos filė (svertas neapdorotas)', 150::numeric, 'g'::text),
      (3, 'Obuolys', 1::numeric, 'vnt.'::text),
      (4, 'Graikiškas jogurtas', null::numeric, null::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Mocarela sūrio salotos', 'dinner', 'Supjaustome daržoves ir mocarelos sūrį, kiaušinį išvirdame ir pjauname į keturias ar daugiau dalių. Viską sumaišome su paruoštu padažu (citrinos sultys, alyvuogių aliejus, petražolių prieskoniai).', 445, 12, 34, 31)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Mocarela sūris', 125::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Pomidoriukai', null::numeric, null::text),
      (4, 'Agurkai', null::numeric, null::text),
      (5, 'Svogūnas', 0.5::numeric, 'vnt.'::text),
      (6, 'Kitos mėgstamos daržovės', null::numeric, null::text),
      (7, 'Citrinos sultys', null::numeric, null::text),
      (8, 'Alyvuogių aliejus', 1::numeric, 'v.š.'::text),
      (9, 'Petražolių prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Grikių/bulgur košė su sūriu', 'breakfast', 'Pasūdyti grikius ir sumaišyti su tarkuotu sūriu. Juos galima užpilti karštu vandeniu ir ryte užteks tik pasišildyti bei uždėti pagardus.', 350, 43, 21, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Grikiai (sausi)', 60::numeric, 'g'::text),
      (2, 'Kietasis sūris', 20::numeric, 'g'::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Sviestas', 5::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižinė košė su kivi ir jogurtu', 'breakfast', 'Avižas išvirti vandens pagrindu, virimo pabaigoje įmušti kiaušinį ir gerai išmaišyti. Įdėti į dubenėlį košę, tada papuošti jogurtu, kiviu, uždėti riešutų sviestą.', 350, 44, 12, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 50::numeric, 'g'::text),
      (2, 'Graikiškas jogurtas', 60::numeric, 'g'::text),
      (3, 'Kivis', 1::numeric, 'vnt.'::text),
      (4, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (5, 'Riešutų sviestas', 10::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Obuolinė granola', 'breakfast', 'Į dubenį beriame avižas, sutarkuojame obuolį (galite keisti bananu ir sutrinti jį), dedame cinamono ir saldiklio. Keptuvėje ištirpiname norimą riebalą ir beriame paruoštą mišinį, kepiname iš visų pusių kol apskrus. (Jei turite laiko, galite kepti orkaitėje ar karšto oro gruzdintuvėje 185C 10 min.) Į indelį dedame jogurtą, suberiame kepintas avižas, supjaustome kivi.', 380, 47, 21, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Obuolys', 1::numeric, 'vnt.'::text),
      (2, 'Cinamonas', null::numeric, null::text),
      (3, 'Avižiniai dribsniai', 45::numeric, 'g'::text),
      (4, 'Sviestas/ghee arba kepimo aliejus', 5::numeric, 'g'::text),
      (5, 'Saldiklis', null::numeric, null::text),
      (6, 'Graikiškas jogurtas', 160::numeric, 'g'::text),
      (7, 'Kivis', 1::numeric, 'vnt.'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Sumuštiniai su kiaušinių užtepėle', 'breakfast', 'Duoneles paskrudiname sausoje keptuvėje, o tuo tarpu susismulkiname ir susimaišome visus išvardintus ingredientus. Užtepėlę tepame ant paskrudintos duonos ir valgome iškart.', 390, 43, 25, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (2, 'Garstyčios', 1::numeric, 'a.š.'::text),
      (3, 'Graikiškas jogurtas', 1::numeric, 'v.š.'::text),
      (4, 'Druska', null::numeric, null::text),
      (5, 'Pipirai', null::numeric, null::text),
      (6, 'Česnako milteliai', null::numeric, null::text),
      (7, 'Švieži žalumynai', null::numeric, null::text),
      (8, 'Juoda duona', 2::numeric, 'riekelė'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Benedikto kiaušiniai', 'breakfast', 'Užvirti vandenį, kai užburbuliuos, sumažinti kaitrą iki vidutinės. Įpilti truputį acto, druskos. Gerai išsukti vandenį, o tada įleisti du kiaušinius vieną po kito, greitai. Nebeliesti. Virti 4 min su laikmačiu. Patiekiame ant juodos duonos arba 50g grikių (sverti nevirtus). Priedai: 50g avokado ir 40g rūkytos/sūdytos lašišos. Citrinpipiriai, druska, pipirai ant viršaus.', 500, 40, 26, 28)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (2, 'Actas', null::numeric, null::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Juoda duona arba grikiai (sausi)', 50::numeric, 'g'::text),
      (5, 'Avokadas', 50::numeric, 'g'::text),
      (6, 'Sūdyta/rūkyta lašiša', 40::numeric, 'g'::text),
      (7, 'Citrinpipiriai', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Vištienos šlaunelių mėsa su makaronais', 'lunch', 'Vištieną pjaustytą gabaliukais su česnaku pakepti ant ghee sviesto ar aliejaus, pagardinti prieskoniais. Puode su druska išvirkite makaronus kaip nurodyta. Patiekti su raugintais kopūstais ar šviežiomis daržovėmis. Porcija dviem dienoms.', 450, 47, 35, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Vištienos šlaunelių mėsa', 300::numeric, 'g'::text),
      (2, 'Makaronai (sausi)', 120::numeric, 'g'::text),
      (3, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (4, 'Druska', null::numeric, null::text),
      (5, 'Pipirai', null::numeric, null::text),
      (6, 'Prieskoniai', null::numeric, null::text),
      (7, 'Ghee sviestas arba alyvuogių aliejus', 5::numeric, 'g'::text),
      (8, 'Raugintos arba šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Paukštienos kotletukai su keptais svogūnais ir pievagrybiais', 'lunch', 'Vištieną, prieskonius, svogūną ir kiaušinį sublenderiuoti (jei naudojate maltą mėsą galite neblenderiuoti). Susmulkintus pievagrybius apkepinti keptuvėje su lašeliu aliejaus/sviesto. Pievagrybius sudėti į mėsos masę, formuoti drėgnomis rankomis kotletukus ir dėti tiesiai į įkaitintą keptuvę. Patiekti su norimu garnyru ir šviežiomis daržovėmis. Porcija dviem dienoms.', 450, 41, 48, 11.5)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Malta vištiena arba filė', 300::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Pievagrybiai', 200::numeric, 'g'::text),
      (4, 'Svogūnas', null::numeric, null::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text),
      (7, 'Ghee sviestas arba aliejus', 5::numeric, 'g'::text),
      (8, 'Garnyras (makaronai/kruopos)', 100::numeric, 'g'::text),
      (9, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Graikiškas dubuo', 'lunch', 'Maltą vištieną sumaišome su prieskoniais. Dedame kepti į įkaitintą keptuvę, per tą laiką pasipjaustome daržoves, pasiruošiame padažą iš jogurto ir petražolių prieskonių. Sudedame viską į dubenėlį, užbarstome fetos sūrį.', 480, 55, 42, 5)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Ryžiai (sausi)', 60::numeric, 'g'::text),
      (2, 'Malta vištiena', 130::numeric, 'g'::text),
      (3, 'Ghee sviestas arba aliejus', 5::numeric, 'g'::text),
      (4, 'Vištienos prieskoniai', null::numeric, null::text),
      (5, 'Fetos sūris', 20::numeric, 'g'::text),
      (6, 'Salotos, pomidoras, agurkas, raudonas svogūnas, krapai, mėtos', null::numeric, null::text),
      (7, 'Graikiškas jogurtas', 50::numeric, 'g'::text),
      (8, 'Petražolių prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Salotos su keptais batatais', 'lunch', 'Bulves supjaustome 1 cm pločio griežinėliais. Sumaišome su aliejumi, druska. Dėliojame bulves į kepimo skardą. Nesuglaudžiame gabalėlių, kad bulvės apskrustų, o ne išsitroškintų. Kepame 210 laipsnių orkaitėje 20 min, apverčiame ir kepame dar 10-15 min. Per tą laiką supjaustome daržoves, sumaišome su jogurtu ir petražolėmis, sudedame keptus batatus, permaišome. Ant viršaus patrupiname sūrio.', 400, 47, 15, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Saldžios bulvės (batatai)', 200::numeric, 'g'::text),
      (2, 'Salotų lapai', null::numeric, null::text),
      (3, 'Agurkas', null::numeric, null::text),
      (4, 'Pomidoras', null::numeric, null::text),
      (5, 'Svogūnas', null::numeric, null::text),
      (6, 'Kitos daržovės', null::numeric, null::text),
      (7, 'Graikiškas jogurtas', 60::numeric, 'g'::text),
      (8, 'Petražolės', null::numeric, null::text),
      (9, 'Aliejus', 5::numeric, 'ml'::text),
      (10, 'Fetos arba ožkos sūris', 30::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('BLT sumuštinis', 'lunch', 'Duonos riekeles pertepti padažu (sumaišyti majonezą, jogurtą ir prieskonius), uždėti pagardus ant vienos duonelės, antrą uždėti ant viršaus ir pjauti sumuštinį perpus. Šalia pasipjaustom daržovių: agurko skiltelės, pomidoras, paprika.', 420, 31, 33, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Viso grūdo duona (šviesi, kvadratinė)', 2::numeric, 'riekelė'::text),
      (2, 'Keptos paukštienos mėsa (be riebalų)', 100::numeric, 'g'::text),
      (3, 'Rūkyta šoninė', 2::numeric, 'juostelės'::text),
      (4, 'Salotų lapai', null::numeric, null::text),
      (5, 'Pomidoras', null::numeric, null::text),
      (6, 'Svogūnas', null::numeric, null::text),
      (7, 'Liesas majonezas', 30::numeric, 'g'::text),
      (8, 'Graikiškas jogurtas', 30::numeric, 'g'::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Pipirai', null::numeric, null::text),
      (11, 'Rūkyta paprika', null::numeric, null::text),
      (12, 'Agurkas', null::numeric, null::text),
      (13, 'Paprika', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kugelio pusbrolis', 'dinner', 'Cukiniją sutarkuojame stambia tarka (burokine), pabarstome druska ir paliekame pastovėti, kad išskirtų kuo daugiau skysčio. Per tą laiką varškę ir kiaušinius kokteilinėje arba blenderio pagalba išplakame iki vientisos masės. Atskirai sutarkuojame mocarelą. Nuspaudžiame skystį iš cukinijos, į tarkius sudedame visus ingredientus, išmaišome ir pašauname į įkaitusią orkaitę 180C 40 min. Patiekiame su graikišku jogurtu, 70g porcijai. Porcija dviem dienoms.', 430, 25, 50, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Cukinija', 400::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Liesa varškė', 200::numeric, 'g'::text),
      (4, 'Mocarela light', 125::numeric, 'g'::text),
      (5, 'Miltai', 30::numeric, 'g'::text),
      (6, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (7, 'Itališkos žolelės / picos prieskoniai', null::numeric, null::text),
      (8, 'Graikiškas jogurtas', 70::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Morkų wrapai su lašiša ir kreminiu sūriu', 'dinner', 'Morkas sutarkuojame per smulkią/burokinę tarką (kaip labiau patinka) ir sumaišom su sūriu ir kiaušiniais. Suformuojam keturis paplotėlius. Kepam 220C apie 12-15 min (stebėkit, kai apskrunda iki jums norimo varianto). Paplotėlius padalinti dviems dienoms. Įdarui: pertepti paplotėlius kreminiu sūriu, uždėti salotas, pagardinti citrinpipiriais ir uždėti lašišą.', 390, 23, 21, 27)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Morkos', 300::numeric, 'g'::text),
      (2, 'Fermentinis sūris', 40::numeric, 'g'::text),
      (3, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (4, 'Kreminis sūris', 40::numeric, 'g'::text),
      (5, 'Rūkyta lašiša', 40::numeric, 'g'::text),
      (6, 'Salotų lapai', null::numeric, null::text),
      (7, 'Citrinpipiriai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tuno salotos su kepta duona', 'dinner', 'Duoną susmulkinti smulkiais kvadratėliais, pakepinti sausoje keptuvėje/orkaitėje. Visus likusius ingredientus sumaišyti. Sudėti iškeptus duonos gabalėlius, permaišyti.', 410, 23, 43, 15)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Juoda duona', 40::numeric, 'g'::text),
      (2, 'Konservuotas tunas savo sultyse', 1::numeric, 'skardinė'::text),
      (3, 'Svogūnlaiškiai', null::numeric, null::text),
      (4, 'Tarkuotas kietas sūris', 10::numeric, 'g'::text),
      (5, 'Liesas majonezas arba graikiškas jogurtas', 2::numeric, 'v.š.'::text),
      (6, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Varškės bandelės orkaitėje', 'dinner', 'Tešlos ingredientus sumaišyti iki vientisos masės, kuri turi gautis kiek lipni. Tešlą padalinti į 4 dalis, suformuoti ovalias bandeles ir pirštų pagalba per vidurį padaryti įdubimus. Įdaro ingredientus (išskyrus vyšnias) sumaišyti, paskirstyti per bandelių vidurį ir uždėti uogytes. Kepti 185C apie 30 min (orkaitėje/gruzdintuvėje).', 485, 36, 50, 16)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Varškė 0.5%', 180::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Miltai', 50::numeric, 'g'::text),
      (4, 'Kepimo milteliai', 0.5::numeric, 'a.š.'::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Saldiklis', null::numeric, null::text),
      (7, 'Natūralus/graikiškas jogurtas', 70::numeric, 'g'::text),
      (8, 'Kreminis sūris', 40::numeric, 'g'::text),
      (9, 'Vanilė', null::numeric, null::text),
      (10, 'Šaldytos vyšnios (arba kitos uogos)', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Juodos duonos sumuštinis su plaktais kiaušiniais', 'breakfast', 'Kiaušinius išplakti su prieskoniais, keptuvėje išlydyti riebalą ir supilti kiaušinių plakinį. Iškart maišyti mentele ratu, kai masė pradės formuotis, ugnį sumažinti ir leisti šiek tiek pakepti. Iškepusius kiaušinius uždėti ant duonos ir valgyti su daržovėmis šalia. Pagaminimas užtrunka iki 5 min.', 460, 48, 19, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Pilno grūdo duona', 2::numeric, 'riekelė'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Pipirai', null::numeric, null::text),
      (5, 'Šviežios daržovės', null::numeric, null::text),
      (6, 'Ghee sviestas arba alyvuogių aliejus', 5::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižinė košė su kietuoju sūriu ir kiaušiniu', 'breakfast', 'Avižas išvirti vandenyje, į virimo pabaigą įdėti sūrį ir išmaišyti, kad išsilydytų. Kiaušinį išvirti arba iškepti. Sudėti į dubenėlį košę, pagardinti ją prieskoniais, uždėti kiaušinį. Papildomai galima pasipjaustyti šiek tiek poro/svogūno.', 410, 42, 27, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižiniai dribsniai', 60::numeric, 'g'::text),
      (2, 'Vanduo', 100::numeric, 'ml'::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Pipirai', null::numeric, null::text),
      (5, 'Kietasis sūris', 12.5::numeric, 'g'::text),
      (6, 'Petražolių prieskoniai', null::numeric, null::text),
      (7, 'Kiaušiniai', 1::numeric, 'vnt.'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Chia pudingas', 'breakfast', 'Ruošti iš vakaro (galima pasidaryti daugiau, šaldytuve gali būti iki 5 d.). Sumaišome viską kartu indelyje, stiklinėje ir laikome per naktį. Ryte gardiname trintais/pjaustytais vaisiais, uogomis. Galima įsidėti sėklų apie 5g. (Vietoje 250ml augalinio pieno gali būti 200g natūralaus jogurto.)', 440, 37, 12, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Chia sėklos', 4::numeric, 'v.š.'::text),
      (2, 'Augalinis pienas arba natūralus jogurtas', 250::numeric, 'ml'::text),
      (3, 'Saldiklis / medus', null::numeric, null::text),
      (4, 'Vaisiai / uogos', null::numeric, null::text),
      (5, 'Sėklos', 5::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Augalinės sočios salotos', 'lunch', 'Viską sumaišyti kartu.', 480, 68, 23, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lęšiai (sausi)', 60::numeric, 'g'::text),
      (2, 'Avokadas', 50::numeric, 'g'::text),
      (3, 'Konservuotos pupelės', 100::numeric, 'g'::text),
      (4, 'Pomidoriukai', null::numeric, null::text),
      (5, 'Agurkas', null::numeric, null::text),
      (6, 'Ridikėliai', null::numeric, null::text),
      (7, 'Raudonasis svogūnas', 0.25::numeric, 'vnt.'::text),
      (8, 'Alyvuogių aliejus', 1::numeric, 'v.š.'::text),
      (9, 'Citrinos sultys', null::numeric, null::text),
      (10, 'Druska', null::numeric, null::text),
      (11, 'Pipirai', null::numeric, null::text),
      (12, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Plovas su lašiša', 'lunch', 'Ryžius išverdame. Nulupame odą nuo lašišos ir susmulkiname. Sutarkuojame morką, susmulkiname svogūną ir česnaką. Į keptuvę metame daržoves, po kelių minučių lašišą ir tuomet suberiame virtus ryžius. Pagardiname smulkintomis petražolėmis, pabarstome druska ir pipirais, paliekame troškintis apie 10 min. Jei „traukia“ keptuvė įpilame šiek tiek vandens.', 530, 44, 19, 13)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lašiša (neapdorota)', 130::numeric, 'g'::text),
      (2, 'Basmati ryžiai', 50::numeric, 'g'::text),
      (3, 'Svogūnas', 0.5::numeric, 'vnt.'::text),
      (4, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (5, 'Morka', 1::numeric, 'vnt.'::text),
      (6, 'Pomidoriukai', null::numeric, null::text),
      (7, 'Petražolės', null::numeric, null::text),
      (8, 'Druska', null::numeric, null::text),
      (9, 'Pipirai', null::numeric, null::text),
      (10, 'Aliejus', 3::numeric, 'ml'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Makaronai su pomidorų padažu ir feta', 'lunch', 'Makaronus išvirti, keptuvėje ant aliejaus pakepinti smulkintus pomidorus su česnakais, suberti prieskonius. Suberti makaronus, viską išmaišyti, įpilti šiek tiek makaronų vandens. Patroškinti ir patiekti su feta bei daržovėmis.', 500, 67, 22, 17)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Pilno grūdo makaronai (sausi)', 70::numeric, 'g'::text),
      (2, 'Fetos sūris (arba burata likutis)', 50::numeric, 'g'::text),
      (3, 'Pomidorai', 2::numeric, 'vnt.'::text),
      (4, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (5, 'Bazilikas', null::numeric, null::text),
      (6, 'Druska', null::numeric, null::text),
      (7, 'Pipirai', null::numeric, null::text),
      (8, 'Alyvuogių aliejus', 5::numeric, 'ml'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lašišos kepsnys', 'lunch', 'Morką supjaustyti plonais šiaudeliais, apšlakstyti aliejumi ir itališkomis žolelėmis. Lašišą pamarinuoti su prieskoniais. Sudėti ant kepimo skardos su kepimo popieriumi. Pašauti į orkaitę 200C 20-25 min.', 446, 38.7, 34.7, 16.4)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lašiša', 170::numeric, 'g'::text),
      (2, 'Citrinpipiriai', null::numeric, null::text),
      (3, 'Žuvies žolelės ir prieskoniai', null::numeric, null::text),
      (4, 'Morka', 1::numeric, 'vnt.'::text),
      (5, 'Itališkos žolelės', null::numeric, null::text),
      (6, 'Aliejus', 1::numeric, 'v.š.'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Spageti su lašiša citrinų padaže', 'lunch', 'Lašišą įtriname prieskoniais. Smulkiai supjaustome pomidorą, cukiniją griežinėliais ir taip pat pabarstome prieskoniais. Viską pašauname į orkaitę ir kepam apie 15-18 min 200C orkaitėje. Tuo tarpu išsiverdame spagečius kaip nurodyta ant pakuotės. Nupilant makaronus pasilikite šiek tiek makaronų virimo vandens. Padažui: atskirame indelyje kreminį sūrį sumaišome su šiek tiek druskos, pipirų, citrinų sultimis ir įpilame makaronų vandens. Visą tai supilame į makaronus puode, išmaišome, sudedame plėšytą lašišą ir daržoves, šiek tiek pakaitiname ant vidutinės kaitros, kad viskas sušiltų (apie 2-3 min).', 550, 51, 31, 25)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Cukinija', 1::numeric, 'vnt.'::text),
      (2, 'Pomidoras (didesnis)', 1::numeric, 'vnt.'::text),
      (3, 'Lašišos filė', 100::numeric, 'g'::text),
      (4, 'Kreminis sūris be laktozės', 40::numeric, 'g'::text),
      (5, 'Citrinos sultys', null::numeric, null::text),
      (6, 'Žuvies prieskoniai', null::numeric, null::text),
      (7, 'Druska', null::numeric, null::text),
      (8, 'Pipirai', null::numeric, null::text),
      (9, 'Citrinpipiriai', null::numeric, null::text),
      (10, 'Spaghetti makaronai', 40::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Graikiškos salotos', 'lunch', 'Visus ingredientus susmulkinti norima forma ir patiekti dubenėlyje. Pagardinti prieskoniais ir užpilti aliejaus bei citrinos sulčių. Šalia riekė duonos (60g).', 520, 26, 22, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Agurkas', 1::numeric, 'vnt.'::text),
      (2, 'Vyšniniai pomidorai', 10::numeric, 'vnt.'::text),
      (3, 'Raudonasis svogūnas', 0.5::numeric, 'vnt.'::text),
      (4, 'Paprika', 0.5::numeric, 'vnt.'::text),
      (5, 'Alyvuogės', 5::numeric, 'vnt.'::text),
      (6, 'Fetos arba graikiškas sūris', 100::numeric, 'g'::text),
      (7, 'Alyvuogių aliejus', 1::numeric, 'v.š.'::text),
      (8, 'Citrinos sultys', null::numeric, null::text),
      (9, 'Mėgstami prieskoniai', null::numeric, null::text),
      (10, 'Duona', 60::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pica', 'lunch', 'Tortiliją ištepame kreminiu sūriu arba varškės užtepėle, dedame smulkintą lašišą, pomidoriukus, mocarelą, prieskonius. Kepame orkaitėje 170 laipsnių 10 min.', 500, 41, 33, 3)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Pilno grūdo tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Rūkyta lašiša', 50::numeric, 'g'::text),
      (3, 'Mocarela', 50::numeric, 'g'::text),
      (4, 'Pomidoriukai', null::numeric, null::text),
      (5, 'Kreminis sūris arba varškės užtepėlė', 40::numeric, 'g'::text),
      (6, 'Prieskoniai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Izraelietiška šakšuka', 'dinner', 'Daržoves susmulkiname, dedame į keptuvę ir kepame ant vidutinės ugnies, galima įpilti kelis šaukštus vandens, kad neprikeptų. Sudedame prieskonius, kai daržovės bus minkštos, padarome duobutes troškinyje ir mušame kiaušinius. Uždedame dangtį ir troškiname dar 4-5 min, kol baltymas pilnai iškeps. Galima įdėti kumino, aitrios paprikos arba itališkų žolelių mix.', 360, 13, 26, 21)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Pomidorai (arba konservuoti)', 2::numeric, 'vnt.'::text),
      (2, 'Raudonoji paprika', 0.5::numeric, 'vnt.'::text),
      (3, 'Svogūnas', 0.25::numeric, 'vnt.'::text),
      (4, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (5, 'Rūkyta/saldžioji paprika, druska, pipirai', null::numeric, null::text),
      (6, 'Kiaušiniai', 3::numeric, 'vnt.'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Salotos su tunu', 'dinner', 'Viską sumaišyti ir patiekti su duonos riekele. Padažui: alyvuogių aliejus, galima įspausti citrinos, druska, pipirai.', 430, 46, 45, 8)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Konservuotas tunas savo sultyse', 160::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Kukurūzai', 50::numeric, 'g'::text),
      (4, 'Lapinės salotos', null::numeric, null::text),
      (5, 'Agurkai', null::numeric, null::text),
      (6, 'Pomidorai', null::numeric, null::text),
      (7, 'Alyvuogės', 4.5::numeric, 'vnt.'::text),
      (8, 'Alyvuogių aliejus', 5::numeric, 'ml'::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Pipirai', null::numeric, null::text),
      (11, 'Duona', 1::numeric, 'riekelė'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Česnakiniai lašišos iešmeliai', 'dinner', 'Medinį iešmelį pamerkite į vandenį, kol gaminsite (kad nesviltų). Į indelį įspausti česnaką, įspausti citrinos sultis, įtarkuoti citrinos žievelę, berti prieskonius. Išmaišyti. Sudėti lašišos kubelius, išmaišyti, kad gabalėliai tolygiai pasidengtų marinatu. Palikti marinuotis apie valandą, bet jei neturite laiko, galima kepti ir iš karto. Kepti iki 200C įkaitintoje orkaitėje apie 3-4 minutes. Tada iešmelius apversti ir kepti dar 4-5 minutes. Kepti galima ir keptuvėje. Patiekti su daržovių salotomis.', 380, 11, 33, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lašišos filė', 150::numeric, 'g'::text),
      (2, 'Citrinos sultys', null::numeric, null::text),
      (3, 'Česnakas', 1::numeric, 'skiltelė'::text),
      (4, 'Druska', null::numeric, null::text),
      (5, 'Pipirai', null::numeric, null::text),
      (6, 'Provanso žolelės', null::numeric, null::text),
      (7, 'Daržovių salotos', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Varškės apkepas su žalumynais', 'dinner', 'Receptas dviem porcijoms. Varškę sutrinti su kiaušiniais, miltais, pienu. Suberti prieskonius, sudėti sūrį, įspausti česnaką. Įmaišyti žalumynus. Sukrėsti į kepimo popieriumi išklotą formą, papuošti pomidoriukais ir kepti 180C įkaitintoje orkaitėje apie 25 min. Patiekti su graikišku jogurtu (60g porcijai).', 450, 25, 62, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa varškė', 360::numeric, 'g'::text),
      (2, 'Kiaušiniai (M)', 2::numeric, 'vnt.'::text),
      (3, 'Kukurūzų miltai', 30::numeric, 'g'::text),
      (4, 'Kietasis sūris', 30::numeric, 'g'::text),
      (5, 'Pienas (be laktozės)', 40::numeric, 'ml'::text),
      (6, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (7, 'Petražolės, svogūnų laiškai, pipirai', null::numeric, null::text),
      (8, 'Pomidoriukai', null::numeric, null::text),
      (9, 'Graikiškas jogurtas', 60::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Jūrų lydeka su daržovėmis', 'dinner', 'Žuvį ištrinkite prieskoniais ir apšlakstykite citrinos sultimis. Kepkite orkaitėje apie 15 min, 180 laipsnių temperatūroje. Supjaustykite daržoves, apšlakstykite alyvuogių aliejumi ir prieskoniais. Kepkite įkaitintoje orkaitėje 5-10 min, 180 laipsnių temperatūroje.', 440, 20, 42, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Žuvis (jūrų lydeka)', 300::numeric, 'g'::text),
      (2, 'Citrinpipiriai / citrinos sultys / prieskoniai', null::numeric, null::text),
      (3, 'Daržovės', null::numeric, null::text),
      (4, 'Alyvuogių aliejus', 5::numeric, 'ml'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avokado duonelė', 'breakfast', 'Avokadą sutrinti su prieskoniais ir užtepti ant duonos, ant viršaus uždėti kiaušinį (virtą be lukšto/skystai arba kietą ir supjaustytą). Šalia mėgstamos daržovės.', 430, 46, 17, 20)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Juoda duona', 60::numeric, 'g'::text),
      (2, 'Avokadas', 50::numeric, 'g'::text),
      (3, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (4, 'Prieskoniai (citrinpipiriai)', null::numeric, null::text),
      (5, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižinė košė su grūdėta varške', 'breakfast', '', 454, 61, 20, 14)
  returning id
)
select 1;

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Sumuštinis su lašišos užtepėle', 'breakfast', 'Duoneles pašildome, visus ingredientus susmulkiname ir sumaišome kartu. Papuošimui sezamų sėklos.', 500, 39, 21, 29)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avokadas', 60::numeric, 'g'::text),
      (2, 'Sūdyta/rūkyta lašiša', 30::numeric, 'g'::text),
      (3, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (4, 'Druska', null::numeric, null::text),
      (5, 'Pipirai', null::numeric, null::text),
      (6, 'Laiškiniai česnakai', null::numeric, null::text),
      (7, 'Sezamų sėklos', null::numeric, null::text),
      (8, 'Šviesi forminė duona', 2::numeric, 'riekelė'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Sumuštiniai su humusu', 'breakfast', 'Duonelę pertepti humusu (prieš tai galima pašildyti orkaitėje, paskrudinti, bet nebūtina), ant viršaus uždėti smulkintus pomidoriukus. Šalia agurkai arba morkos.', 400, 40, 11, 18)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Duona', 60::numeric, 'g'::text),
      (2, 'Humusas', 80::numeric, 'g'::text),
      (3, 'Vyšniniai pomidoriukai', null::numeric, null::text),
      (4, 'Sezamo sėklos', null::numeric, null::text),
      (5, 'Žalumynai', null::numeric, null::text),
      (6, 'Agurkų lazdelės', 100::numeric, 'g'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tortilija su varške', 'breakfast', 'Varškę galima sumaišyti su kokoso drožlėmis, cinamonu, aguonomis. Varškę sumaišome su kiaušinio baltymu, įmaišome uogas. Tortiliją ištepti varškės mase, susukti, tryniu aptepti viršų ir kepti orkaitėje apie 15 min, kol gražiai pagels.', 370, 33, 29, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Tortilija', 1::numeric, 'vnt.'::text),
      (2, 'Varškė 9%', 90::numeric, 'g'::text),
      (3, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (4, 'Mėgstamos uogos', null::numeric, null::text),
      (5, 'Kokoso drožlės / cinamonas / aguonos', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Perlinių kruopų košė', 'breakfast', 'Perlines kruopas išvirti (į vandenį berti druskos arba sultinio), galima jas pasiruošti iš vakaro. Ant paruoštų kruopų užberti druskos, pipirų, uždėti kiaušinius. Šalia šviežios daržovės.', 390, 45, 21, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Perlinės kruopos (sausos)', 60::numeric, 'g'::text),
      (2, 'Kiaušiniai', 2::numeric, 'vnt.'::text),
      (3, 'Druska', null::numeric, null::text),
      (4, 'Pipirai', null::numeric, null::text),
      (5, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Avižiniai keksiukai', 'breakfast', 'Viską sutriname (išskyrus uogas) ir kepame keksiukų formelėse 25 min, 170C.', 470, 80, 18, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Avižų miltai (sublendintos avižos)', 60::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Bananas', 1::numeric, 'vnt.'::text),
      (4, 'Citrina (sultys ir nutarkuota žievelė)', 0.5::numeric, 'vnt.'::text),
      (5, 'Mėgstamos uogos', null::numeric, null::text),
      (6, 'Kepimo milteliai', 1::numeric, 'a.š.'::text),
      (7, 'Saldiklis', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Makaronai su krevetėmis', 'lunch', 'Ant ghee sviestuko pakepame krevetes su prieskoniais, po poros min. supilame grietinėlę ir šiek tiek patroškiname. Sumaišome su išvirtais makaronais. Šalia daržovės.', 480, 50, 33, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Krevetės', 150::numeric, 'g'::text),
      (2, 'Viso grūdo spagečiai', 60::numeric, 'g'::text),
      (3, 'Česnakas', 2::numeric, 'skiltelė'::text),
      (4, 'Sojų grietinėlė arba liesa grietinėlė 12%', 50::numeric, 'ml'::text),
      (5, 'Druska, pipirai, raudonos paprikos prieskoniai', null::numeric, null::text),
      (6, 'Ghee sviestas', 5::numeric, 'g'::text),
      (7, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lydekos kepsneliai', 'lunch', 'Lydekos filė supjaustome kepsnio dydžio gabalais, gardiname prieskoniais, apvoliojame į miltus ir kepame keptuvėje su pasirinktu kepimo aliejumi. Patiekiame su šviežiomis daržovėmis ir garnyru.', 500, 50, 47, 11)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Jūrinės lydekos filė', 200::numeric, 'g'::text),
      (2, 'Kukurūzų miltai', 1::numeric, 'v.š.'::text),
      (3, 'Morka', 1::numeric, 'vnt.'::text),
      (4, 'Prieskoniai', null::numeric, null::text),
      (5, 'Ghee sviestas arba aliejus', 5::numeric, 'g'::text),
      (6, 'Grikiai arba ryžiai (sausi)', 70::numeric, 'g'::text),
      (7, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Krevetės su ryžiais', 'lunch', 'Krevetes apkepinti keptuvėje ant ghee su prieskoniais, šiek tiek citrinų sulčių. Patiekti su virtais ryžiais ir daržovėmis.', 450, 48, 41, 7)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Krevetės', 200::numeric, 'g'::text),
      (2, 'Citrinos sultys', null::numeric, null::text),
      (3, 'Druska, pipirai, mėgstami prieskoniai', null::numeric, null::text),
      (4, 'Ghee sviestas', 5::numeric, 'g'::text),
      (5, 'Ryžiai (sausi)', 60::numeric, 'g'::text),
      (6, 'Daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Tofu karis', 'lunch', 'Keptuvėje įkaitinkite aliejų ir apkepkite tofu kubelius (~3-4 min.), kol lengvai apskrus. Sudėkite prieskonius, kepkite dar minutę. Sudėkite pomidorus ir avinžirnius, įpilkite kokosų pieną ir troškinkite apie 5 min. Pabaigoje sudėkite špinatus ir dar 2 min. patroškinkite. Patiekite su virtais ryžiais ir šviežiomis daržovėmis.', 500, 44, 27, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Kietas tofu', 100::numeric, 'g'::text),
      (2, 'Virti avinžirniai', 40::numeric, 'g'::text),
      (3, 'Kokosų pienas light', 50::numeric, 'ml'::text),
      (4, 'Pomidoras', 1::numeric, 'vnt.'::text),
      (5, 'Špinatai', null::numeric, null::text),
      (6, 'Aliejus', 5::numeric, 'ml'::text),
      (7, 'Ciberžolė, karis, kmynai, imbieras', null::numeric, null::text),
      (8, 'Ryžiai (rudieji/laukiniai/basmati, sausi)', 40::numeric, 'g'::text),
      (9, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Makaronai su tunu', 'lunch', 'Makaronus išvirti, kol jie verda, keptuvėje išlydyti sviestą ir pakepinti smulkintą svogūną, tarkuotą morką. Po kelių minučių sudėti pusę skardinės tuno (skystį nupilti) ir įdėti kelis šaukštus vandens iš makaronų puodo. Pamaišyti, kol tunas sušils, sudėti jogurtą ir prieskonius. Suberti išvirusius makaronus, sumaišyti viską ir patiekti. Šalia daržovės. Porcija dviem dienoms.', 470, 34, 30, 11)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Makaronai (sausi)', 120::numeric, 'g'::text),
      (2, 'Konservuotas tunas savo sultyse', 1::numeric, 'skardinė'::text),
      (3, 'Morka', null::numeric, null::text),
      (4, 'Svogūnas', null::numeric, null::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text),
      (7, 'Švieži žalumynai', null::numeric, null::text),
      (8, 'Jogurtas be laktozės / graikiškas', 50::numeric, 'g'::text),
      (9, 'Ghee sviestas', 10::numeric, 'g'::text),
      (10, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Lašišos kepsnys su keptomis daržovėmis', 'lunch', 'Morką supjaustyti plonais šiaudeliais, bulvę į 4/6 dalis. Apšlakstyti aliejumi ir itališkomis žolelėmis. Lašišą pamarinuoti su prieskoniais. Daržoves sudėti ant kepimo skardos su kepimo popieriumi. Pašauti į orkaitę 200C 20-25 min. Apkepus daržovėms, sudėti lašišą, kaitrą pamažinti iki 170C ir pakepti dar 10 min. Šalia šviežios daržovės.', 530, 47, 28, 28)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Lašiša', 150::numeric, 'g'::text),
      (2, 'Citrinpipiriai', null::numeric, null::text),
      (3, 'Žuvies žolelės ir prieskoniai', null::numeric, null::text),
      (4, 'Morka', 1::numeric, 'vnt.'::text),
      (5, 'Bulvės', 1::numeric, 'vnt.'::text),
      (6, 'Itališkos žolelės', null::numeric, null::text),
      (7, 'Aliejus', 1::numeric, 'v.š.'::text),
      (8, 'Šviežios daržovės', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pik Nik varškėtukai', 'dinner', 'Varškėtukams skirtus ingredientus sumaišome kartu, Pik Nik sūrio dešrelę daliname į 4 dalis. Iš tešlos suformuojame apskritimą, įspaudžiame sūrio dešrelę ir suformuojame varškėtuką. Kepame ant vidutinės kaitros keptuvėje su įkaitintu aliejumi iš abiejų pusių, su dangčiu. Kol kepa varškėtukai, ruošiam padažą: susmulkiname daržoves (pievagrybius), siunčiame pasikepinti į įkaitintą keptuvę, po minutės sudedame kreminį sūrį, įpilame vandens ir persilado.', 450, 35, 33, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa varškė', 180::numeric, 'g'::text),
      (2, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (3, 'Miltai', 30::numeric, 'g'::text),
      (4, 'Druska', null::numeric, null::text),
      (5, 'Pipirai', null::numeric, null::text),
      (6, 'Pik Nik sūrio dešrelė', 1::numeric, 'vnt.'::text),
      (7, 'Aliejus', 5::numeric, 'ml'::text),
      (8, 'Pievagrybiai', 5.5::numeric, 'vnt.'::text),
      (9, 'Petražolių prieskoniai', null::numeric, null::text),
      (10, 'Kreminis sūris', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Salotos su halloumi sūriu', 'dinner', 'Daržoves supjaustyti, sūrį iškepti be riebalų keptuvėje iš abiejų pusių. Patiekti iškart. Užpilti padažą (alyvuogių aliejus, citrina, druska, pipirai).', 470, 13, 22, 17)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Salotų lapai', null::numeric, null::text),
      (2, 'Pomidoriukai', null::numeric, null::text),
      (3, 'Agurkai', null::numeric, null::text),
      (4, 'Paprikos', null::numeric, null::text),
      (5, 'Kitos mėgstamos daržovės', null::numeric, null::text),
      (6, 'Halloumi sūris', 100::numeric, 'g'::text),
      (7, 'Alyvuogių aliejus', 5::numeric, 'ml'::text),
      (8, 'Citrina', null::numeric, null::text),
      (9, 'Druska', null::numeric, null::text),
      (10, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Trinta brokolių sriuba', 'dinner', 'Brokolį supjaustykite žiedynėliais, bulves ir morkas – nedideliais gabalėliais. Sudėkite daržoves į puodą, užpilkite vandeniu, įberkite žiupsnį druskos ir virkite, kol daržovės suminkštės. Nuo išvirusių daržovių nupilkite vandenį. Supilkite sultinį, grietinėlę, pagardinkite prieskoniais. Puodą statykite atgal ant ugnies ir pakaitinkite, kol užvirs. Ugnį užgesinkite ir sriubą sutrinkite su maisto smulkintuvu iki visiškai vientisos masės.', 310, 9, 10, 10)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Brokolis', 1::numeric, 'galva'::text),
      (2, 'Morka (didelė)', 1::numeric, 'vnt.'::text),
      (3, 'Grietinėlė (sojų Alpro arba 12% rieb.)', 200::numeric, 'ml'::text),
      (4, 'Sultinys', 1000::numeric, 'ml'::text),
      (5, 'Bulvės (didelės)', 2::numeric, 'vnt.'::text),
      (6, 'Druska', null::numeric, null::text),
      (7, 'Pipirai', null::numeric, null::text),
      (8, 'Malta paprika arba muskatas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Burata salotos su citrininiu garstyčių padažu', 'dinner', 'Salotas susmulkinti, padažą sumaišyti. Suplėšyti buratą sūrį ant smulkintų daržovių ir užpilti padažiuką.', 370, 7, 26, 22)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Šviežios daržovės', null::numeric, null::text),
      (2, 'Salotų lapai', null::numeric, null::text),
      (3, 'Burrata sūris', 125::numeric, 'g'::text),
      (4, 'Medus', 1::numeric, 'a.š.'::text),
      (5, 'Garstyčios', 1::numeric, 'a.š.'::text),
      (6, 'Citrinos sultys', 3::numeric, 'v.š.'::text),
      (7, 'Alyvuogių aliejus', 1::numeric, 'v.š.'::text),
      (8, 'Druska', null::numeric, null::text),
      (9, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Keptas varškės sūris', 'dinner', 'Visus ingredientus gerai sutrinti maisto smulkintuvu ar rankiniu būdu ir įtrinti į sūrį (galima įpjauti, kad prieskoniai geriau įsigertų) ir palikti valandai. Sūrį su visu marinatu dėti ant folijos, gerai suvynioti ir kepti 180C apie 20 min, vėliau foliją praskleisti, kad apskrustų sūris. Galite užsidėti ant salotų ar valgyti vieną/su daržovėmis.', 450, 21, 34, 12)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Varškės sūris (13%)', 150::numeric, 'g'::text),
      (2, 'Česnakas', 3::numeric, 'skiltelė'::text),
      (3, 'Alyvuogių aliejus', 2::numeric, 'v.š.'::text),
      (4, 'Provanso žolelės', null::numeric, null::text),
      (5, 'Druska', null::numeric, null::text),
      (6, 'Pipirai', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Orkaitėje kepti varškėčiai', 'dinner', 'Viską sumaišyti ir kepti orkaitėje ant kepimo popieriaus 170C apie 10-12 min. Patiekti su natūraliu jogurtu 70g, uogomis. Galite pabarstyti cinamonu.', 350, 15, 36, 7)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Liesa varškė', 180::numeric, 'g'::text),
      (2, 'Miltai', 30::numeric, 'g'::text),
      (3, 'Saldiklis (eritritolis, skonio lašiukai ar medus)', null::numeric, null::text),
      (4, 'Kiaušiniai', 1::numeric, 'vnt.'::text),
      (5, 'Kepimo milteliai', null::numeric, null::text),
      (6, 'Natūralus jogurtas', 70::numeric, 'g'::text),
      (7, 'Uogos', null::numeric, null::text),
      (8, 'Cinamonas', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Pusriebė varškė su uogomis/vaisiais', 'snack', '150g pusriebės varškės su cinamonu, sauja uogų arba vienu vaisiumi, saldiklis saldumui.', 270, 12, 25, 14)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Pusriebė varškė', 150::numeric, 'g'::text),
      (2, 'Cinamonas', null::numeric, null::text),
      (3, 'Švieži vaisiai', null::numeric, null::text),
      (4, 'Saldiklis', null::numeric, null::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Baltyminiai sūreliai', 'snack', 'Porcija: 2 vnt. (22,5g baltymų).', 250, null, 22.5, null)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Baltyminiai sūreliai', 2::numeric, 'vnt.'::text)
) as v (position, item, amount, unit);

with r as (
  insert into public.recipes (name, meal_type, instructions, calories_kcal, carbohydrates, protein, fat)
  values ('Kinder country desertas', 'snack', 'Trapučius smulkiai sutrupiname, jogurtą sumaišome su norimu saldikliu/baltymais (arba skonio lašiukais/medumi/klevų sirupu), tuomet permaišome su trupintais ryžių trapučiais. Išlydome kinder šokoladuką ir juo papuošiame deserto viršų. Laikome šaldytuve ~20 min, galite laikyti ir ilgiau, jei neplanuojate valgyti iškart.', 250, 20, 21, 9)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, item, amount, unit)
select r.id, v.position, v.item, v.amount, v.unit
from r, (values
      (1, 'Graikiškas jogurtas', 150::numeric, 'g'::text),
      (2, 'Ryžių trapučiai', 1.5::numeric, 'vnt.'::text),
      (3, 'Baltymų milteliai', 15::numeric, 'g'::text),
      (4, 'Kinder šokoladukas', 1::numeric, 'vnt.'::text)
) as v (position, item, amount, unit);

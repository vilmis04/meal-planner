-- English content (X1b): English translations of every seeded recipe (name and instructions), recipe line, canonical
-- ingredient and tip, as 'en' rows of the tables made by 20261125000000_create_content_translations.sql.
--
-- Rows are matched by their Lithuanian source text: recipes by name and meal type, recipe lines by their item (every
-- line with that item, in every recipe, gets the same English text), ingredients by canonical name and tips by their
-- text. A source text that no longer matches aborts the migration instead of leaving content untranslated, and the
-- missing translations report (`npm run translations:report`) must show none afterwards.
--
-- Translation choices, reviewed one by one:
--   * British English, as the app's English formats dates (en-GB): courgette, rocket, prawns, spring onions, minced
--     beef, favourite.
--   * varškė is quark, grūdėta varškė cottage cheese, varškės sūris curd cheese; juoda duona is dark rye bread.
--   * Brands and Lithuanian products keep their names: Džiugas cheese, PikNik / Pik Nik, Kinder, Alpro, Dvaras.
--   * Canonical ingredient names are unique in English too (ingredient_translations_locale_name_key).
--   * A recipe line's unit is translated by the app's shared unit labels (vnt. reads pcs, v.š. tbsp, a.š. tsp,
--     skiltelė clove); the one line where that would read wrong carries its own English unit (a lime wedge).
--   * Instructions say what the Lithuanian says, in the imperative, with temperatures as 180°C; nothing is added.
--
-- Additive and re-runnable: every row is upserted, so running it again puts the reviewed text back. The Lithuanian
-- source and its 'lt' rows are untouched.

create temporary table if not exists english_recipes (meal_type public.meal_type, lt_name text, name text, instructions text);
truncate english_recipes;

insert into english_recipes (meal_type, lt_name, name, instructions)
values
  -- breakfast: 33
  ('breakfast', 'Avižiniai keksiukai', 'Oat muffins',
   'Blend everything together (except the berries) and bake in muffin moulds for 25 min at 170°C.'),
  ('breakfast', 'Avižinė košė su bananu ir riešutų sviestu', 'Porridge with banana and nut butter',
   'Cook the oats in water with a pinch of salt, stirring all the time. Put the porridge in a bowl, sprinkle with cinnamon and top with nut butter and sliced banana.'),
  ('breakfast', 'Avižinė košė su grūdėta varške', 'Porridge with cottage cheese',
   ''),
  ('breakfast', 'Avižinė košė su kietuoju sūriu ir kiaušiniu', 'Porridge with hard cheese and egg',
   'Cook the oats in water; near the end, add the cheese and stir until it melts. Boil or fry the egg. Put the porridge in a bowl, season it and top with the egg. You can also add a little sliced leek or onion.'),
  ('breakfast', 'Avižinė košė su kivi ir jogurtu', 'Porridge with kiwi and yogurt',
   'Cook the oats in water; at the end, crack in the egg and stir well. Put the porridge in a bowl, then top with yogurt, kiwi and nut butter.'),
  ('breakfast', 'Avižinė košė su vaisiais ir jogurtu', 'Porridge with fruit and yogurt',
   'Cook the oats in water and stir in a teaspoon of honey at the end. Put in a bowl and top with Greek yogurt and the fruit of your choice.'),
  ('breakfast', 'Avokado duonelė', 'Avocado toast',
   'Mash the avocado with the spices and spread it on the bread. Top with an egg (poached, soft-boiled, or hard-boiled and sliced). Serve with your favourite vegetables on the side.'),
  ('breakfast', 'Avokado sumuštiniai su keptais kiaušiniais', 'Avocado sandwiches with fried eggs',
   'Mash the avocado with the spices and spread it on toasted bread. Fry two eggs in a hot pan (you can scramble them if you like). Put the eggs on the bread. Serve with fresh vegetables on the side; you can add pickled onions.'),
  ('breakfast', 'Benedikto kiaušiniai', 'Eggs Benedict',
   'Bring water to the boil; once it bubbles, turn the heat down to medium. Add a little vinegar and salt. Stir the water into a whirlpool, then slide in the two eggs quickly, one after the other. Do not touch them. Cook for 4 min, using a timer. Serve on dark rye bread or 50 g of buckwheat (weighed uncooked). Toppings: 50 g of avocado and 40 g of smoked or salted salmon. Finish with lemon pepper, salt and pepper.'),
  ('breakfast', 'Chia pudingas', 'Chia pudding',
   'Make it the evening before (you can make more: it keeps in the fridge for up to 5 days). Mix everything together in a jar or glass and leave overnight. In the morning, top with blended or chopped fruit and berries. You can add about 5 g of seeds. (Instead of 250 ml of plant-based milk, you can use 200 g of plain yogurt.)'),
  ('breakfast', 'Grikiai su avokadu ir rūkyta/sūdyta lašiša', 'Buckwheat with avocado and smoked or salted salmon',
   'Cook the buckwheat or pour hot water over it. Season with salt. Add sliced avocado, the salmon and a boiled egg. Season with lemon pepper and herbs.'),
  ('breakfast', 'Grikiai su kiaušiniais', 'Buckwheat with eggs',
   'Cook the buckwheat or pour hot water over it. Season with salt. Boil the eggs. Top with the eggs and crumble over the feta. Serve with vegetables and a slice of white bread on the side.'),
  ('breakfast', 'Grikiai su kiaušiniais ir pesto padažu', 'Buckwheat with eggs and pesto',
   'Cook the buckwheat, or pour hot water over it the evening before (add salt). Boil the eggs. Mix the buckwheat with the pesto, top with the boiled eggs and serve with tomato and other vegetables on the side.'),
  ('breakfast', 'Grikių/bulgur košė su sūriu', 'Buckwheat or bulgur porridge with cheese',
   'Salt the buckwheat and mix it with grated cheese. You can pour hot water over it the evening before; in the morning, just warm it up and add the toppings.'),
  ('breakfast', 'Grūdėtos varškės paplotėliai su gvakamole', 'Cottage cheese flatbreads with guacamole',
   'Whisk the cottage cheese with the eggs and spices. The mixture will be runny. Pour it onto a baking tray lined with baking paper and shape flatbreads of the size you like. Bake at 170°C for 30 min. For the guacamole, chop all the ingredients finely (mash the avocado) and mix together. Spread the guacamole on the flatbreads and enjoy.'),
  ('breakfast', 'Juodos duonos sumuštinis su plaktais kiaušiniais', 'Rye bread sandwich with scrambled eggs',
   'Whisk the eggs with the spices, melt the fat in a frying pan and pour in the eggs. Stir in circles with a spatula straight away; when the eggs start to set, lower the heat and let them cook a little. Put the eggs on the bread and eat with vegetables on the side. It takes up to 5 min to make.'),
  ('breakfast', 'Karšti picos sumuštiniai', 'Hot pizza sandwiches',
   'Grate or chop the ham, grate the cheese and chop the vegetables. Mix everything with the tomato sauce and pizza seasoning. Spread on the bread and put in the oven or air fryer at 180°C for up to 10 min.'),
  ('breakfast', 'Karšti sumuštiniai kepyklėje', 'Toasted sandwiches',
   'Spread the bread with cream cheese, lay all the ingredients evenly on top and finish with tomato sauce and Italian herbs. Toast in a sandwich maker.'),
  ('breakfast', 'Kefyro blynai', 'Kefir pancakes',
   'Whisk the kefir, egg, sweetener, vanilla and melted butter. Add the flour with the baking powder, mix and leave for 10 min. Fry on both sides in a frying pan. Serve with yogurt and kiwi, pomegranate seeds or berries.'),
  ('breakfast', 'Kiaušinienė su grūdėta varške', 'Scrambled eggs with cottage cheese',
   'Mix everything except the oil together. Heat the oil in a frying pan and cook, stirring, until fully set. Serve with bread and vegetables.'),
  ('breakfast', 'Kruasanas su lašiša', 'Croissant with salmon',
   'Cut the croissant open, spread it with the spread of your choice and fill it (a lettuce leaf, cream cheese, salmon or ham, a slice of tomato). Serve with fresh vegetables on the side.'),
  ('breakfast', 'Minkšti vafliukai', 'Soft waffles',
   'Blend all the ingredients with a hand blender and cook in a hot waffle iron. Serve with Greek yogurt (60 g), berries and/or kiwi.'),
  ('breakfast', 'Obuolinė granola', 'Apple granola',
   'Put the oats in a bowl, grate in the apple (you can use a mashed banana instead), and add cinnamon and sweetener. Melt the fat of your choice in a frying pan, add the mixture and toast it, turning, until golden on all sides. (If you have time, you can bake it in the oven or air fryer at 185°C for 10 min.) Put the yogurt in a bowl, sprinkle over the toasted oats and add sliced kiwi.'),
  ('breakfast', 'Perlinių kruopų košė', 'Pearl barley porridge',
   'Cook the pearl barley (add salt or stock to the water); you can prepare it the evening before. Season the barley with salt and pepper and top with the eggs. Serve with fresh vegetables on the side.'),
  ('breakfast', 'Plakti kiaušiniai su feta', 'Scrambled eggs with feta',
   'Whisk the eggs with the spices; you can also add fresh herbs. Cook over medium heat, stirring all the time. Finely chop the cherry tomatoes, onion and avocado, season and mix. Put the lettuce and scrambled eggs on a plate. Top with the egg and crumble over the feta. Serve with vegetables and a slice of white bread on the side.'),
  ('breakfast', 'Sumuštiniai su humusu', 'Hummus sandwiches',
   'Spread the bread with hummus (you can warm or toast the bread in the oven first, but you don''t have to) and top with chopped cherry tomatoes. Serve with cucumber or carrots on the side.'),
  ('breakfast', 'Sumuštiniai su kiaušinių užtepėle', 'Egg spread sandwiches',
   'Toast the bread in a dry frying pan; meanwhile, chop and mix all the listed ingredients. Spread on the toast and eat straight away.'),
  ('breakfast', 'Sumuštinis su avokadu ir grūdėta varške', 'Avocado and cottage cheese sandwich',
   'Toast two slices of white bread. Mash the avocado with a fork, add a little salt and pepper and spread it on the bread. Top with cottage cheese and sliced tomato.'),
  ('breakfast', 'Sumuštinis su lašišos užtepėle', 'Salmon spread sandwich',
   'Warm the bread, chop all the ingredients and mix them together. Garnish with sesame seeds.'),
  ('breakfast', 'Tortilija su kumpiu ir sūriu', 'Ham and cheese tortilla',
   'Spread the tortilla with tomato sauce and add the ham, cheese and spices. Fold it in half and cook in a covered frying pan over low heat until the cheese melts. Serve with vegetables on the side.'),
  ('breakfast', 'Tortilija su varške', 'Quark tortilla',
   'You can mix the quark with desiccated coconut, cinnamon and poppy seeds. Mix the quark with the egg white and stir in the berries. Spread the tortilla with the quark mixture, roll it up, brush the top with the yolk and bake in the oven for about 15 min, until golden.'),
  ('breakfast', 'Tortilijos suktinukas su kiaušiniais', 'Egg tortilla wrap',
   'Grate the boiled egg, cheese and chopped garlic and mix with the mayonnaise and pepper. Spread over the tortilla, roll it up and slice. Serve with vegetables.'),
  ('breakfast', 'Šokoladinė avižų košė', 'Chocolate porridge',
   'Pour milk or water over the oats, add salt and cook over medium heat, stirring all the time. At the end, stir in the dark chocolate. Serve with fruit or berries, nut butter and cinnamon.'),
  -- lunch: 30
  ('lunch', 'Augalinės sočios salotos', 'Hearty plant-based salad',
   'Mix everything together.'),
  ('lunch', 'BLT sumuštinis', 'BLT sandwich',
   'Spread the slices of bread with the sauce (mix the mayonnaise, yogurt and spices), put the fillings on one slice, top with the other and cut the sandwich in half. Slice some vegetables to go with it: cucumber wedges, tomato, bell pepper.'),
  ('lunch', 'Cukinijų ir varškės blyneliai', 'Courgette and quark fritters',
   'Grate the courgette, sprinkle it with salt and leave it for a minute, then squeeze out the liquid. Mix with the quark, eggs, spices, chopped garlic and flour. Fry in a frying pan in oil or ghee. Serve with Greek yogurt and salmon. Makes portions for 2 days.'),
  ('lunch', 'Graikiškas dubuo', 'Greek bowl',
   'Mix the minced chicken with the spices. Fry it in a hot frying pan; meanwhile, chop the vegetables and make the sauce from the yogurt and dried parsley. Put everything in a bowl and sprinkle with feta cheese.'),
  ('lunch', 'Graikiškos salotos', 'Greek salad',
   'Cut all the ingredients as you like and serve in a bowl. Season and dress with oil and lemon juice. Serve with a slice of bread (60 g) on the side.'),
  ('lunch', 'Jautienos čili troškinys', 'Beef chilli stew',
   'Brown the meat in a DRY frying pan. Put the canned vegetables in a pot and add the meat once browned. Chop the garlic and onion, fry them and add them to the pot. Season. Pour in a glass of water and simmer for 10-15 min. At the end, add the dark chocolate and stir. Serve with lime and yogurt. Makes portions for two days; one portion is about 400-450 g of stew.'),
  ('lunch', 'Kapoti menkės kepsniukai su bulvių koše', 'Chopped cod cakes with mashed potatoes',
   'Chop the cod into small cubes and mix with the chopped onion, grated carrot, flour, spices and egg. Fry on both sides in a frying pan. Boil the potatoes and mash them, adding hot milk. Serve with the mashed potatoes and fresh vegetables. Makes portions for 2 days.'),
  ('lunch', 'Kreminiai pesto makaronai su vištiena ir daržovėmis', 'Creamy pesto pasta with chicken and vegetables',
   'Cook the pasta in salted water (keep half a ladle of the water). Cut up the chicken and fry it in oil until golden. Add the garlic, spinach, pesto and pasta, pour in some of the pasta water and stir in the cream cheese. Makes portions for 2 days.'),
  ('lunch', 'Krevetės su ryžiais', 'Prawns with rice',
   'Fry the prawns in ghee with the spices and a little lemon juice. Serve with boiled rice and vegetables.'),
  ('lunch', 'Lašišos kepsnys', 'Roast salmon',
   'Cut the carrot into thin sticks and drizzle with oil and Italian herbs. Marinate the salmon in the spices. Put everything on a baking tray lined with baking paper. Roast in the oven at 200°C for 20-25 min.'),
  ('lunch', 'Lašišos kepsnys su keptomis daržovėmis', 'Roast salmon with roasted vegetables',
   'Cut the carrot into thin sticks and the potato into 4 or 6 pieces. Drizzle with oil and Italian herbs. Marinate the salmon in the spices. Put the vegetables on a baking tray lined with baking paper. Roast in the oven at 200°C for 20-25 min. Once the vegetables have browned, add the salmon, turn the oven down to 170°C and roast for another 10 min. Serve with fresh vegetables on the side.'),
  ('lunch', 'Lydekos kepsneliai', 'Pan-fried hake',
   'Cut the hake fillet into steak-sized pieces, season, coat in flour and fry in a frying pan in the cooking oil of your choice. Serve with fresh vegetables and a side.'),
  ('lunch', 'Makaronai su krevetėmis', 'Pasta with prawns',
   'Fry the prawns with the spices in a little ghee; after a couple of minutes, pour in the cream and simmer briefly. Mix with the cooked pasta. Serve with vegetables on the side.'),
  ('lunch', 'Makaronai su pomidorų padažu ir feta', 'Pasta with tomato sauce and feta',
   'Cook the pasta. In a frying pan, fry the chopped tomatoes with the garlic in oil and add the spices. Add the pasta, stir everything and pour in a little of the pasta water. Simmer and serve with feta and vegetables.'),
  ('lunch', 'Makaronai su tunu', 'Tuna pasta',
   'Cook the pasta; while it boils, melt the butter in a frying pan and fry the chopped onion and grated carrot. After a few minutes, add half a can of tuna (drained) and a few spoonfuls of water from the pasta pot. Stir until the tuna is warm, then add the yogurt and spices. Add the cooked pasta, mix everything and serve. Serve with vegetables on the side. Makes portions for two days.'),
  ('lunch', 'Meduje kepta vištiena', 'Honey chicken',
   'Cut the chicken into pieces, season and fry in a hot frying pan. Once browned, set it aside on a plate, pour the sauce ingredients into the pan, stir and put the chicken back. Lower the heat and simmer the chicken for a few more minutes. Serve with rice. Makes portions for two days. (Instead of the fillet, you can use 250 g of thigh meat.)'),
  ('lunch', 'Paukštienos kotletukai su keptais svogūnais ir pievagrybiais', 'Chicken patties with fried onions and mushrooms',
   'Blend the chicken, spices, onion and egg (if you use minced meat, you can skip blending). Fry the chopped mushrooms in a frying pan with a drop of oil or butter. Add the mushrooms to the meat mixture, shape patties with wet hands and put them straight into a hot frying pan. Serve with the side of your choice and fresh vegetables. Makes portions for two days.'),
  ('lunch', 'Pica', 'Pizza',
   'Spread the tortilla with cream cheese or curd spread and top with chopped salmon, cherry tomatoes, mozzarella and spices. Bake in the oven at 170°C for 10 min.'),
  ('lunch', 'Plovas su lašiša', 'Salmon pilaf',
   'Cook the rice. Remove the skin from the salmon and chop it. Grate the carrot and chop the onion and garlic. Put the vegetables in a frying pan, add the salmon after a few minutes, then add the cooked rice. Season with chopped parsley, sprinkle with salt and pepper and leave to simmer for about 10 min. If it starts to stick to the pan, add a little water.'),
  ('lunch', 'Pomidorinis troškinys', 'Tomato stew',
   'Brown the minced beef, add the chopped vegetables (bell pepper, onion, garlic, carrot) and the spices. Fry for a couple of minutes. Pour in water or stock and the canned tomatoes, add the rice and cook for ~15-20 min. Makes portions for 2 days.'),
  ('lunch', 'Salotos su keptais batatais', 'Salad with roasted sweet potatoes',
   'Cut the sweet potatoes into 1 cm thick slices. Mix with oil and salt. Lay them on a baking tray, not touching, so they turn crisp instead of steaming. Roast in the oven at 210°C for 20 min, turn them over and roast for another 10-15 min. Meanwhile, cut up the vegetables, mix them with the yogurt and parsley, add the roasted sweet potatoes and toss. Crumble the cheese on top.'),
  ('lunch', 'Salotos su vištiena ir kiaušiniu', 'Chicken and egg salad',
   'Season the chicken and cook it in the oven or air fryer. Chop the vegetables. Mix the dressing. Cut the cooked chicken into pieces, mix everything together and sprinkle with the cheese. Serve with a slice of bread on the side.'),
  ('lunch', 'Spageti su lašiša citrinų padaže', 'Spaghetti with salmon in lemon sauce',
   'Rub the salmon with the spices. Finely chop the tomato, slice the courgette and season them too. Put everything in the oven and roast for about 15-18 min at 200°C. Meanwhile, cook the spaghetti as the packet says. When draining the pasta, keep a little of the cooking water. For the sauce: in a separate bowl, mix the cream cheese with a little salt, pepper and lemon juice and add some of the pasta water. Pour it all over the pasta in the pot, stir, add the flaked salmon and vegetables and warm over medium heat until everything is hot (about 2-3 min).'),
  ('lunch', 'Tofu karis', 'Tofu curry',
   'Heat the oil in a frying pan and fry the tofu cubes (~3-4 min) until lightly golden. Add the spices and fry for another minute. Add the tomatoes and chickpeas, pour in the coconut milk and simmer for about 5 min. At the end, add the spinach and simmer for 2 more minutes. Serve with boiled rice and fresh vegetables.'),
  ('lunch', 'Tortilijos čeburėkas', 'Tortilla chebureki',
   'Brown the minced beef with the spices in a dry frying pan (you can add onion, garlic and carrot). Wet the edges of the tortilla with water, put the beef and cheese on one half, fold it over and press the edges together with a fork. Bake in the oven or air fryer at 185°C for ~7-10 min.'),
  ('lunch', 'Tuno ir avinžirnių salotos su feta sūriu', 'Tuna and chickpea salad with feta',
   'Chop the vegetables (tomato, cucumber, red onion). Mix everything with the tuna, chickpeas, olive oil, lemon juice and spices, and crumble in the feta cheese. Serve with a slice of toast on the side.'),
  ('lunch', 'Užkepti kiaulienos kepsniai', 'Baked pork steaks',
   'Pound the pork steaks thin with a meat mallet and sprinkle with salt, pepper and spices. Line a baking dish with baking paper, lay in the steaks, top with slices of tomato and mushroom, spread with mayonnaise and sprinkle with cheese. Bake in the oven at 190°C for about 25-30 min. Serve with a side (rice, buckwheat, pasta or bulgur) and vegetables. The recipe is for 2 days.'),
  ('lunch', 'Vištiena su bulvėmis orkaitėje', 'Oven-roasted chicken with potatoes',
   'Rub the chicken with the spices. Peel the potatoes, cut them into pieces and season with spices and oil. Roast everything in the oven at 200°C for about 35 min. Serve with fresh or fermented vegetables. Divide the portion in two.'),
  ('lunch', 'Vištiena su morkomis ir grietinėle', 'Chicken with carrots and cream',
   'Grate the carrot, chop the onion and garlic and fry them in ghee. Rub the chicken with the spices and cut it into pieces as you like. Once the vegetables have browned, add the chicken and brown it on both sides, then add the cream and simmer over low heat for about 15 min. Serve with the side of your choice and plenty of fresh vegetables.'),
  ('lunch', 'Vištienos šlaunelių mėsa su makaronais', 'Chicken thighs with pasta',
   'Fry the chicken, cut into pieces, with the garlic in ghee or oil and season. Cook the pasta in salted water as the packet says. Serve with sauerkraut or fresh vegetables. Makes portions for two days.'),
  -- dinner: 32
  ('dinner', 'Avinžirnių ir burokėlių salotas su feta', 'Chickpea and beetroot salad with feta',
   'Dice the beetroot, chop the onion and slice the cucumber. Mix all the vegetables with the chickpeas and spinach. Make a dressing from the Greek yogurt, honey, lemon juice, mustard and spices and pour it over the salad. Crumble the feta cheese on top.'),
  ('dinner', 'BIG MAC jautienos kotletukai', 'BIG MAC beef patties',
   'Cut the potatoes into wedges, season with spices and oil and roast in the oven at 190°C for about 30 min. Chop and fry the vegetables and add them to the minced beef along with the spices and mustard. Mix, fill muffin moulds and bake in the oven for 12-15 min. Brush with tomato sauce and leave in for a few more minutes. Serve with lettuce, vegetables and the potatoes. Makes portions for 2 days.'),
  ('dinner', 'Brokolių ir kiaušinių sūrio keksiukai', 'Broccoli, egg and cheese muffins',
   'Blanch the broccoli for a minute and chop it finely, then mix with the cheese, yogurt and beaten eggs. Add the chopped herbs, stir and pour into silicone muffin moulds. Bake at 180°C for about 15 min. Let them cool for 3-5 min and enjoy. Serve with a slice of dark rye bread (or two of white bread) on the side.'),
  ('dinner', 'Brokolių salotos su vištiena', 'Broccoli salad with chicken',
   'Roast the chicken (weighed raw) in the oven with your favourite spices. Chop the broccoli and apple and cut up the chicken. Mix everything with the yogurt and season.'),
  ('dinner', 'Burata salotos su citrininiu garstyčių padažu', 'Burrata salad with lemon mustard dressing',
   'Chop the salad and mix the dressing. Tear the burrata over the chopped vegetables and pour over the dressing.'),
  ('dinner', 'Burokėlių salotas su pupelėmis', 'Beetroot and bean salad',
   'Chop the beetroot and apple and put them in a bowl with the beans; season, add the Greek yogurt and mix. Serve with a slice of white toast.'),
  ('dinner', 'Dubenėlis su vištiena ir žaliuoju avokadų padažu', 'Chicken bowl with green avocado sauce',
   'Fry the chicken with the spices in a frying pan and cut it up. Cut up the vegetables of your choice and put them in a bowl. For the sauce, blend the avocado, herbs, Greek yogurt, water and lemon juice. Pour the sauce over the salad and mix. Serve with a slice of toast on the side.'),
  ('dinner', 'Grūdėtos varškės salotos', 'Cottage cheese salad',
   'Cut the vegetables into pieces of the size you like and mix with the cottage cheese and spices.'),
  ('dinner', 'Izraelietiška šakšuka', 'Israeli shakshuka',
   'Chop the vegetables, put them in a frying pan and cook over medium heat; you can add a few spoonfuls of water so they don''t stick. Add the spices; once the vegetables are soft, make hollows in the sauce and crack in the eggs. Cover and simmer for another 4-5 min, until the whites are fully set. You can add cumin, hot paprika or an Italian herb mix.'),
  ('dinner', 'Jūrų lydeka su daržovėmis', 'Hake with vegetables',
   'Rub the fish with the spices and sprinkle it with lemon juice. Bake in the oven for about 15 min at 180°C. Cut up the vegetables and drizzle them with olive oil and spices. Roast in a preheated oven for 5-10 min at 180°C.'),
  ('dinner', 'Keptas varškės sūris', 'Baked curd cheese',
   'Blend all the ingredients well in a food processor or by hand and rub them into the cheese (you can score it so the spices soak in better), then leave for an hour. Put the cheese with all the marinade on foil, wrap it well and bake at 180°C for about 20 min, then open the foil so the cheese browns. Put it on a salad or eat it on its own or with vegetables.'),
  ('dinner', 'Kugelio pusbrolis', 'Kugelis-style courgette bake',
   'Grate the courgette coarsely, sprinkle with salt and leave to stand so it releases as much liquid as possible. Meanwhile, beat the quark and eggs smooth in a food processor or with a blender. Grate the mozzarella separately. Squeeze the liquid out of the courgette, add all the ingredients to it, mix and bake in a preheated oven at 180°C for 40 min. Serve with Greek yogurt, 70 g per portion. Makes portions for two days.'),
  ('dinner', 'Lašiša su šviežių daržovių salotomis', 'Salmon with fresh vegetable salad',
   'Season the salmon and cook it in the air fryer, a frying pan or the oven. Make a salad from the chopped vegetables, yogurt and spices of your choice. Serve with rice on the side.'),
  ('dinner', 'Lašišos salotos su burokėlais ir medaus-citrinų padažu', 'Salmon salad with beetroot and honey lemon dressing',
   'Chop the vegetables (beetroot, spinach or lettuce, onion, cucumbers) and put them in a bowl. Top with the flaked salmon and seeds. Pour over a dressing of olive oil, lemon juice and honey. Serve with white bread.'),
  ('dinner', 'Mocarela sūrio salotos', 'Mozzarella salad',
   'Cut up the vegetables and mozzarella; boil the egg and cut it into four or more pieces. Mix everything with the dressing (lemon juice, olive oil, dried parsley).'),
  ('dinner', 'Morkų wrapai su lašiša ir kreminiu sūriu', 'Carrot wraps with salmon and cream cheese',
   'Grate the carrots finely or coarsely (as you prefer) and mix with the cheese and eggs. Shape four flatbreads. Bake at 220°C for about 12-15 min (watch until they are as golden as you like). Divide the flatbreads over two days. For the filling: spread the flatbreads with cream cheese, add the lettuce, season with lemon pepper and top with the salmon.'),
  ('dinner', 'Orkaitėje kepti varškėčiai', 'Oven-baked quark pancakes',
   'Mix everything and bake in the oven on baking paper at 170°C for about 10-12 min. Serve with 70 g of plain yogurt and berries. You can sprinkle them with cinnamon.'),
  ('dinner', 'Pik Nik varškėtukai', 'Pik Nik quark pancakes',
   'Mix the ingredients for the pancakes and cut the Pik Nik cheese sausage into 4 pieces. Shape a round of dough, press a piece of cheese sausage into it and form the pancake around it. Fry on both sides over medium heat in a covered frying pan with hot oil. While the pancakes cook, make the sauce: chop the vegetables (mushrooms), fry them in a hot frying pan, add the cream cheese after a minute, pour in water and add the parsley.'),
  ('dinner', 'Pikantiški varškės kamuoliukai', 'Spicy quark balls',
   'Mix the quark with the chopped smoked chicken, egg, flour, baking powder and spices. Shape balls with wet hands. Bake in the air fryer or oven at 185°C for ~15 min. Serve with a sauce (Greek yogurt, tomato sauce, garlic) and vegetables. Makes portions for 2 days.'),
  ('dinner', 'Pomidorų salotos su burrata sūriu', 'Tomato salad with burrata',
   'Cut the cherry tomatoes in half and put them in a bowl with the rocket. Stir in the pesto, salt and pepper. Top with the burrata and garnish with basil leaves.'),
  ('dinner', 'Salotos su halloumi sūriu', 'Halloumi salad',
   'Cut up the vegetables and fry the cheese on both sides in a frying pan without fat. Serve straight away. Pour over the dressing (olive oil, lemon, salt, pepper).'),
  ('dinner', 'Salotos su tunu', 'Tuna salad',
   'Mix everything and serve with a slice of bread. For the dressing: olive oil, a squeeze of lemon if you like, salt and pepper.'),
  ('dinner', 'Salotos su vištiena ir riešutų padažu', 'Chicken salad with nut sauce',
   'Marinate the chicken in the spices of your choice. Cook the marinated chicken in the oven or air fryer. Meanwhile, cut up the vegetables. Put all the sauce ingredients in a hot frying pan over low heat and stir until smooth. Put the cooked chicken on the vegetables and pour over the sauce.'),
  ('dinner', 'Trinta brokolių sriuba', 'Broccoli soup',
   'Cut the broccoli into florets and the potatoes and carrots into small pieces. Put the vegetables in a pot, cover with water, add a pinch of salt and cook until soft. Drain the cooked vegetables. Pour in the stock and cream and season. Put the pot back on the heat and bring to the boil. Turn off the heat and blend the soup with a blender until completely smooth.'),
  ('dinner', 'Trinta moliūgų sriuba', 'Pumpkin soup',
   'Cut up the pumpkin, potatoes and onion, drizzle with oil, sprinkle with Italian herbs and roast in the oven at 185°C for ~20 min. Put the vegetables in a pot, add the stock and spices and blend with a hand blender. Serve with slices of white toast. Makes portions for 2 days.'),
  ('dinner', 'Tuno salotos su kepta duona', 'Tuna salad with croutons',
   'Cut the bread into small cubes and toast them in a dry frying pan or the oven. Mix all the other ingredients. Add the toasted bread cubes and toss.'),
  ('dinner', 'Varškės apkepas su žalumynais', 'Quark bake with herbs',
   'The recipe makes two portions. Blend the quark with the eggs, flour and milk. Add the spices and cheese and press in the garlic. Stir in the herbs. Pour into a dish lined with baking paper, top with cherry tomatoes and bake in an oven preheated to 180°C for about 25 min. Serve with Greek yogurt (60 g per portion).'),
  ('dinner', 'Varškės bandelės orkaitėje', 'Oven-baked quark buns',
   'Mix the dough ingredients until smooth; the dough should be a little sticky. Divide it into 4 pieces, shape oval buns and press a hollow into the middle of each with your fingers. Mix the filling ingredients (except the cherries), spread them in the middle of the buns and top with the cherries. Bake at 185°C for about 30 min (in the oven or air fryer).'),
  ('dinner', 'Varškės pado pica', 'Cottage cheese crust pizza',
   'Blend the cottage cheese, egg, flour and spices. Pour the mixture onto a baking tray lined with baking paper and shape it into a circle. Bake in the oven at 180°C for ~15 min. Take it out, add the toppings (tomato sauce, ham, cheese, vegetables, Italian herbs) and put it back in the oven for a few minutes, until the cheese melts.'),
  ('dinner', 'Vištienos sriuba su frikadelėmis', 'Chicken soup with meatballs',
   'Make a stock from the vegetables, spices and chicken bones or poultry. Add the chopped potatoes to the boiling stock. After 10-15 min, shape meatballs from the minced meat and drop them into the soup. Fry the carrot with the onion in a frying pan and add them to the soup. Add the herbs. Serve with white toast and a spoonful of Greek yogurt. Makes portions for 2 days.'),
  ('dinner', 'Česnakiniai lašišos iešmeliai', 'Garlic salmon skewers',
   'Soak the wooden skewers in water while you cook (so they don''t burn). In a bowl, press in the garlic, squeeze in the lemon juice, grate in the lemon zest and add the spices. Mix. Add the salmon cubes and stir so the pieces are evenly coated in the marinade. Leave to marinate for about an hour, but if you are short of time, you can cook them straight away. Cook in an oven preheated to 200°C for about 3-4 minutes. Then turn the skewers over and cook for another 4-5 minutes. You can also cook them in a frying pan. Serve with a vegetable salad.'),
  ('dinner', 'Įdaryti kiaušiniai', 'Stuffed eggs',
   'Hard-boil the eggs (add vinegar or lemon juice to the boiling water so they peel more easily) and cut them in half. Mix the yolks with all the other ingredients and fill the eggs. Serve with vegetables and a slice of bread (about 60 g) on the side.'),
  -- snack: 28
  ('snack', 'Agurkų sushi', 'Cucumber sushi',
   'Slice the cucumber into ribbons with a peeler, lay them side by side so the edges overlap, spread with cream cheese, add salmon or tuna, roll up and slice.'),
  ('snack', 'Baltyminiai sūreliai', 'Protein curd bars',
   'Portion: 2 pcs (22.5 g of protein).'),
  ('snack', 'Baltyminio pudingo desertas', 'Protein pudding dessert',
   'Dissolve the jelly packet in 250 ml of hot water and blend in 400 g of Greek yogurt; you can add berries. Pour into small pots (2 portions).'),
  ('snack', 'Burokėlių sriuba užkandžiui', 'Beetroot soup snack',
   'Dissolve the stock cubes in water and add the chopped potatoes and bay leaves. Fry the onion, carrot and beetroot in a frying pan, then tip everything into the pot and cook until soft. You can add Greek yogurt when serving.'),
  ('snack', 'Chia pudingas', 'Chia pudding',
   'Mix two tablespoons of chia seeds with 100 g of Greek yogurt (2.5%) and the honey and leave to swell overnight. Top with berries or fruit before eating.'),
  ('snack', 'Džiovintas varškės sūris', 'Dried curd cheese',
   '50 g of Dvaras dried curd cheese (20% fat).'),
  ('snack', 'Džiugo sūris su daržovėmis', 'Džiugas cheese with vegetables',
   '40 g of Džiugas cheese pieces with cucumber and tomato.'),
  ('snack', 'Grūdėta varškė', 'Cottage cheese',
   '200 g of cottage cheese (up to 5% fat).'),
  ('snack', 'Humusas su daržovių lazdelėmis', 'Hummus with vegetable sticks',
   '100 g of hummus with cucumber, carrot, celery and bell pepper sticks.'),
  ('snack', 'Kefyras', 'Kefir',
   '500 g of kefir (2.5%).'),
  ('snack', 'Kinder country desertas', 'Kinder Country dessert',
   'Crumble the rice cakes finely and mix the yogurt with the sweetener or protein of your choice (or flavour drops, honey or maple syrup), then stir in the crumbled rice cakes. Melt the Kinder chocolate bar and use it to decorate the top of the dessert. Chill in the fridge for ~20 min; you can keep it there longer if you don''t plan to eat it straight away.'),
  ('snack', 'Liesa varškė su uogomis/vaisiais', 'Low-fat quark with berries or fruit',
   'Mix 180 g of low-fat quark with cinnamon, a handful of berries or one piece of fruit and sweetener.'),
  ('snack', 'Lęšių trapukai', 'Lentil crackers',
   '70 g of Ustukių mini lentil crackers.'),
  ('snack', 'Mini cukinijų picos', 'Mini courgette pizzas',
   'Cut the courgette into rounds 1.5-2 cm thick and lay them on a baking tray. Spread with tomato sauce, top with salami or ham, cheese and spices and bake in the oven for 15-20 min.'),
  ('snack', 'Naminiai bananiniai ledai', 'Homemade banana ice cream',
   'Blend a frozen banana with a hand blender, adding a splash of milk or water and a teaspoon of cocoa.'),
  ('snack', 'Natūralus jogurtas su uogomis ir riešutų sviestu', 'Plain yogurt with berries and nut butter',
   'Mix 200 g of plain yogurt (2.5%) with a handful of berries, 10 g of nut butter and cinnamon.'),
  ('snack', 'Obuolys su riešutiniu kremu', 'Apple with nut cream',
   'Cut a larger apple into wedges and sprinkle with cinnamon. Mix the Greek yogurt with the nut butter (or protein powder) and dip the apple wedges in it.'),
  ('snack', 'PikNik sūrio lazdelės su daržovėmis', 'PikNik cheese sticks with vegetables',
   '4 PikNik cheese sticks with cucumber and tomato.'),
  ('snack', 'Pupelių brownie', 'Bean brownie',
   'Blend the oats into flour, add the canned red kidney beans, baking powder, honey, coconut oil or butter, nut butter, cocoa and cinnamon and blend until smooth. Bake at 180°C for 25 min. (The recipe makes 4 portions.)'),
  ('snack', 'Pusriebė varškė su uogomis/vaisiais', 'Half-fat quark with berries or fruit',
   '150 g of half-fat quark with cinnamon, a handful of berries or one piece of fruit, and sweetener to taste.'),
  ('snack', 'Riešutai ir juodasis šokoladas', 'Nuts and dark chocolate',
   '10 almonds or other nuts (unroasted, unsalted) and 30 g of dark chocolate (at least 70%).'),
  ('snack', 'Rūkyta vištiena / kalakutiena su šviežiomis daržovėmis', 'Smoked chicken or turkey with fresh vegetables',
   'Serve 130 g of smoked chicken or turkey with fresh vegetables.'),
  ('snack', 'Spragėsiai su druska', 'Salted popcorn',
   '50 g of salted popcorn.'),
  ('snack', 'Sumuštinis su kreminiu sūriu / avokadu ir paukštiena', 'Cream cheese or avocado sandwich with poultry',
   'A slice of wholegrain bread or two crispbreads with cream cheese (20 g) or mashed avocado (40 g) and poultry ham or smoked chicken.'),
  ('snack', 'Trapučiai / tortilija su riešutų sviestu ir bananu', 'Rice cakes or tortilla with nut butter and banana',
   'A tortilla or a couple of rice cakes with 15 g of nut butter, half a banana or berries, and cinnamon.'),
  ('snack', 'Vaisiai', 'Fruit',
   'About 300 g of the fruit of your choice.'),
  ('snack', 'Varškės sūris su medumi ir uogomis', 'Curd cheese with honey and berries',
   '100 g of curd cheese (13%) with a teaspoon of honey and berries.'),
  ('snack', 'Vytinta jautiena su daržovėmis', 'Air-dried beef with vegetables',
   '40 g of air-dried beef with cucumber and tomato.');

do $$
declare
  unmatched text;
begin
  select string_agg(format('%s (%s)', english.lt_name, english.meal_type), '; ') into unmatched
  from english_recipes english
  where not exists (
    select 1 from public.recipes recipe where recipe.name = english.lt_name and recipe.meal_type = english.meal_type
  );
  if unmatched is not null then
    raise exception 'English recipe translations match no recipe: %', unmatched;
  end if;
end;
$$;

insert into public.recipe_translations (recipe_id, locale, name, instructions)
select recipe.id, 'en', english.name, english.instructions
from english_recipes english
join public.recipes recipe on recipe.name = english.lt_name and recipe.meal_type = english.meal_type
on conflict (recipe_id, locale) do update
set name = excluded.name, instructions = excluded.instructions
where (recipe_translations.name, recipe_translations.instructions)
  is distinct from (excluded.name, excluded.instructions);

drop table english_recipes;

create temporary table if not exists english_recipe_items (lt_item text, item text);
truncate english_recipe_items;

-- Every distinct item the seeded recipes write, as written.
insert into english_recipe_items (lt_item, item)
values
  ('Actas', 'Vinegar'),
  ('Agurkai', 'Cucumbers'),
  ('Agurkai, pomidorai, kitos daržovės', 'Cucumbers, tomatoes, other vegetables'),
  ('Agurkas', 'Cucumber'),
  ('Agurkų lazdelės', 'Cucumber sticks'),
  ('Aliejus', 'Oil'),
  ('Alyvuogių aliejus', 'Olive oil'),
  ('Alyvuogės', 'Olives'),
  ('Augalinis pienas arba natūralus jogurtas', 'Plant-based milk or plain yogurt'),
  ('Avižiniai dribsniai', 'Rolled oats'),
  ('Avižų miltai (sublendintos avižos)', 'Oat flour (blended oats)'),
  ('Avokadas', 'Avocado'),
  ('Baltyminiai sūreliai', 'Protein curd bars'),
  ('Baltymų milteliai', 'Protein powder'),
  ('Bananas', 'Banana'),
  ('Basmati ryžiai', 'Basmati rice'),
  ('Bazilikas', 'Basil'),
  ('Brokolis', 'Broccoli'),
  ('Bulvės', 'Potatoes'),
  ('Bulvės (didelės)', 'Potatoes (large)'),
  ('Burrata sūris', 'Burrata'),
  ('Chia sėklos', 'Chia seeds'),
  ('Ciberžolė, karis, kmynai, imbieras', 'Turmeric, curry powder, cumin, ginger'),
  ('Cinamonas', 'Cinnamon'),
  ('Citrina', 'Lemon'),
  ('Citrina (sultys ir nutarkuota žievelė)', 'Lemon (juice and grated zest)'),
  ('Citrinos sultys', 'Lemon juice'),
  ('Citrinos sultys arba actas', 'Lemon juice or vinegar'),
  ('Citrinpipiriai', 'Lemon pepper'),
  ('Citrinpipiriai / citrinos sultys / prieskoniai', 'Lemon pepper / lemon juice / spices'),
  ('Cukinija', 'Courgette'),
  ('Daržovių salotos', 'Vegetable salad'),
  ('Daržovės', 'Vegetables'),
  ('Druska', 'Salt'),
  ('Druska, pipirai, mėgstami prieskoniai', 'Salt, pepper, favourite spices'),
  ('Druska, pipirai, raudonos paprikos prieskoniai', 'Salt, pepper, red paprika'),
  ('Duona', 'Bread'),
  ('Džiovintas varškės sūris', 'Dried curd cheese'),
  ('Džiugo sūris', 'Džiugas cheese'),
  ('Fermentinis sūris', 'Semi-hard cheese'),
  ('Fetos arba graikiškas sūris', 'Feta or Greek cheese'),
  ('Fetos arba ožkos sūris', 'Feta or goat cheese'),
  ('Fetos sūris', 'Feta cheese'),
  ('Fetos sūris (arba burata likutis)', 'Feta cheese (or leftover burrata)'),
  ('Garnyras (makaronai/kruopos)', 'Side (pasta or grains)'),
  ('Garstyčios', 'Mustard'),
  ('Ghee sviestas', 'Ghee'),
  ('Ghee sviestas arba aliejus', 'Ghee or oil'),
  ('Ghee sviestas arba alyvuogių aliejus', 'Ghee or olive oil'),
  ('Graikiškas jogurtas', 'Greek yogurt'),
  ('Grietinėlė (sojų Alpro arba 12% rieb.)', 'Cream (Alpro soya or 12% fat)'),
  ('Grikiai (sausi)', 'Buckwheat (dry)'),
  ('Grikiai arba ryžiai (sausi)', 'Buckwheat or rice (dry)'),
  ('Grūdėta varškė', 'Cottage cheese'),
  ('Halloumi sūris', 'Halloumi'),
  ('Humusas', 'Hummus'),
  ('Itališkos žolelės', 'Italian herbs'),
  ('Itališkos žolelės / picos prieskoniai', 'Italian herbs / pizza seasoning'),
  ('Jogurtas be laktozės / graikiškas', 'Lactose-free or Greek yogurt'),
  ('Juoda duona', 'Dark rye bread'),
  ('Juoda duona arba grikiai (sausi)', 'Dark rye bread or buckwheat (dry)'),
  ('Juodasis šokoladas', 'Dark chocolate'),
  ('Jūrinės lydekos filė', 'Hake fillet'),
  ('Kakava', 'Cocoa'),
  ('Kalakutienos/kiaulienos kumpis', 'Turkey or pork ham'),
  ('Kefyras', 'Kefir'),
  ('Kepimo milteliai', 'Baking powder'),
  ('Keptos paukštienos mėsa (be riebalų)', 'Roast poultry meat (no fat)'),
  ('Keptos vištienos filė (svertas neapdorotas)', 'Roast chicken fillet (weighed raw)'),
  ('Kiaulienos išpjova', 'Pork tenderloin'),
  ('Kiaušiniai', 'Eggs'),
  ('Kiaušiniai (M)', 'Eggs (M)'),
  ('Kietas tofu', 'Firm tofu'),
  ('Kietasis sūris', 'Hard cheese'),
  ('Kinder šokoladukas', 'Kinder chocolate bar'),
  ('Kitos daržovės', 'Other vegetables'),
  ('Kitos mėgstamos daržovės', 'Other favourite vegetables'),
  ('Kivis', 'Kiwi'),
  ('Kokoso drožlės / cinamonas / aguonos', 'Desiccated coconut / cinnamon / poppy seeds'),
  ('Kokosų pienas light', 'Light coconut milk'),
  ('Konservuotas tunas savo sultyse', 'Canned tuna in its own juice'),
  ('Konservuoti avinžirniai', 'Canned chickpeas'),
  ('Konservuoti pomidorai', 'Canned tomatoes'),
  ('Konservuotos pupelės', 'Canned beans'),
  ('Konservuotos raudonosios pupelės', 'Canned red kidney beans'),
  ('Krapai / kiti žalumynai', 'Dill / other herbs'),
  ('Kreminis sūris', 'Cream cheese'),
  ('Kreminis sūris arba varškės užtepėlė', 'Cream cheese or curd spread'),
  ('Kreminis sūris be laktozės', 'Lactose-free cream cheese'),
  ('Krevetės', 'Prawns'),
  ('Kruasanas', 'Croissant'),
  ('Kukurūzai', 'Sweetcorn'),
  ('Kukurūzų miltai', 'Corn flour'),
  ('Kumpis', 'Ham'),
  ('Laimas', 'Lime'),
  ('Laimo sultys', 'Lime juice'),
  ('Laiškiniai česnakai', 'Garlic chives'),
  ('Lapinės salotos', 'Leaf lettuce'),
  ('Lašiša', 'Salmon'),
  ('Lašiša (neapdorota)', 'Salmon (raw)'),
  ('Lašišos filė', 'Salmon fillet'),
  ('Liesa grietinėlė 12%', 'Light cream 12%'),
  ('Liesa jautienos malta mėsa', 'Lean minced beef'),
  ('Liesa varškė', 'Low-fat quark'),
  ('Liesas majonezas', 'Light mayonnaise'),
  ('Liesas majonezas arba graikiškas jogurtas', 'Light mayonnaise or Greek yogurt'),
  ('Light majonezas', 'Light mayonnaise'),
  ('Lęšiai (sausi)', 'Lentils (dry)'),
  ('Lęšių trapukai', 'Lentil crackers'),
  ('Majonezas', 'Mayonnaise'),
  ('Makaronai (sausi)', 'Pasta (dry)'),
  ('Malta paprika arba muskatas', 'Ground paprika or nutmeg'),
  ('Malta paukštiena', 'Minced poultry'),
  ('Malta vištiena', 'Minced chicken'),
  ('Malta vištiena arba filė', 'Minced chicken or chicken fillet'),
  ('Marinuoti agurkėliai', 'Pickled gherkins'),
  ('Marinuotų agurkėlių skystis', 'Pickled gherkin brine'),
  ('Medus', 'Honey'),
  ('Menkės filė', 'Cod fillet'),
  ('Migdolai', 'Almonds'),
  ('Miltai', 'Flour'),
  ('Mocarela', 'Mozzarella'),
  ('Mocarela light', 'Light mozzarella'),
  ('Mocarela light sūris', 'Light mozzarella cheese'),
  ('Mocarela sūris', 'Mozzarella cheese'),
  ('Moliūgas', 'Pumpkin'),
  ('Moliūgų sėklos', 'Pumpkin seeds'),
  ('Morka', 'Carrot'),
  ('Morka (didelė)', 'Carrot (large)'),
  ('Morkos', 'Carrots'),
  ('Mėgstami prieskoniai', 'Favourite spices'),
  ('Mėgstamos uogos', 'Favourite berries'),
  ('Natūralus jogurtas', 'Plain yogurt'),
  ('Natūralus/graikiškas jogurtas', 'Plain or Greek yogurt'),
  ('Obuolys', 'Apple'),
  ('Paprika', 'Bell pepper'),
  ('Paprikos', 'Bell peppers'),
  ('Perlinės kruopos (sausos)', 'Pearl barley (dry)'),
  ('Pesto padažas', 'Pesto'),
  ('Petražolių prieskoniai', 'Dried parsley'),
  ('Petražolės', 'Parsley'),
  ('Petražolės, svogūnų laiškai, pipirai', 'Parsley, spring onions, pepper'),
  ('Picos prieskoniai', 'Pizza seasoning'),
  ('Pienas', 'Milk'),
  ('Pienas (be laktozės)', 'Milk (lactose-free)'),
  ('Pievagrybiai', 'Mushrooms'),
  ('Pievagrybiai / paprika / kitos daržovės', 'Mushrooms / bell pepper / other vegetables'),
  ('Pik Nik sūrio dešrelė', 'Pik Nik cheese sausage'),
  ('PikNik sūrio lazdelės', 'PikNik cheese sticks'),
  ('Pilno grūdo duona', 'Wholegrain bread'),
  ('Pilno grūdo makaronai (sausi)', 'Wholegrain pasta (dry)'),
  ('Pilno grūdo tortilija', 'Wholegrain tortilla'),
  ('Pipirai', 'Black pepper'),
  ('Pomidorai', 'Tomatoes'),
  ('Pomidorai (arba konservuoti)', 'Tomatoes (or canned)'),
  ('Pomidoras', 'Tomato'),
  ('Pomidoras (didesnis)', 'Tomato (larger)'),
  ('Pomidoriukai', 'Cherry tomatoes'),
  ('Pomidorų padažas', 'Tomato sauce'),
  ('Prieskoniai', 'Spices'),
  ('Prieskoniai (citrinpipiriai)', 'Spices (lemon pepper)'),
  ('Provanso žolelės', 'Herbes de Provence'),
  ('Pusriebė varškė', 'Half-fat quark'),
  ('Raudonasis svogūnas', 'Red onion'),
  ('Raudonoji paprika', 'Red bell pepper'),
  ('Raugintos arba šviežios daržovės', 'Fermented or fresh vegetables'),
  ('Ridikėliai', 'Radishes'),
  ('Riešutų sviestas', 'Nut butter'),
  ('Rukola', 'Rocket'),
  ('Ryžiai (rudieji/laukiniai/basmati, sausi)', 'Rice (brown, wild or basmati, dry)'),
  ('Ryžiai (sausi)', 'Rice (dry)'),
  ('Ryžių trapučiai', 'Rice cakes'),
  ('Rūkyta lašiša', 'Smoked salmon'),
  ('Rūkyta paprika', 'Smoked paprika'),
  ('Rūkyta vištiena', 'Smoked chicken'),
  ('Rūkyta šoninė', 'Smoked bacon'),
  ('Rūkyta/saldžioji paprika, druska, pipirai', 'Smoked or sweet paprika, salt, pepper'),
  ('Saldiklis', 'Sweetener'),
  ('Saldiklis (eritritolis, skonio lašiukai ar medus)', 'Sweetener (erythritol, flavour drops or honey)'),
  ('Saldiklis / medus', 'Sweetener / honey'),
  ('Saldžios bulvės (batatai)', 'Sweet potatoes'),
  ('Salotos, pomidoras, agurkas, raudonas svogūnas, krapai, mėtos', 'Lettuce, tomato, cucumber, red onion, dill, mint'),
  ('Salotų lapai', 'Lettuce leaves'),
  ('Sezamo sėklos', 'Sesame seeds'),
  ('Sezamų sėklos', 'Sesame seeds'),
  ('Sojų grietinėlė arba liesa grietinėlė 12%', 'Soya cream or light cream 12%'),
  ('Sojų padažas', 'Soy sauce'),
  ('Spaghetti makaronai', 'Spaghetti'),
  ('Spragėsiai', 'Popcorn'),
  ('Sultinys', 'Stock'),
  ('Sviestas', 'Butter'),
  ('Sviestas/ghee arba kepimo aliejus', 'Butter, ghee or cooking oil'),
  ('Svogūnas', 'Onion'),
  ('Svogūnlaiškiai', 'Spring onions'),
  ('Sėklos', 'Seeds'),
  ('Sūdyta/rūkyta lašiša', 'Salted or smoked salmon'),
  ('Sūris', 'Cheese'),
  ('Tarkuotas kietas sūris', 'Grated hard cheese'),
  ('Tarkuotas sūris', 'Grated cheese'),
  ('Tortilija', 'Tortilla'),
  ('Uogos', 'Berries'),
  ('Vaisiai / uogos', 'Fruit / berries'),
  ('Vanduo', 'Water'),
  ('Vanilė', 'Vanilla'),
  ('Varškė', 'Quark'),
  ('Varškė 0.5%', 'Quark 0.5%'),
  ('Varškė 9%', 'Quark 9%'),
  ('Varškės sūris', 'Curd cheese'),
  ('Varškės sūris (13%)', 'Curd cheese (13%)'),
  ('Virti avinžirniai', 'Cooked chickpeas'),
  ('Virti/kepti burokėliai', 'Boiled or roasted beetroot'),
  ('Viso grūdo duona (šviesi, kvadratinė)', 'Wholegrain bread (white, sandwich loaf)'),
  ('Viso grūdo miltai', 'Wholemeal flour'),
  ('Viso grūdo spagečiai', 'Wholegrain spaghetti'),
  ('Vištienos filė', 'Chicken fillet'),
  ('Vištienos kaulai/paukštiena sultiniui', 'Chicken bones or poultry for stock'),
  ('Vištienos krūtinėlė', 'Chicken breast'),
  ('Vištienos prieskoniai', 'Chicken seasoning'),
  ('Vištienos šlaunelių mėsa', 'Chicken thigh fillet'),
  ('Vytinta jautiena', 'Air-dried beef'),
  ('Vyšniniai pomidorai', 'Cherry tomatoes'),
  ('Vyšniniai pomidoriukai', 'Cherry tomatoes'),
  ('Česnakas', 'Garlic'),
  ('Česnako milteliai', 'Garlic powder'),
  ('Česnako milteliai / petražolės', 'Garlic powder / parsley'),
  ('Šaldytos vyšnios (arba kitos uogos)', 'Frozen cherries (or other berries)'),
  ('Špinatai', 'Spinach'),
  ('Šviesi duona', 'White bread'),
  ('Šviesi forminė duona', 'White sandwich bread'),
  ('Švieži baziliko lapeliai', 'Fresh basil leaves'),
  ('Švieži vaisiai', 'Fresh fruit'),
  ('Švieži žalumynai', 'Fresh herbs'),
  ('Šviežios arba raugintos daržovės', 'Fresh or fermented vegetables'),
  ('Šviežios daržovės', 'Fresh vegetables'),
  ('Žalumynai', 'Herbs'),
  ('Želė', 'Jelly'),
  ('Žemės riešutų sviestas', 'Peanut butter'),
  ('Žuvies prieskoniai', 'Fish seasoning'),
  ('Žuvies žolelės ir prieskoniai', 'Fish herbs and spices'),
  ('Žuvis (jūrų lydeka)', 'Fish (hake)');

create temporary table if not exists english_recipe_units (lt_item text, lt_unit text, unit text);
truncate english_recipe_units;

-- Lines whose unit the shared unit label would translate wrongly.
insert into english_recipe_units (lt_item, lt_unit, unit)
values
  -- skiltelė is a clove of garlic, but of a lime a wedge.
  ('Laimas', 'skiltelė', 'wedge');

do $$
declare
  unmatched text;
begin
  select string_agg(english.lt_item, '; ') into unmatched
  from english_recipe_items english
  where not exists (select 1 from public.recipe_ingredients line where line.item = english.lt_item);
  if unmatched is not null then
    raise exception 'English recipe line translations match no recipe line: %', unmatched;
  end if;

  select string_agg(format('%s (%s)', english.lt_item, english.lt_unit), '; ') into unmatched
  from english_recipe_units english
  where not exists (
    select 1 from public.recipe_ingredients line where line.item = english.lt_item and line.unit = english.lt_unit
  );
  if unmatched is not null then
    raise exception 'English unit translations match no recipe line: %', unmatched;
  end if;
end;
$$;

insert into public.recipe_ingredient_translations (recipe_ingredient_id, locale, item, unit)
select line.id, 'en', english.item, english_unit.unit
from public.recipe_ingredients line
join english_recipe_items english on english.lt_item = line.item
left join english_recipe_units english_unit on english_unit.lt_item = line.item and english_unit.lt_unit = line.unit
on conflict (recipe_ingredient_id, locale) do update
set item = excluded.item, unit = excluded.unit
where (recipe_ingredient_translations.item, recipe_ingredient_translations.unit)
  is distinct from (excluded.item, excluded.unit);

drop table english_recipe_units;
drop table english_recipe_items;

create temporary table if not exists english_ingredients (lt_name text, name text);
truncate english_ingredients;

-- Canonical ingredients (G1), by category in list order.
insert into english_ingredients (lt_name, name)
values
  -- fruit_and_vegetables: 36
  ('Agurkas', 'Cucumber'),
  ('Avokadas', 'Avocado'),
  ('Bananas', 'Banana'),
  ('Batatai', 'Sweet potatoes'),
  ('Bazilikas', 'Basil'),
  ('Brokolis', 'Broccoli'),
  ('Bulvės', 'Potatoes'),
  ('Burokėliai', 'Beetroot'),
  ('Citrina', 'Lemon'),
  ('Citrinos sultys', 'Lemon juice'),
  ('Cukinija', 'Courgette'),
  ('Kivis', 'Kiwi'),
  ('Krapai', 'Dill'),
  ('Laimas', 'Lime'),
  ('Laimo sultys', 'Lime juice'),
  ('Laiškiniai česnakai', 'Garlic chives'),
  ('Moliūgas', 'Pumpkin'),
  ('Morka', 'Carrot'),
  ('Obuolys', 'Apple'),
  ('Paprika', 'Bell pepper'),
  ('Petražolės', 'Parsley'),
  ('Pievagrybiai', 'Mushrooms'),
  ('Pomidoras', 'Tomato'),
  ('Raudonasis svogūnas', 'Red onion'),
  ('Ridikėliai', 'Radishes'),
  ('Rukola', 'Rocket'),
  ('Salotų lapai', 'Lettuce leaves'),
  ('Svogūnas', 'Onion'),
  ('Svogūnų laiškai', 'Spring onions'),
  ('Uogos', 'Berries'),
  ('Vyšniniai pomidorai', 'Cherry tomatoes'),
  ('Česnakas', 'Garlic'),
  ('Špinatai', 'Spinach'),
  ('Švieži vaisiai', 'Fresh fruit'),
  ('Švieži žalumynai', 'Fresh herbs'),
  ('Šviežios daržovės', 'Fresh vegetables'),
  -- meat_and_fish: 16
  ('Jūrų lydekos filė', 'Hake fillet'),
  ('Kiaulienos išpjova', 'Pork tenderloin'),
  ('Krevetės', 'Prawns'),
  ('Kumpis', 'Ham'),
  ('Lašišos filė', 'Salmon fillet'),
  ('Liesa jautienos malta mėsa', 'Lean minced beef'),
  ('Malta vištiena', 'Minced chicken'),
  ('Menkės filė', 'Cod fillet'),
  ('Pik Nik sūrio dešrelė', 'Pik Nik cheese sausage'),
  ('Rūkyta lašiša', 'Smoked salmon'),
  ('Rūkyta vištiena', 'Smoked chicken'),
  ('Rūkyta šoninė', 'Smoked bacon'),
  ('Vištienos filė', 'Chicken fillet'),
  ('Vištienos kaulai', 'Chicken bones'),
  ('Vištienos šlaunelių mėsa', 'Chicken thigh fillet'),
  ('Vytinta jautiena', 'Air-dried beef'),
  -- dairy_and_eggs: 29
  ('Augalinis pienas', 'Plant-based milk'),
  ('Baltyminiai sūreliai', 'Protein curd bars'),
  ('Burrata sūris', 'Burrata'),
  ('Džiovintas varškės sūris', 'Dried curd cheese'),
  ('Džiugo sūris', 'Džiugas cheese'),
  ('Fetos sūris', 'Feta cheese'),
  ('Ghee sviestas', 'Ghee'),
  ('Graikiškas jogurtas', 'Greek yogurt'),
  ('Grietinėlė', 'Cream'),
  ('Grūdėta varškė', 'Cottage cheese'),
  ('Halloumi sūris', 'Halloumi'),
  ('Jogurtas be laktozės', 'Lactose-free yogurt'),
  ('Kefyras', 'Kefir'),
  ('Kiaušiniai', 'Eggs'),
  ('Kietasis sūris', 'Hard cheese'),
  ('Kreminis sūris', 'Cream cheese'),
  ('Kreminis sūris be laktozės', 'Lactose-free cream cheese'),
  ('Liesa varškė', 'Low-fat quark'),
  ('Mocarela', 'Mozzarella'),
  ('Mocarela light', 'Light mozzarella'),
  ('Natūralus jogurtas', 'Plain yogurt'),
  ('Pienas', 'Milk'),
  ('Pienas be laktozės', 'Lactose-free milk'),
  ('PikNik sūrio lazdelės', 'PikNik cheese sticks'),
  ('Pusriebė varškė', 'Half-fat quark'),
  ('Sviestas', 'Butter'),
  ('Sūris', 'Cheese'),
  ('Varškė', 'Quark'),
  ('Varškės sūris', 'Curd cheese'),
  -- grains_and_bread: 18
  ('Avižiniai dribsniai', 'Rolled oats'),
  ('Duona', 'Bread'),
  ('Grikiai', 'Buckwheat'),
  ('Juoda duona', 'Dark rye bread'),
  ('Kruasanas', 'Croissant'),
  ('Kukurūzų miltai', 'Corn flour'),
  ('Lęšių trapučiai', 'Lentil crackers'),
  ('Makaronai', 'Pasta'),
  ('Miltai', 'Flour'),
  ('Perlinės kruopos', 'Pearl barley'),
  ('Pilno grūdo duona', 'Wholegrain bread'),
  ('Pilno grūdo makaronai', 'Wholegrain pasta'),
  ('Pilno grūdo tortilija', 'Wholegrain tortilla'),
  ('Ryžiai', 'Rice'),
  ('Ryžių trapučiai', 'Rice cakes'),
  ('Tortilija', 'Tortilla'),
  ('Viso grūdo miltai', 'Wholemeal flour'),
  ('Šviesi duona', 'White bread'),
  -- pantry: 52
  ('Actas', 'Vinegar'),
  ('Aliejus', 'Cooking oil'),
  ('Alyvuogių aliejus', 'Olive oil'),
  ('Alyvuogės', 'Olives'),
  ('Baltymų milteliai', 'Protein powder'),
  ('Chia sėklos', 'Chia seeds'),
  ('Cinamonas', 'Cinnamon'),
  ('Citrinpipiriai', 'Lemon pepper'),
  ('Druska', 'Salt'),
  ('Garstyčios', 'Mustard'),
  ('Itališkos žolelės', 'Italian herbs'),
  ('Juodasis šokoladas', 'Dark chocolate'),
  ('Kakava', 'Cocoa'),
  ('Kepimo milteliai', 'Baking powder'),
  ('Kinder šokoladukas', 'Kinder chocolate bar'),
  ('Kokoso drožlės', 'Desiccated coconut'),
  ('Kokosų pienas light', 'Light coconut milk'),
  ('Konservuotas tunas', 'Canned tuna'),
  ('Konservuoti avinžirniai', 'Canned chickpeas'),
  ('Konservuoti pomidorai', 'Canned tomatoes'),
  ('Konservuotos pupelės', 'Canned beans'),
  ('Konservuotos raudonosios pupelės', 'Canned red kidney beans'),
  ('Kukurūzai', 'Sweetcorn'),
  ('Liesas majonezas', 'Light mayonnaise'),
  ('Lęšiai', 'Lentils'),
  ('Majonezas', 'Mayonnaise'),
  ('Malta paprika', 'Ground paprika'),
  ('Marinuoti agurkėliai', 'Pickled gherkins'),
  ('Medus', 'Honey'),
  ('Migdolai', 'Almonds'),
  ('Moliūgų sėklos', 'Pumpkin seeds'),
  ('Pesto padažas', 'Pesto'),
  ('Petražolių prieskoniai', 'Dried parsley'),
  ('Picos prieskoniai', 'Pizza seasoning'),
  ('Pipirai', 'Black pepper'),
  ('Pomidorų padažas', 'Tomato sauce'),
  ('Prieskoniai', 'Spices'),
  ('Provanso žolelės', 'Herbes de Provence'),
  ('Raugintos daržovės', 'Fermented vegetables'),
  ('Riešutų sviestas', 'Nut butter'),
  ('Rūkyta paprika', 'Smoked paprika'),
  ('Saldiklis', 'Sweetener'),
  ('Sezamo sėklos', 'Sesame seeds'),
  ('Sojų padažas', 'Soy sauce'),
  ('Spragėsiai', 'Popcorn'),
  ('Sultinys', 'Stock'),
  ('Sėklos', 'Seeds'),
  ('Vanilė', 'Vanilla'),
  ('Vištienos prieskoniai', 'Chicken seasoning'),
  ('Česnako milteliai', 'Garlic powder'),
  ('Želė', 'Jelly'),
  ('Žuvies prieskoniai', 'Fish seasoning'),
  -- frozen: 1
  ('Šaldytos vyšnios', 'Frozen cherries'),
  -- other: 3
  ('Humusas', 'Hummus'),
  ('Tofu', 'Tofu'),
  ('Vanduo', 'Water');

do $$
declare
  unmatched text;
begin
  select string_agg(english.lt_name, '; ') into unmatched
  from english_ingredients english
  where not exists (select 1 from public.ingredients ingredient where ingredient.name = english.lt_name);
  if unmatched is not null then
    raise exception 'English ingredient translations match no ingredient: %', unmatched;
  end if;
end;
$$;

insert into public.ingredient_translations (ingredient_id, locale, name)
select ingredient.id, 'en', english.name
from english_ingredients english
join public.ingredients ingredient on ingredient.name = english.lt_name
on conflict (ingredient_id, locale) do update
set name = excluded.name
where ingredient_translations.name is distinct from excluded.name;

drop table english_ingredients;

create temporary table if not exists english_tips (lt_tip text, tip text);
truncate english_tips;

insert into english_tips (lt_tip, tip)
values
  ('Mitybos plane galima keisti patiekalus: pusryčius su pusryčiais, pietus su pietumis, vakarienę su vakariene.',
   'Meals in the plan can be swapped: a breakfast for another breakfast, a lunch for another lunch, a dinner for another dinner.'),
  ('Mitybos planas sudarytas 4 valgymams kas 3–5 valandas. Rekomenduojama tarp vakarienės ir pusryčių išlaikyti 12 valandų tarpą.',
   'The meal plan is built around 4 meals, every 3–5 hours. Leaving a 12-hour gap between dinner and breakfast is recommended.'),
  ('Svorio kritimo tempas skiriasi dėl genetikos, metabolizmo, hormonų, raumenų masės, miego bei streso lygio. Vertinkite savo progresą ilguoju laikotarpiu.',
   'How fast you lose weight varies with genetics, metabolism, hormones, muscle mass, sleep and stress levels. Judge your progress over the long term.'),
  ('Porcijas šeimoje rekomenduojama dalinti lygiai iš šeimos narių skaičiaus, o norintys daugiau įsideda papildomai.',
   'In a family, it is best to divide the portions equally between everyone, and those who want more can help themselves to extra.'),
  ('Daržovėms pirmenybę teikite šviežioms bei raugintoms (rekomenduojama valgyti kasdien). Šaldytos daržovės taip pat kupinos vitaminų. Marinuotas daržoves vartokite labai retai dėl cukraus kiekio.',
   'Choose fresh and fermented vegetables first (they are best eaten every day). Frozen vegetables are full of vitamins too. Eat pickled vegetables only rarely, because of the sugar in them.'),
  ('Kaip avokado pusę išlaikyti nepajuodavusią: apšlakstyti citrinų sultimis, suvynioti į maistinę plėvelę ir laikyti šaldytuve.',
   'To keep half an avocado from turning brown, sprinkle it with lemon juice, wrap it in cling film and keep it in the fridge.'),
  ('Rinkitės graikišką jogurtą iki 4% riebumo bei grūdėtą varškę iki 5% riebumo.',
   'Choose Greek yogurt with up to 4% fat and cottage cheese with up to 5% fat.'),
  ('Riešutų sviestą rinkitės tik tokį, kurio sudėtyje yra 100% riešutai (be pridėtinio aliejaus ir cukraus).',
   'Choose only nut butter made of 100% nuts (with no added oil or sugar).'),
  ('Tortilijas laikykite užsegamame maišelyje arba apvyniokite maistine plėvele, kad nebūtų oro tarpų – taip jos išliks minkštos ilgesnį laiką.',
   'Keep tortillas in a resealable bag or wrap them in cling film with no air gaps – that way they stay soft for longer.'),
  ('Duoną, mėsą ir kitus produktus galima užsišaldyti. Duona atšyla iškart ištraukus iš šaldiklio ir pašildžius sausoje keptuvėje arba orkaitėje.',
   'Bread, meat and other foods can be frozen. Bread thaws straight away if you take it out of the freezer and warm it in a dry frying pan or in the oven.'),
  ('Garnyrus galima keisti vieną kitu tais pačiais gramais (ryžiai, grikiai, makaronai, bolivinė balanda, perlinės kruopos). Jei recepte numatyta 60 g kruopų, galima keisti į 300 g bulvių.',
   'Sides can be swapped for one another gram for gram (rice, buckwheat, pasta, quinoa, pearl barley). If a recipe calls for 60 g of grains, you can have 300 g of potatoes instead.'),
  ('Produktų pakeitimai: 100 g vištienos = 100 g baltos žuvies; 100 g jautienos = 100 g lašišos/upėtakio; avokadą galima keisti humusu arba varškės užtepėle.',
   'Food swaps: 100 g of chicken = 100 g of white fish; 100 g of beef = 100 g of salmon or trout; avocado can be swapped for hummus or a curd spread.'),
  ('Lengviausias būdas paruošti kruopas (grikius ar avižas): užpilti karštu vandeniu iš vakaro, įberti druskos ir palikti pernakt. Ryte užteks tik pasišildyti.',
   'The easiest way to prepare grains (buckwheat or oats): pour hot water over them in the evening, add salt and leave them overnight. In the morning, just warm them up.'),
  ('Saldiklius (stevia, ksilitolį, eritritolį, skonio lašiukus) naudokite vietoje cukraus, tačiau pamažu mažinkite saldinimą apskritai.',
   'Use sweeteners (stevia, xylitol, erythritol, flavour drops) instead of sugar, but gradually cut down on sweetening altogether.'),
  ('Maistą būtina sverti maistinėmis svarstyklėmis. Nesveriamos tik šviežios daržovės ir prieskoniai.',
   'Always weigh your food on kitchen scales. Only fresh vegetables and spices are not weighed.');

do $$
declare
  unmatched text;
begin
  select string_agg(english.lt_tip, '; ') into unmatched
  from english_tips english
  where not exists (select 1 from public.tips tip where tip.tip = english.lt_tip);
  if unmatched is not null then
    raise exception 'English tip translations match no tip: %', unmatched;
  end if;
end;
$$;

insert into public.tip_translations (tip_id, locale, tip)
select tip.id, 'en', english.tip
from english_tips english
join public.tips tip on tip.tip = english.lt_tip
on conflict (tip_id, locale) do update
set tip = excluded.tip
where tip_translations.tip is distinct from excluded.tip;

drop table english_tips;

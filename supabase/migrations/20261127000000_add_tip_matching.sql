-- Tips in context (X3): which tips the app shows where. A tip has free-form tags (the seed's 'storage', 'avocado',
-- 'planning', ...); this migration adds what they are matched against, so the app can show a tip next to what it is
-- about. The rules (shared/utils/tips.ts, README "Tips in context"):
--
--   * Ingredient tips: a canonical ingredient (G1) gets tip_tags, the tip tags it is about. A tip matches an
--     ingredient when they share a tag (tips.tags && ingredients.tip_tags). A shopping list line shows the tips of its
--     ingredient; a recipe shows the tips of the ingredients its lines map to (ingredient_aliases).
--   * Plan tips: a tip tagged 'plan' (a context tag this migration adds to the planning tips) is shown on the plan
--     page. One also tagged 'family' is shown only on a plan for more than one person.
--
-- Tags are lower-case words joined by underscores, as the seed's. The tags below were chosen for the 15 seeded tips
-- one by one; a tip with no matching ingredient and no 'plan' tag is simply not shown in context:
--   avocado (storing half an avocado), tortillas (keeping tortillas soft), bread and freezing (bread and meat freeze),
--   yogurt / cottage_cheese (which fat content to choose), nut_butter (100% nuts), grains (overnight buckwheat or
--   oats), side_dishes (swapping side dishes gram for gram, potatoes 5:1), alternatives (chicken = white fish,
--   beef = salmon, avocado = hummus), vegetables / fermented_food (fresh and fermented vegetables, few pickled ones),
--   sweeteners / sugar (sweeteners instead of sugar).
--
-- Additive and re-runnable: the column and index are created if missing, the tags are set to the reviewed values
-- (running it again puts them back) and 'plan' is added only where it is missing. Tips and ingredients are matched by
-- their Lithuanian text, and a text that no longer matches aborts the migration. The previous app version does not
-- read the column.

alter table public.ingredients add column if not exists tip_tags text[] not null default '{}';

create index if not exists ingredients_tip_tags_idx on public.ingredients using gin (tip_tags);

comment on column public.ingredients.tip_tags is
  'Tip tags this ingredient is about (X3): a tip sharing one of them is shown on its shopping list lines and recipes.';

-- Ingredient tags.
create temporary table if not exists ingredient_tip_tags (name text primary key, tip_tags text[] not null);
truncate ingredient_tip_tags;

insert into ingredient_tip_tags (name, tip_tags)
values
  ('Avokadas', array['avocado', 'alternatives']),
  ('Tortilija', array['tortillas']),
  ('Pilno grūdo tortilija', array['tortillas']),
  ('Duona', array['bread']),
  ('Juoda duona', array['bread']),
  ('Pilno grūdo duona', array['bread']),
  ('Šviesi duona', array['bread']),
  -- Meat freezes as bread does; chicken and beef have an alternative (white fish, salmon).
  ('Vištienos filė', array['freezing', 'alternatives']),
  ('Vištienos šlaunelių mėsa', array['freezing']),
  ('Malta vištiena', array['freezing']),
  ('Liesa jautienos malta mėsa', array['freezing', 'alternatives']),
  ('Kiaulienos išpjova', array['freezing']),
  -- The fish the alternatives tip names: white fish for chicken, salmon or trout for beef.
  ('Menkės filė', array['alternatives']),
  ('Jūrų lydekos filė', array['alternatives']),
  ('Lašišos filė', array['alternatives']),
  ('Humusas', array['alternatives']),
  ('Graikiškas jogurtas', array['yogurt']),
  ('Grūdėta varškė', array['cottage_cheese']),
  ('Riešutų sviestas', array['nut_butter']),
  ('Grikiai', array['grains', 'side_dishes']),
  ('Avižiniai dribsniai', array['grains']),
  ('Ryžiai', array['side_dishes']),
  ('Makaronai', array['side_dishes']),
  ('Pilno grūdo makaronai', array['side_dishes']),
  ('Perlinės kruopos', array['side_dishes']),
  ('Bulvės', array['side_dishes']),
  ('Šviežios daržovės', array['vegetables']),
  ('Raugintos daržovės', array['fermented_food']),
  ('Marinuoti agurkėliai', array['vegetables']),
  ('Saldiklis', array['sweeteners']),
  ('Medus', array['sugar']);

do $$
declare
  unmatched text;
begin
  select string_agg(tagged.name, '; ') into unmatched
  from ingredient_tip_tags tagged
  where not exists (select 1 from public.ingredients ingredient where ingredient.name = tagged.name);
  if unmatched is not null then
    raise exception 'Tip tags name no ingredient: %', unmatched;
  end if;
end;
$$;

-- An ingredient no longer listed loses its tags, so the list above is the whole mapping.
update public.ingredients ingredient
set tip_tags = coalesce(tagged.tip_tags, '{}')
from public.ingredients target
left join ingredient_tip_tags tagged on tagged.name = target.name
where target.id = ingredient.id
  and ingredient.tip_tags is distinct from coalesce(tagged.tip_tags, '{}');

drop table ingredient_tip_tags;

-- The plan page's tips: planning, meal times, progress, family portions and weighing.
create temporary table if not exists plan_tips (tip text primary key);
truncate plan_tips;

insert into plan_tips (tip)
values
  ('Mitybos plane galima keisti patiekalus: pusryčius su pusryčiais, pietus su pietumis, vakarienę su vakariene.'),
  ('Mitybos planas sudarytas 4 valgymams kas 3–5 valandas. Rekomenduojama tarp vakarienės ir pusryčių išlaikyti 12 valandų tarpą.'),
  ('Svorio kritimo tempas skiriasi dėl genetikos, metabolizmo, hormonų, raumenų masės, miego bei streso lygio. Vertinkite savo progresą ilguoju laikotarpiu.'),
  ('Porcijas šeimoje rekomenduojama dalinti lygiai iš šeimos narių skaičiaus, o norintys daugiau įsideda papildomai.'),
  ('Maistą būtina sverti maistinėmis svarstyklėmis. Nesveriamos tik šviežios daržovės ir prieskoniai.');

do $$
declare
  unmatched text;
begin
  select string_agg(plan_tip.tip, '; ') into unmatched
  from plan_tips plan_tip
  where not exists (select 1 from public.tips tip where tip.tip = plan_tip.tip);
  if unmatched is not null then
    raise exception 'Plan tips match no tip: %', unmatched;
  end if;
end;
$$;

update public.tips tip
set tags = array_append(tip.tags, 'plan')
from plan_tips plan_tip
where plan_tip.tip = tip.tip
  and not ('plan' = any (tip.tags));

drop table plan_tips;

-- Recipes (breakfast / lunch / dinner / snack), their ingredients, and planning tips.

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  meal_type     public.meal_type not null,
  instructions  text not null default '',
  calories_kcal numeric(7, 2),
  carbohydrates numeric(7, 2),
  protein       numeric(7, 2),
  fat           numeric(7, 2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint recipes_name_meal_type_key unique (name, meal_type),
  constraint recipes_macros_non_negative check (
    coalesce(calories_kcal, 0) >= 0
    and coalesce(carbohydrates, 0) >= 0
    and coalesce(protein, 0) >= 0
    and coalesce(fat, 0) >= 0
  )
);

create index recipes_meal_type_idx on public.recipes (meal_type);

-- amount / unit are null for "to taste" items (spices, salt, fresh herbs).
create table public.recipe_ingredients (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position  smallint not null,
  item      text not null,
  amount    numeric(8, 2),
  unit      text,
  constraint recipe_ingredients_recipe_position_key unique (recipe_id, position),
  constraint recipe_ingredients_amount_positive check (amount is null or amount > 0),
  constraint recipe_ingredients_amount_unit_together check ((amount is null) = (unit is null))
);

create index recipe_ingredients_item_idx on public.recipe_ingredients (item);

create table public.tips (
  id         uuid primary key default gen_random_uuid(),
  tip        text not null,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index tips_tags_idx on public.tips using gin (tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- Row level security: readable by signed-in users; writes only via the service role.
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.tips enable row level security;

create policy "recipes are readable by authenticated users"
  on public.recipes for select to authenticated using (true);
create policy "recipe ingredients are readable by authenticated users"
  on public.recipe_ingredients for select to authenticated using (true);
create policy "tips are readable by authenticated users"
  on public.tips for select to authenticated using (true);

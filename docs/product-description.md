# Meal Planner: Product Description

## 1. Vision

Meal Planner helps a household decide what to eat for the week, buy exactly what is needed, and cook with as little repeated effort as possible. A household builds a weekly plan (breakfast, lunch, dinner, snack) from a curated recipe library, the app scales quantities to the people actually eating, and produces a shared, interactive shopping list.

Design principles:

- **Least effort on workdays.** Plans reuse multi-day batches so there is little cooking on workdays.
- **Everyone is considered.** Dietary preferences and likes/dislikes of every participant shape the plan.
- **Nothing is wasted.** Quantities follow headcount and the list reflects what is already at home.
- **Details on request.** Calories and macros are available but hidden from the main flow.

## 2. What exists today

The repo is a Nuxt 4 app (Vuetify, CSS Modules) on Supabase, deployed with Coolify.

| Area | State |
|---|---|
| Auth | Supabase auth, `/login` page, `auth` route middleware, sign-out on home page. |
| Recipes | `recipes` table: ~123 seeded recipes (about 33 breakfast, 30 lunch, 32 dinner, 28 snack) with instructions, kcal, carbs, protein, fat. |
| Ingredients | `recipe_ingredients`: free-text `item`, `amount`, `unit` (null for "to taste"), ordered by position. Quantities are **per one person's portion**. |
| Batch cooking | `recipes.portion_days` (1 or 2): one cooked batch covers N days. 17 lunch/dinner recipes are marked 2 days. |
| Tips | `tips` table: short planning/storage/substitution tips with `tags`. Includes substitution tips (garnish swaps, chicken to white fish, etc.). |
| Security | RLS on: readable by signed-in users, writes only through the service role. |
| Language | Recipe and tip content is in Lithuanian. The UI is currently English. |

Everything below builds on these. The main data-model gaps are: ingredient category and canonical name, recipe dietary tags and main-protein metadata, and every user/household/plan/shopping concept.

## 3. Features

### 3.1 Accounts and profile
- Sign up, log in, log out (exists; needs sign-up, password reset, profile).
- Profile holds display name and **dietary preference** (3.7) and **recipe preferences** (3.6).

### 3.2 Households
- A user can create a household and invite others by link or email. Invitees accept to join.
- A user belongs to one household at a time (MVP). Roles: `owner` and `member`; owner manages members.
- Household members can see the household's plans and shopping lists.

### 3.3 Meal plans
- A plan covers a period (default 7 days, any start date, 1 to 14 days) with four slots per day: breakfast, lunch, dinner, snack.
- Two kinds:
  - **Household plan:** created for the household. Each plan has a **participants** list, defaulting to all members, adjustable per plan (and per week).
  - **Individual plan:** belongs to one user. Used when a member is away, has a special diet, or opts out of the household plan.
- Quantities scale to the number of participants, using per-person amounts from the recipe.
- Users can swap a meal for another of the same type, lock a meal so regeneration keeps it, and regenerate unlocked slots.
- Plan and shopping list are one unit: every plan has exactly one list.

### 3.4 Plan generation
Generation takes the period, participants, and constraints, and fills unlocked slots.

Rules, in priority order:
1. **Hard filters:** a recipe must be compatible with every participant's dietary preference, or have a protein swap that makes it so (3.7).
2. **Preferences:** exclude "hate" meals for any participant; strongly prefer "like"; "dislike less" is a weak penalty. For a household, each participant's preference counts.
3. **Batch cooking:** recipes with `portion_days = 2` fill two consecutive days. **Workdays are prioritised:** cook on day N, eat on N and N+1, so workday cooking is minimal. Weekends carry the cooking load.
4. **Variety:** avoid repeating a recipe, or the same main protein, too often in a plan, and avoid repeats from the previous plans.
5. **Meal timing:** the app's tips recommend 4 meals every 3 to 5 hours; slots follow that order.

**AI or randomised?** Recommendation: a **deterministic, rule-based planner (constraint filter + weighted random choice)** for the plan itself, with **AI used where language understanding helps**:
- Protein swaps in recipes (required by the brief, 3.7).
- Optional "polish" pass (post-MVP): explain the plan, suggest one-off improvements, handle free-text requests such as "no fish this week".

Why not make the whole plan AI-generated:
- The constraints are structured (diet, batching, preferences, headcount) and a rule-based planner satisfies them predictably and instantly; an LLM can silently violate them and needs validation anyway.
- Recipes and nutrition already exist, so the plan only selects; an LLM would risk inventing meals and wrong macros.
- Cost, latency and reproducibility: scheduled generation (3.9) runs unattended, so cheap deterministic behaviour matters.
- Pure randomness alone is not enough, because it ignores batching and preferences. Weighted random within the filters gives variety without that problem.

### 3.5 Shopping lists
- Generated from the plan: ingredients across all planned meals are scaled by participants, **merged by canonical ingredient and unit**, and exclude "to taste" items from totals (shown as optional extras).
- **Interactive:** add custom items, remove items, edit quantities, and mark "already have at home" so it drops off the to-buy list.
- **Cross out:** marking an item as bought strikes it through without deleting it; it can be unchecked.
- **Categories:** items grouped (fruit and vegetables, meat and fish, dairy and eggs, grains and bread, pantry, frozen, other).
- **Shared:** a household plan's list is visible and editable by all household members, with updates visible to the others.
- **Store tracking (optional):** when an item is bought, the user may record the shop. Stored per purchase for later insights (3.10).

### 3.6 Preferences
- On any meal, a user can mark: **enjoy**, **enjoy less**, **hate**. Unmarked is neutral.
- Preferences are per user and carry into every plan, individual or household.
- Users can review and change their preferences list.

### 3.7 Dietary preferences and AI protein swaps
- Each user selects a diet on a ladder: **vegetarian, fish, poultry, pork, beef, full** (each level includes the allowed proteins; "full" means everything).
- Recipes carry their main proteins as metadata so compatibility can be computed.
- When a recipe needs an excluded protein, the app shows a **suggested swap**: cold cuts to halloumi or other cheese, beef mince to plant-based mince, chicken to soy chunks, and similar. The existing tips (e.g. "100 g chicken = 100 g white fish") are seed guidance for this.
- Swaps are generated by AI, then **cached per recipe and diet** so each is generated once, can be reviewed, and costs nothing afterwards. Swaps adjust the ingredient list, so the shopping list reflects them.
- In a household plan with mixed diets, the base recipe is cooked once and the swap is shown for the participants who need it, with separate quantities on the list.

### 3.8 Nutrition on request
- Calories and macros (carbs, protein, fat) exist per recipe, per person's portion.
- Hidden by default. A "Show nutrition" toggle reveals values per meal, a per-day total, and the plan-period average. For household plans the viewer picks whose view to see.

### 3.9 Scheduled plan creation
- A user or household can enable automatic plan creation: choose a weekday (e.g. Saturday), the period length, and the default participants.
- On that day the app creates the plan for the next period and its shopping list, using the normal generator, and notifies members. Scheduled plans are drafts the household can adjust before the period begins.

### 3.10 Insights (later)
- Spend and frequency by shop, items usually bought at each shop, most-liked meals, how often meals are swapped. Enabled by the optional shop field and preference data.

## 4. Data model additions (outline)

`profiles`, `households`, `household_members`, `household_invites`, `meal_plans` (kind, owner/household, start/end), `meal_plan_participants`, `meal_plan_slots` (date, meal type, recipe, locked, swap), `user_recipe_preferences`, `recipe_protein_swaps` (recipe, diet, swapped ingredients), `ingredients` (canonical name, category), `shopping_lists`, `shopping_items` (quantity, unit, category, state: to-buy / have-at-home / bought, source: generated / manual), `stores`, `purchases` (item, store), `plan_schedules`. Recipes gain `diet_tags`/`main_proteins`; ingredients link to the canonical `ingredients` table.

## 5. Open questions and assumptions

- **Ingredient normalisation.** Names are free text in Lithuanian ("Fetos sūris", "Vyšniniai pomidorai"). Merging and categorising requires a canonical ingredient table. Assumed to be built with a one-off AI-assisted mapping, reviewed by hand.
- **Language.** Recipe content is Lithuanian; UI language and localisation are not decided. Assumed: keep content Lithuanian, UI English first, localisation later.
- **One household per user** in the MVP.
- **Per-person quantities and macros** assumed the same for all members (no personal calorie targets). Targets are a possible future feature.
- **Realtime sync** of the shared list is assumed available via Supabase Realtime.
- **Recipe management:** recipes remain admin-seeded; user-created recipes are out of scope for now.
- **Leftovers/pantry inventory** beyond the per-list "have at home" flag is out of scope.

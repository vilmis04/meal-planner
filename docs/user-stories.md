# User Stories

Stories are grouped by epic and ordered roughly by implementation sequence. Each is sized to be one task (S = under 1 day, M = 1 to 3 days, L = 3 to 5 days). Phase refers to [roadmap.md](roadmap.md). Product context is in [product-description.md](product-description.md).

Conventions: every screen is designed mobile-first, then enhanced for tablet and desktop to show more at once (see product description); all user-visible text uses translation keys with LT and EN values (X1), and every screen must work in light and dark themes. "member" = signed-in user in a household; "participant" = a person included in a plan. Quantities are per person's portion unless said otherwise. RLS must be enabled on every new table.

Definition of done (also in [architecture.md](architecture.md), section 8): translation keys in both languages; colors only from theme tokens (`npm run theme:check`); layout only at the defined breakpoints with the shared layout components (`npm run layout:check`, X4); every new or changed screen checked in both themes, at phone and desktop widths, in both languages, and a new screen story is accepted only once it is (no sideways scrolling at 320 px, every control at least 44 px); RLS policy for any new table; unit tests for new pure logic, and CI green (X2).

---

## Epic A: Accounts

### A1. Sign up and log in (M, Phase 1)
As a visitor I want to create an account and log in so my data is saved.
- Sign-up with email and password; login (already exists) shows errors for wrong credentials. Messages are translated (X1).
- Unauthenticated users are redirected to `/login` from every other page (middleware exists).
- After login the user lands on the home page.

### A2. Password reset (S, Phase 1)
As a user I want to reset a forgotten password.
- "Forgot password" on login sends a reset email via Supabase.
- Reset link lets me set a new password and log in.

### A3. Profile (S, Phase 1)
As a user I want a profile with a display name.
- `profiles` row is created on sign-up (trigger), 1:1 with auth user.
- I can edit display name, language and theme; others in my household see my name.
- Only I can update my profile; household members can read it.

---

## Epic B: Households

### B1. Create a household (S, Phase 1)
As a user I want to create a household so I can plan with others.
- I can create one with a name (1 to 50 characters); I become its first member and its owner (the owner role arrives with B3).
- A user can belong to only one household; creating a second is blocked with a message.

### B2. Invite members (M, Phase 1)
As a member I want to invite people to my household. Any member can invite, not only the owner.
- I can generate an invite link (single use, expires after 7 days, revocable). A household has one live link; creating a new one revokes the old one.
- Opening the link while signed in (or after sign-up/login) shows an accept screen; accepting adds me as `member`.
- Expired, revoked, or already-used links show a clear error.
- If I am already in a household, I am asked to leave it for the new one or stay; one household per user always holds. Leaving as its last member deletes the old household.

### B3. Manage members (S, Phase 1)
As an owner I want to see and remove members; as a member I want to leave.
- Member list shows names and roles.
- Owner can remove a member; a member can leave; the owner cannot leave without transferring ownership or deleting the household. A sole owner leaving deletes the household, as B2's household switch already does for a last member.
- Removed members lose access to household plans and lists immediately: their membership row is deleted, and every household policy asks `is_household_member()`. Removing someone also revokes the invite links they created, so they cannot rejoin with a link they still hold. Their open page refreshes when they navigate or return to the tab; since G6 an open shopping list also stops receiving the household's changes at once (Realtime applies row level security) and shows "not found" when it next catches up.
- Each household has exactly one owner: the creator, or for households that existed before B3 the member who joined first. The owner can hand ownership to another member.

---

## Epic C: Preferences

### C1. Dietary preference (S, Phase 2)
As a user I want to set my diet: vegetarian, fish, poultry, pork, beef, or full.
- One value per user, default `full`, editable in profile (Food preferences, `/me/preferences`). Household members can read it, so plans can show each participant's diet.
- Each level includes the proteins of the levels it implies (defined once in code, `shared/utils/diet.ts`, and documented in the README). `full` also allows `other_meat` (lamb, game, offal), so it differs from `beef`.

### C2. Recipe browse (M, Phase 2)
As a user I want to browse and open recipes so I know what is available.
- List filtered by meal type, with name, kcal summary hidden by default (see F1: shown while "Show nutrition" is on).
- Detail shows ingredients (per person), instructions, and 1-day/2-day batch indicator.
- Visible to any signed-in user.

### C3. Mark meal preference (S, Phase 2)
As a user I want to mark a recipe as enjoy / enjoy less / hate.
- Available on recipe list and detail; can be changed or cleared.
- Stored per user (`user_recipe_preferences`); other users cannot see it except aggregated in plan generation.

### C4. Review my preferences (S, Phase 2)
As a user I want a page listing my marked recipes grouped by rating, so I can change them.

---

## Epic D: Recipe metadata and protein swaps

### D1. Recipe protein metadata (M, Phase 2)
As the system I need each recipe's main protein(s) so diet compatibility can be computed.
- `recipes` gains `main_proteins`, a non-empty list from the diet ladder's proteins (`egg_dairy`, `plant`, `fish`, `poultry`, `pork`, `beef`, `other_meat`). The meat or fish is tagged; `egg_dairy` or `plant` only when there is none.
- All seeded recipes are tagged by a reviewed migration, grouped by protein with judgment calls commented.
- A function returns whether a recipe is compatible with a diet (`isRecipeCompatible()` in `shared/utils/diet.ts`): every main protein must be allowed.

### D2. Generate protein swaps with AI (L, Phase 4)
As the system I need alternative proteins for recipes that do not fit a diet.
- For each recipe and each diet it conflicts with, an AI call proposes replacements (e.g. cold cuts to halloumi, beef mince to plant-based mince, chicken to soy chunks), including adjusted amounts and units.
- Output is structured (JSON) and validated: ingredient exists in the recipe, replacement compatible with the diet.
- Results stored in `recipe_protein_swaps` and generated once per recipe and diet; the API key is server-side only.
- A batch script generates swaps for all recipes; failures are logged and retried.
- Nutrition for swapped recipes is recomputed or flagged as approximate.

### D3. Show swaps on a recipe (S, Phase 4)
As a user with a non-full diet I want to see the swapped recipe.
- Recipe detail shows the swap for my diet with changed ingredients highlighted and an option to see the original.
- Recipes with no needed swap show nothing extra.

---

## Epic E: Meal plans

### E1. Create a plan shell (M, Phase 2)
As a user I want to create an empty plan for a date range.
- Choose start date and length (1 to 14 days; default 7) and type: individual (me) or household.
- Creates four slots per day (breakfast, lunch, dinner, snack).
- Option "exclude snacks from the shopping list" (default off) and option to skip snack slots entirely; both can be changed later.
- Household plans require membership; individual plans are visible to me only.
- Built as `meal_plans` + `meal_plan_slots`, created only through `create_meal_plan()` (see README, "Meal plans"). Skipped snack slots are kept and hidden; the start date defaults to next Monday.

### E2. Choose participants (S, Phase 2)
As a household member I want to pick who participates in a plan.
- Defaults to all current members; I can untick people for this plan.
- At least one participant is required.
- Changing participants on an existing plan updates the scaling (and shopping list, Epic G).
- Built as `meal_plan_participants`, written only through `create_meal_plan()` and `set_meal_plan_participants()` (see README, "Meal plans"). Individual plans have their owner as the only participant; a member who leaves the household is taken off its plans.

### E3. Manual slot editing (M, Phase 2)
As a user I want to pick a recipe for a slot myself.
- Slot picker offers recipes of the matching meal type, with search.
- Recipes marked "hate" by any participant show a warning.
- A 2-day recipe placed in a slot offers to fill the next day's matching slot.
- Built as `set_meal_plan_slot()` (one slot, or the slot and the next day in one save) and `meal_plan_hated_recipes()` (participants' `hate` ratings only, named in the warning), see README, "Meal plans". The picker can also clear a slot. Filters beyond meal type and search (enjoyed, fits all diets, not recent) come with E6.

### E4. Generate plan (L, Phase 3)
As a user I want a plan filled automatically.
- Generation fills all unlocked slots following the rules in the product description: diet compatibility, preferences of all participants, batching (2-day recipes fill two consecutive days), variety.
- **Workday priority:** on Monday to Friday, lunch and dinner are filled with batch recipes first, so cooking falls on the preceding day or weekend and workdays need minimal prep. Which days are workdays is a setting (default Mon to Fri).
- Deterministic given a seed; no recipe appears more often than N times per plan unless no alternatives exist.
- **Cooldown:** a recipe planned in recent plans is excluded or down-weighted for a configurable number of days (default 14), including liked recipes, so favourites do not fill every week. Cooldown is read from plan history; if too few recipes remain, it relaxes gradually, starting with the least-recently used.
- Liked recipes are weighted higher but are never guaranteed; the weighting is covered by unit tests with fixed seeds.
- If constraints cannot be met, the plan is generated best-effort and shows why a slot is empty or compromised.
- No external AI is called.
- Built as the pure `generateMealPlan()` (`shared/utils/planGenerator.ts`, fixed-seed unit tests), run by `POST /api/plans/:id/generate` and written with `apply_meal_plan_generation()` (see README, "Plan generation"). Workdays (default Mon–Fri) and the cooldown (default 14 days, 0 to 28 offered) are chosen per plan on the New plan screen. E4 filled empty slots only; E5 added per-slot locks and regenerating unlocked slots. Diet and hate are never relaxed; the cooldown relaxes before a recipe repeats within a plan, and a batch relaxes the cooldown before giving up its batch. Each relaxed or empty slot shows why. Batches never span two plans.

### E5. Lock, swap, regenerate (M, Phase 3)
As a user I want to adjust a generated plan.
- Lock a slot; "regenerate" only replaces unlocked slots.
- "Swap" replaces one slot with another suggestion that obeys the same rules.
- Built as `meal_plan_slots.is_locked` with `set_meal_plan_slots_locked()`, the `regenerate_unlocked` mode of `POST /api/plans/:id/generate` and `POST /api/plans/:id/slots/:slotId/swap`, which runs `generateMealPlan()` on that slot alone without its current recipe (see README, "Lock, swap, regenerate"). A recipe chosen by hand is locked; a generated one is not. The days of a batch lock and swap together. Swap lives in the slot picker ("Suggest another"); a locked slot is unlocked before it can be swapped. The picker filters (enjoyed, fits all diets, not recent) and the "Cook tonight" label move to E6.

### E6. Plan overview and history (M, Phase 2)
As a user I want to view current, upcoming, and past plans.
- Week view shows days by meal slot with batch spans visibly connected.
- Household plans are visible to all members; individual plans only to their owner.
- Built as `/plans` with Current, Upcoming and Past sections (past plans ten at a time, by the generated `meal_plans.end_date`), a week strip and day list on phones and a day-by-meal grid from 960 px where batch days are joined and tinted, "Cook tonight" on days a batch starts, and slot picker filters (2-day batch, enjoyed, fits all diets, not recent); see README, "Plan overview and history". Visibility is E1's row level security, covered by `supabase/tests/meal_plan_history.test.sql`. Past plans are read-only in the app. "Enjoyed" uses the viewer's own ratings only, as ratings are private; "not recent" reads only plans the viewer can see.

### E7. Individual plan alongside household plan (S, Phase 3)
As a member I want my own plan for a week I do not join the household plan.
- Participant editing in E2 can remove me; I can then create an individual plan for the same dates.
- Both plans exist side by side and each has its own shopping list.
- Built as plain plans for the same days: `create_meal_plan()` never refused overlaps, so there is no migration (`supabase/tests/meal_plan_alongside.test.sql`). A household plan the viewer does not eat from offers "Create my own plan", which opens New plan with its days (from today for a running plan); their own plan points back to the household plan, as a warning if they still eat from it; the list says "without you" and the home card prefers a plan the viewer eats from (`getPlanAlongside()`, `getFeaturedPlan()` in `shared/utils/planAlongside.ts`, see README, "Plans side by side"). Shopping lists do not exist yet: each plan keeps its own participants and servings, so G2 builds one list per plan.

---

## Epic F: Nutrition

### F1. Nutrition on request (M, Phase 3)
As a user I want to see calories and macros only when I ask.
- Default plan and recipe views show no nutrition.
- A "Show nutrition" toggle reveals per-meal kcal, carbs, protein, fat; the setting is remembered per user.
- Per-day totals and the plan average (per participant) appear in the revealed view.
- Recipes missing macros are excluded from totals, with a note.
- Built as `profiles.show_nutrition` (off by default, saved through `useNutritionVisibility()`) and the pure `getPlanNutrition()` in `shared/utils/nutrition.ts` (see README, "Nutrition"). Macros are read only once the user asks for them. "Show nutrition" sits on the plan page (an icon on phones) and on recipe detail; the plan page shows "Showing for" one participant at a time, because a participant whose diet needs a protein swap gets the swap's estimate (or the recipe's own macros as an approximation when the swap has none). The day list and week grid show each meal's kcal and macros and a total per planned day; the daily average is over the days that have a total. A recipe counts towards totals only with all four values; three seeded recipes lack one and are shown with a dash and counted in the note. The recipe list shows kcal while the setting is on.

---

## Epic G: Shopping lists

### G1. Ingredient canonicalisation (L, Phase 2)
As the system I need canonical ingredient names and categories to merge and group items.
- `ingredients` table with canonical name and category (fruit and vegetables, meat and fish, dairy and eggs, grains and bread, pantry, frozen, other).
- Every `recipe_ingredients.item` is mapped to an ingredient via a reviewed migration; unmapped items are listed in a report.
- Unit conversion rules are defined (g/kg, ml/l, "vnt." counted separately).
- Built as `ingredients` (canonical name, category, `on_shopping_list`) and `ingredient_aliases` (an item spelled exactly as a recipe writes it, mapped to its ingredient) in `supabase/migrations/20261113000000_create_ingredients.sql` (see README, "Ingredients"). The migration maps all 240 distinct seeded items to 155 ingredients by documented rules (variants of one product merge; lactose free, light, whole grain and similar stay apart; a choice takes its first option; a "to taste" list takes a generic ingredient), with judgment calls commented. `unmapped_ingredient_items` lists recipe and ready protein swap items without an alias; the report is `docs/ingredient-mapping-report.md` (`npm run ingredients:report`), currently with none unmapped, and a pgTAP test keeps the seeds fully mapped. Unit rules are `toBaseQuantity()` and `toDisplayQuantity()` in `shared/utils/ingredientUnit.ts`: kg to g and l to ml; pieces and every other unit are counted on their own. Names are Lithuanian until X1b (now translated in `ingredient_translations`); categories are not shown anywhere yet (G3).

### G2. Generate shopping list from plan (L, Phase 2)
As a user I want a list created from my plan.
- One list per plan; created with the plan and refreshed when slots or participants change.
- If the plan excludes snacks from the list, snack ingredients are left out of the list and reappear if the option is switched off.
- Amounts = per-person amount x participants, summed per canonical ingredient and unit; 2-day batch recipes are cooked once but scaled for both days.
- "To taste" items appear in an "extras" group without amounts.
- Manual edits (G4, G5) are preserved on refresh.
- Built as `shopping_lists` (one per plan, made by a trigger with the plan) and `shopping_items` in `supabase/migrations/20261114000000_create_shopping_lists.sql`, the pure `buildShoppingList()` in `shared/utils/shoppingList.ts`, `POST /api/plans/:id/shopping-list` and `/plans/:id/list` (see README, "Shopping lists"). Triggers mark a list out of date when slots, participants, snack options, a participant's diet or a protein swap change; opening the list rebuilds it then. A 2-day recipe's amounts cover both days, so each slot takes 1/portion_days of it (a batch counts once; one day of it counts half). Each participant's share uses their ready protein swap, listed separately as "Swap for …"; without one it follows the original recipe and the list says so. Items without an alias stay under their own spelling in "other". People's columns (state, removed, amount override) are never written by a rebuild, and changed lines the plan no longer needs are kept out of the plan instead of deleted; G4/G5 add the UI and grants. The page groups by category already, without collapsing or counts (G3); the navigation's "List" opens the featured plan's list.

### G3. Categorised list view (S, Phase 2)
As a user I want items grouped by category, in a sensible order.
- Collapsible groups with item counts; empty groups hidden.
- Built as `ShoppingItemGroup.vue` (header button with `aria-expanded`, count and chevron, as in the shopping list design) on `/plans/:id/list`, with groups and counts from `getShoppingListView()` (see README, "Shopping lists"). Order: the categories as `INGREDIENT_CATEGORIES` lists them (a walk through a typical shop: fruit and vegetables, meat and fish, dairy and eggs, grains and bread, pantry, frozen, other), then the extras. Every group starts open; what the viewer opens or closes is remembered per list in this browser only (`localStorage`, newest ten lists). The count is every line shown in the group for now; G4 and G5 narrow it to what is still to buy ("3 of 7").

### G4. Add, edit, remove items (M, Phase 2)
As a user I want to adjust the list to what I need.
- Add a custom item (name, optional amount/unit, category); edit amount; remove an item.
- Mark an item "have at home" to move it to a collapsed group and exclude it from the to-buy count; undo available.
- Edits survive list refreshes.
- Built as security definer functions in `supabase/migrations/20261115000000_add_shopping_item_edits.sql` (add, amount, state, remove, restore; one line and its own fields per call, access through `can_access_shopping_list()`), `useShoppingItemEdits()` (changes show at once and go back field by field when refused) and the list page's line actions, add dialog and "Have at home" group (see README, "Shopping lists"). Manual lines take a name (1–120 characters), a category and an optional amount in g, kg, ml, l, pcs or pack, stored in base units. A changed amount of a generated line is an override that stays when the plan changes, shown next to the plan's amount and clearable. Removing a generated line only marks it removed (undo restores it, and a rebuild keeps it removed); removing a manual line deletes it (undo adds it again with the same id). "Have at home" is the last group, closed by default and left out of the to-buy count; moving a line home and removing one offer "Undo".

### G5. Cross out bought items (S, Phase 2)
As a shopper I want to strike items through as I buy them without deleting.
- Tap toggles bought state with strike-through; bought items remain visible (optionally sorted to the bottom) and can be un-bought.
- Progress indicator (e.g. 12 of 30 bought).
- Built on G4's `set_shopping_item_state()` (no migration) with the list page's tick box lines, "Bought last" chip and progress header (see README, "Shopping lists"). Each line to buy is a checkbox button the width of the row; a bought line is struck through and muted, stays in its group and goes to the bottom while "Bought last" is on (default; remembered in this browser). The header reads "12 of 31 bought" with a bar, and each group "3 of 7": progress counts every shown line not at home, extras and manual lines included. Lines at home have no tick box; a bought line can be moved home. Bought stays bought through rebuilds, also when the plan's amount changes. One line's calls are sent in order, so quick taps cannot arrive reversed.

### G6. Household shared list with live updates (M, Phase 3)
As a household member I want to see the same list as others.
- All members of the household can view and edit a household plan's list; others cannot.
- Changes by one member appear for others without reload (Supabase Realtime).
- Concurrent edits to different items do not overwrite each other.
- Built on G2's read policies and G4's one-line functions, with `shopping_lists` and `shopping_items` added to the `supabase_realtime` publication (`supabase/migrations/20261116000000_add_shopping_list_realtime.sql`) and `useShoppingListLive()` on `/plans/:id/list` (see README, "Shopping lists"). Members' ticks, amounts, removals and added lines show on every open copy within a moment; a plan change by anyone rebuilds open lists; outsiders get nothing (Realtime applies row level security), and a member who leaves stops getting changes at once. A change this viewer has on the way is never overwritten by what arrives meanwhile. The page catches up when it (re)subscribes and when the tab comes back, and shows "Live" / "Reconnecting…" beside the title. `supabase/tests/shopping_list_live.test.sql` covers access and concurrent edits. Who else is looking at the list ("Monika is shopping", the avatar in the design) is deferred.

### G7. Record the shop (S, Phase 3)
As a shopper I want to say where I bought an item.
- When marking an item bought I can optionally pick or type a shop; it is saved in `purchases`.
- Skipping it is allowed, and a default shop can be remembered for the session.
- Shops are shared within the household.
- Built as `supabase/migrations/20261117000000_create_shops_and_purchases.sql` (`shops`, `purchases`, `set_shopping_item_state()` with an optional shop, `set_shopping_item_shop()`), the list page's "Shopping at Lidl" chip, `ShoppingShopDialog.vue` and the "Add shop" prompt after a tick (see README, "Shopping lists"). Each bought line has a purchase written in the same call as the tick (its shop optional) and deleted when it is unticked. With a shop chosen for the session (`sessionStorage`, this tab only) ticks record it without asking; without one, a short "Onion bought · Add shop" message offers to add one and can be ignored. Shops are found by name whatever the case or spacing, shared by the household's members (a person without a household has their own), and shown on bought lines as "Bought at Lidl" for everyone, live. A bought line whose amount went up says "Needs 200 g more". Renaming or deleting shops is not built; "usually bought at" hints are I1a.

---

## Epic H: Automation

### H1. Schedule settings (S, Phase 4)
As a user or household owner I want to set up automatic plan creation.
- Choose weekday, period length, participants (default all), and whether to enable it.
- Individual users have their own schedule; households have one.
- Built as `supabase/migrations/20261118000000_create_plan_schedules.sql` (`plan_schedules`, `plan_schedule_participants`, `save_plan_schedule()`) and the "Automatic plans" screen at `/plans/schedule`, linked from Plans and Household (see README, "Automatic plans"). Besides the weekday to create on (Saturday by default) the screen asks the weekday the plan starts on ("Following Monday" by default) and whether snacks go on the shopping list, as the design shows. Only the household's owner changes the household schedule; members see it. Ticking everyone means everyone, including people who join later. The schedule keeps the time zone of whoever saved it last, for H2.

### H2. Scheduled plan job (L, Phase 4)
As a user I want the next plan created for me on my chosen day.
- A scheduled job (Supabase cron or Coolify scheduled task) creates the plan for the next period on the chosen weekday using the generator (E4) and shopping list (G2).
- Idempotent: running twice does not create duplicates.
- Plans are created as editable drafts; failures are logged.
- Built as `POST /api/cron/create-plans` (`server/utils/scheduledPlanService.ts`), called by a Coolify scheduled task with `NUXT_CRON_SECRET`, and `supabase/migrations/20261119000000_add_scheduled_meal_plans.sql` (`meal_plans.schedule_id` unique with `start_date`, `create_scheduled_meal_plan()`, and service-role `write_meal_plan_generation()` / `write_shopping_list_generation()`); see README, "Scheduled plans". A schedule is due when today on its own time zone is its run day; the plan is generated and its list built with E4's and G2's own code, and shows "Created automatically" in the plan list and on the plan page. A plan an earlier run made is never made or generated again; missed days are not caught up. Each failure is a JSON log line and makes the call answer 500, without stopping the other schedules. The notification is H3.

### H3. Notification (M, Phase 4)
As a member I want to know a plan was created.
- Members get an in-app notice (email optional, later) linking to the new plan.
- Built as `supabase/migrations/20261120000000_create_notifications.sql` (`notifications`, `create_plan_created_notifications()` for the job, `mark_plan_notifications_read()`) and the home screen's "Your next draft is ready … Review draft" notice (`PlanDraftNotice`); see README, "Scheduled plans". The job tells every current household member (or the individual plan's owner) once per plan, after the plan is generated and listed, and also when a later step failed; opening the plan marks it read. The "Automatic plans" screen now says everyone gets a notice. No bell, no Realtime and no email.

---

## Epic I: Insights (Phase 5)

### I1. Shop insights (M, Phase 5)
As a user I want to see where I buy things.
- Items bought per shop over a selectable range, most common items per shop.
- Only recorded purchases are included.
- Built as `supabase/migrations/20261121000000_add_shop_insights.sql` (`get_shop_insights(range_days)`, security invoker) and the "Where you shop" screen at `/me/shops`, linked from Me (see README, "Shop insights"). The range is 30 days, 3 months (the default), 12 months or all time, kept in the address (`?range=`). Each shop, most used first, shows its share of the lines bought at a shop, how many lines and different items were bought there, and its five most bought items. Row level security decides what is summed up, as on the list: the household's plans and the viewer's own individual plans, never another member's individual plan. A line ticked bought without a shop is left out and only counted ("2 bought items have no shop recorded"). Items are their canonical ingredient, else their name whatever the case; shops with the same name (a person's own from before they joined, and the household's) are one. There is no design for this screen, so it follows the app's card and chip patterns. Per-item shop hints on the list are I1a (below).

### I1a. Store recommendations on the list (M, Phase 5)
As a shopper I want hints on where I usually buy an item.
- Items show "last bought at <shop>" or "usually bought at <shop>" when there is enough purchase history (e.g. at least 3 purchases).
- The list can be grouped or filtered by recommended shop.
- Hints can be hidden, and never block marking items bought.
- Built as `supabase/migrations/20261122000000_add_shopping_list_shop_hints.sql` (`get_shopping_list_shop_hints(target_list_id)`, security invoker) and the list page's hints and chips (see README, "Store recommendations"). A line to buy reads "Usually bought at Lidl" when one shop has more than half of the item's ten most recent purchases with a shop, else "Last bought at Lidl" (the most recent one's shop), once there are at least three; items and shops are matched as in I1, and row level security decides what counts (the household's plans and the viewer's own individual plans). The history is the purchases on the viewer's other lists, as they are: a purchase exists while its line is ticked bought, so no purchase log was added, and the list being shopped is left out so ticks do not change its hints. "By shop" groups the list by recommended shop (the shop in "Shopping at" first, then "No shop hint" and "Have at home"); "Shop hints" hides the hints (and the grouping); both are remembered in this browser. Hints are read after the list, in the browser, and a line is ticked the same with or without one. The design's note reads "Usually Lidl"; the text follows this story's "Usually bought at" / "Last bought at" to sit with "Bought at Lidl".

### I1b. Online shop integration research (S, Phase 5, spike)
As the team we want to know if linking to online grocery platforms is feasible.
- Output is a short note on available APIs/export options per target shop, effort, and constraints. No implementation.

### I2. Preference insights (S, Phase 5)
As a user I want to see my most-liked and most-skipped meals.
- Built as `supabase/migrations/20261123000000_add_preference_insights.sql` (`meal_plan_skips`, skips recorded by `set_meal_plan_slot()` and the new `apply_meal_plan_swap()`, and `get_preference_insights(range_days)`, security invoker) and the "Liked and skipped meals" screen at `/me/meals`, linked from Me (see README, "Preference insights"). Nothing recorded a skip before, so a skip is now recorded whenever a person takes a recipe out of a slot: swapping it ("Suggest another"), or replacing or clearing it in the picker; generating or regenerating a plan is not a skip, and only skips made after the deploy count. "Most liked" is the viewer's own Enjoy ratings (ratings stay private), most often on the plans they eat from in the range first (upcoming meals count; hidden snack slots do not), then the most recently rated; "Most skipped" is the recipes skipped most often on the plans they eat from, by anyone, then the most recently skipped. Each list shows five, with a link to all enjoyed recipes on Food preferences and the number of skips in the range; each row has the rating menu, so a skipped meal can be rated Hate right there (a liked meal rated otherwise leaves the list at once). The range picker (30 days, 3 months by default, 12 months, all time, in `?range=`) is I1's, now shared (`INSIGHT_RANGES`). There is no design for this screen, so it follows the shop insights page and the ratings list.

### I3. Optional AI plan polish (M, Phase 5)
As a user I want to adjust a plan by text ("no fish this week, quick dinners Monday").
- Free text is interpreted by AI into structured constraints, shown for confirmation, then applied by the rule-based generator.
- The AI never edits slots or nutrition directly.
- Built as "Adjust with text" on the plan page (`PlanAdjustDialog.vue`), `POST /api/plans/:id/adjustment` (interpretation, `server/utils/planAdjustmentService.ts`) and the `constraints` of `POST /api/plans/:id/generate`, with `supabase/migrations/20261124000000_add_plan_adjustments.sql` (the `no_recipe_fits_adjustment` slot note and the `plan_adjustment_interpretations` cache, service role only); see README, "Plan adjustments". The constraints are a strict schema (`shared/utils/planAdjustment.schema.ts`): excluded proteins, excluded canonical ingredients and quick lunches or dinners, each for chosen days and meal types or the whole plan; everything else in the request is listed as "Not applied" rather than guessed. Recipes have no cooking time, so "quick" means the workday rule: eaten from a batch cooked the day before, where one is left. The AI sees only the plan's dates and meal types, the ingredient names and the text (as data), its answer is validated against the plan and asked again with its errors, and it is cached by prompt hash so the same request on the same days costs one call; at most 20 new interpretations per user an hour, 300 characters each. The user sees each rule, can take any out, and applying regenerates the unlocked meals with the generator (locked ones stay; diet and hate still come first; an exclusion never relaxes and leaves a slot empty with a note instead); it is written as a generation, so nothing counts as skipped (I2). The constraints are not kept on the plan, so a later regenerate or swap ignores them. Without an AI key the button is not shown and nothing else changes. There is no design for it, so the dialog follows the app's dialog and card patterns.

---

## Cross-cutting

### X1. i18n foundation (M, Phase 1)
As a developer I want all UI text behind translation keys so no string is hard-coded.
- i18n module is set up with LT and EN locale files; default is browser language, fallback EN.
- Existing pages (login, home, layout) are migrated to keys.
- A lint rule or CI check flags missing keys between locales and literal text in templates.
- Plurals, dates and numbers use locale formatting.
- Built as `i18n/i18n.config.ts` (English fallback, the Lithuanian plural rule `i18n/pluralRules.ts`, Vuetify's own texts), `<html lang>` from the active language, `shared/utils/localeFormat.ts` for every number, date and list (ESLint refuses `Intl` formatters elsewhere), `vue/no-bare-strings-in-template` with Vuetify's text props, and `npm run i18n:check` (`scripts/check-locales.ts`, also run by `npm run lint`): missing or empty keys, messages that do not compile, differing placeholders, plural forms per language and keys named in the code (see README, "Translations"). Browser-language detection with the English fallback was already in place and is kept. Lithuanian plurals were written in the English two-form style, so 21 read like 2; they now take `one | few | other`, or a single form where the text does not change. The last literal text (quotation marks in "Adjust with text") became a key. The CI workflow is X2.

### X1a. Language switcher (S, Phase 1)
As a user I want to switch between LT and EN.
- Switcher is visible on every page, including login; the change applies immediately without reload.
- Choice persists (cookie; saved to profile once signed in, see A3) and is used on the next visit.
- Built as `AppLanguageSwitcher.vue` in the app bar of both layouts (the auth one covers login, sign-up and password reset): an "EN"/"LT" pill, with the translate icon on the login hero as in the mock-up, opening a menu of the language names. It switches through `useProfileSettings().changeLanguage()` (X1's `setLocale`, the `locale` cookie, saved to the profile when signed in), with no reload. Precedence is the latest explicit choice: the profile's language wins when it loads and updates the cookie, except that a language picked while signed out (session cookie `locale-unsaved`) is kept at the next sign-in and saved to the profile (`resolveProfileLocale()`, see README, "Translations"). The app bar title now takes the free space itself, so the extra button does not cut it short on phones. The mock-up shows only the closed pill, so the menu follows Vuetify's list menu.

### X1b. Translatable recipe content (L, Phase 2)
As a user I want recipes and tips in my language.
- Translation tables for recipes (name, instructions), ingredients and tips exist; current Lithuanian content is migrated to LT rows.
- EN translations are added for all seeded recipes, ingredients and tips via a reviewed migration; a report lists missing translations.
- Recipe list, detail, plans and shopping lists show the active language, falling back to LT if a translation is missing.
- Shopping categories and canonical ingredient names (G1) are translated in both languages.
- Built as `recipe_translations`, `recipe_ingredient_translations`, `ingredient_translations` and `tip_translations` (one row per item and language) in `supabase/migrations/20261125000000_create_content_translations.sql`, with the Lithuanian content copied to `lt` rows and kept in step with the source columns by triggers, and every seeded recipe, recipe line, ingredient and tip translated to English in `20261125000100_add_english_content.sql` (reviewed, British English, matched by Lithuanian text so a changed source aborts it); see README, "Recipe content translations". `missing_content_translations` and `npm run translations:report` (`docs/missing-translations-report.md`, currently none) list what is missing, and a pgTAP test keeps the seeds fully translated. The recipe list, detail, plans (through the recipe list), shopping lists, shop and preference insights and plan adjustment rules read every language at once and show the active one with a Lithuanian fallback (`pickTranslation()`), so a switch (X1a) changes them at once. Units are UI messages with plural forms (`app/utils/unitLabel.ts`; one lime line carries its own English unit, "wedge"). Shopping categories were already UI messages. AI swaps stay Lithuanian (X1c).

### X1c. Translated AI swaps (S, Phase 4)
As a user I want protein swaps in my language.
- Swaps (D2) are stored for both languages (generated once, translated, cached); no AI call at view time.
- Built as `recipe_protein_swap_translations` (a swap's note per language; a row means "translated") and `recipe_protein_swap_item_translations` (each replacement's item per language) in `supabase/migrations/20261126000000_add_protein_swap_translations.sql`, with the Lithuanian rows mirroring the swap by triggers (as X1b) and `save_recipe_protein_swap_translation()`, which stores a translation only of the swap's current text; a swap saved again loses its old translations (see README, "Protein swaps"). Generation moved off the request path: `GET /api/recipes/:id/swaps/:diet` only reads (`createProteinSwapReader()`, no AI client), and a pair not generated yet answers `404 {status: "missing"}`, which recipe detail shows at once as "isn't ready yet", with the original recipe (the per-user limit and the "pending" polling went with it). `npm run swaps:generate` generates missing Lithuanian swaps as before and then translates every ready swap without English once (`shared/utils/proteinSwapTranslation.ts`: the recipe's own English lines as context, every item exactly once, no excluded protein named, a note exactly when the swap has one, retried with its errors); that is also how swaps stored before X1c get their English, and it exits 1 while a pair lacks a swap or a translation. The route returns every language at once and the swap card, the swapped ingredient lines and the original names follow the language (`localizeSwap()`, Lithuanian fallback) without asking again; shopping list lines from a replacement without a canonical ingredient are named from the stored translations (`useSwapItemNames()`). Prompts stay Lithuanian. There is no design for this; the D3 card is unchanged but for its loading text.

### X1d. Theme polish (S, Phase 1)
As a user I want light/dark mode to be reliable.
- The existing toggle works on every page, including login, and persists across reloads without a flash of the wrong theme.
- Default follows the OS preference until the user chooses; the choice is saved to the profile when signed in.
- All new components use theme tokens; acceptance checked in both themes for each new screen (add to the definition of done).
- Built as the theme rules of X1a's language: the toggle (`AppThemeToggle.vue`) was already in both layouts' app bars and is now also on the error page (`app/error.vue`, new, with the auth layout and the language switcher; Nuxt's own error page had neither), and a theme picked while signed out (session cookie `theme-unsaved`) is kept at the next sign-in and saved to the profile, where before the profile's theme replaced it. The rule and the mark are now shared by both settings (`resolveProfileChoice()` in `app/utils/profileChoice.ts`, `useUnsavedProfileChoice()`, replacing `resolveProfileLocale()` and `useUnsavedLocaleChoice()`). The default stays `system`; the server already rendered the cookie's theme, and now renders "system" from the `Sec-CH-Prefers-Color-Scheme` client hint (asked for with `Accept-CH` and `Critical-CH`) or the last OS theme the browser reported, and an inline head script (`app/utils/systemTheme.ts`) reloads once, hidden, when that is not the OS theme (a browser without the hint on its first visit, or after the OS setting changed), so no frame paints in the wrong theme (checked with Playwright's `colorScheme` and reloads); see README, "Styling conventions". The audit found two hard-coded colors (the white tints on the login hero), now `--v-theme-on-hero`; `npm run theme:check` (in `npm run lint`) refuses new ones, and the definition of done above now names both themes, phone and desktop widths and both languages. There is no design beyond the existing toggle.

### X2. Tests and CI (M, Phase 1)
Unit tests for the generator, scaling and merging logic; CI runs lint, type check, and tests on pull requests.
- Built as `.github/workflows/ci.yml` (GitHub Actions, on every pull request whatever its base, since stories are stacked, and on pushes to `main`; a new push cancels the older run): one job runs `npm ci`, `npm run lint` (ESLint, `i18n:check`, `theme:check`), `npm run typecheck` (`nuxi typecheck`; `typescript` and `vue-tsc` are now dev dependencies, and `tsconfig.scripts.json` adds `scripts/` and the Vitest config, which no Nuxt project covered), `npm run test:coverage` and `npm run build`; another runs the pgTAP tests on PostgreSQL 16 with every migration applied to a fresh database (`npm run test:db`, `scripts/test-db.sh` with the Supabase stub `supabase/ci/supabase-stub.sql`). The existing tests already covered the generator, scaling and merging well; the gaps filled are a locked batch counted once, a history listing a recipe twice, slots past the plan's days, an all-locked plan, a longer batch recipe in a 2-day span, a hated recipe never relaxed even when the only other one repeats, a plan without participants, negative and rounding-edge weights, and on the shopping list a recipe no longer in the library, unit and spelling merging of unmapped items, 3-day recipes, the 0.01 floor, swaps merging into the same ingredient's line, to-taste replacements and the missing-swap count. Coverage (`@vitest/coverage-v8`) has a floor for `shared/` only (95 % statements, functions and lines, 90 % branches). Node is 22 everywhere (`.node-version`, `engines`, `Dockerfile`), as Nuxt 4 and Vitest 5 require; it was 20. See README, "Testing and CI".

### X4. Mobile-first responsive layout (M, Phase 1)
As a user I want the app to work well on my phone and use space well on larger screens.
- Layout is designed for phone widths first (single column, touch targets of at least 44 px, bottom or thumb-reachable primary actions).
- At tablet and desktop widths, screens use the space: e.g. plan and shopping list side by side, wider week grid, recipe detail beside the slot picker, inline details instead of dialogs.
- Defined breakpoints and shared layout components are used by all pages; no horizontal scrolling at 320 px; both themes and both languages are checked at all breakpoints.
- Each new screen story is accepted only if checked at phone and desktop widths.
- Built as the breakpoints in `shared/utils/layoutBreakpoints.ts` (Vuetify's display thresholds: 600, 960, 1280, 1920 px, also given to Vuetify) with `npm run layout:check` (in `npm run lint`) refusing any other media query width, and the shared layout components in `app/components/layout/` (`LayoutPage` with narrow, medium, wide and full widths, `LayoutSplit`, `LayoutActionBar`, `LayoutBackButton`) and `useBreakpointUp()`, now used by every page of the app's layout; see README, "Responsive layout". From 960 px the top bar goes and the navigation is the desktop design's full-height rail, with the app's mark on top and language, theme and profile at its foot. The plan's week grid now takes the full width (up to 1680 px) and from 1280 px the plan's shopping list sits beside it (`ShoppingListPanel`, which the list page also uses); the slot picker from 960 px is a wide dialog with the selected recipe in full beside the list (`PlanSlotRecipePreview`), where a tap selects and "Use for Wed" chooses; "Add item" is a form in place from 960 px instead of a dialog; Home and the insight pages put their cards side by side. Primary actions on phones float above the navigation ("Regenerate unlocked", "Add item") or stick to the bottom of the form (New plan). The 44 px targets earlier stories wrote as numbers are now `--touch-target`, and the controls that were smaller (the week grid's lock buttons, the language pill, the slot picker's filter chips and buttons) are 44 px. Every page was checked at 320, 390, 768, 1024 and 1280 px in both themes and both languages: no sideways scrolling and no control under 44 px. The rail keeps the app's five destinations (Home, Plan, List, Recipes, Me) rather than the design's six (Prefs and Household are reached from Me), and the picker has no separate "Lock in slot", as a recipe chosen by hand is locked already.

### X3. Tips surfaced in context (S, Phase 3)
Show relevant `tips` (matched by tag) on plan and recipe screens, e.g. storage tips on a shopping list item.
- Built as tag matching added by `supabase/migrations/20261127000000_add_tip_matching.sql`: canonical ingredients got `tip_tags` (31 reviewed, one tag set per seeded tip's subject), a tip matches an ingredient when they share a tag, and the five planning tips got the context tag `plan` (`family` ones only for plans with several people); the rules are `shared/utils/tips.ts`. A shopping list line with tips has a lightbulb button that opens them under the line (on the list page and in the pane beside the plan); recipes (their page and the slot picker's preview) end with a foldable "Tips (n)" section, each tip naming the ingredient it is about; the plan page shows one planning tip at a time above the week, with "Next tip" and a hide button that leaves a small "Show tips" button. Folding is remembered in the browser. Tips are read once per visit after the page is up, in both languages, and picked with `pickTranslation()`, so switching language needs no new read. There is no design for tips; they use the secondary (amber) tint as an aside. See README, "Tips in context".

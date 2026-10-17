# Roadmap

Technical design, hosting on Coolify and the per-phase engineering work are in [architecture.md](architecture.md). Phases are ordered so each ends in something usable. Story IDs refer to [user-stories.md](user-stories.md); features are described in [product-description.md](product-description.md).

## Phase 1: Accounts and households
Goal: people can sign up, form a household, and share a space.
- A1 sign-up and login, A2 password reset, A3 profile
- B1 create household, B2 invite, B3 manage members
- X1 i18n foundation (LT/EN), X1a language switcher, X1d theme polish (toggle already exists)
- X4 mobile-first responsive layout
- X2 tests and CI

Done when: two people can sign up and see each other in one household.

## Phase 2: Manual planning and shopping lists
Goal: a household can build a week by hand and shop from a shared list. Useful on its own, with no automation yet.
- C1 dietary preference, C2 recipe browse, C3 and C4 meal preferences
- D1 recipe protein metadata
- E1 to E3 plan shell, participants, manual slots; E6 overview
- X1b translatable recipe content (LT/EN), done together with G1 so canonical ingredients are bilingual
- G1 ingredient canonicalisation, G2 list generation, G3 to G5 categories, edits, crossing out

Done when: a household can fill a week, get a merged, categorised list scaled to participants, and cross items off.
Risk: G1 (cleaning ~123 recipes of free-text Lithuanian ingredients) is the largest unknown. Start it early.

## Phase 3: Smart planning
Goal: the app builds the plan.
- E4 generator (rule-based, workday batch priority, preferences), E5 lock/swap/regenerate, E7 individual plan alongside household
- F1 nutrition on request
- G6 live shared list, G7 record shop
- X3 tips in context

Done when: pressing "generate" gives a valid week respecting diets, preferences, and batching, and the list updates for every household member in real time.

## Phase 4: AI swaps and scheduling
Goal: mixed diets work well and planning happens automatically.
- D2 AI protein swaps (batch-generated and cached), D3 show swaps, X1c translated swaps
- H1 to H3 scheduled creation and notification

Done when: a vegetarian and a full-diet member can share a plan with swap-adjusted quantities, and the next week's plan appears on the chosen day.

## Phase 5: Insights and polish
- I1 shop insights, I1a store recommendations on the list, I1b online shop integration spike (integration itself is post-MVP), I2 preference insights, I3 optional AI plan polish
- Backlog candidates: personal calorie targets, multiple households, user-created recipes, pantry inventory, export/print of lists, native-feeling mobile (PWA) experience.

## Sequencing notes
- Mobile-first layout (X4) is also set up in Phase 1 and is part of every later story's acceptance (phone and desktop widths).
- Cooldown (E4) needs plan history, so plans must store their slots and dates from E1 on.
- i18n (X1) comes first on purpose: retrofitting translation keys later touches every screen. From Phase 1 on, no new UI text is merged without keys in both languages, and every new screen is checked in both themes.
- Recipe translations (X1b) share a migration pass with ingredient canonicalisation (G1); do them together.
- E4 depends on C1, C3, D1 (inputs) and is the main logic investment; keep it a pure, well-tested module.
- G2 depends on G1; do not start list generation until ingredient mapping exists.
- Swap work (D2) is deliberately after the generator: the generator first treats incompatible recipes as excluded, then uses cached swaps to widen the candidate pool.
- AI is used only in D2 and I3. The core product works with no AI dependency.

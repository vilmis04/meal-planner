-- Plan adjustments (I3): a free-text request ("no fish this week, quick dinners Monday") is interpreted by the AI on the
-- server into a few constraints, shown for confirmation, then applied by the rule-based generator. Two small changes:
--   * meal_plan_slots.fill_note may say 'no_recipe_fits_adjustment': a slot the generator left empty because the
--     adjustment left out every recipe that was still allowed. Must match SLOT_FILL_NOTES in
--     shared/utils/planGenerator.ts.
--   * plan_adjustment_interpretations caches the AI's validated interpretations, by the SHA-256 of the model and the
--     prompt (which holds the request text, the plan's dates and meal types and the ingredient names, never a person),
--     so the same request on the same plan days reaches the AI once. Only the server (service role) reads and writes
--     it; nobody else has any access.
--
-- Additive and safe for the previous app version, which never writes the new note and does not know the table. Run it
-- before deploying the code that uses it. Every statement can run again.

alter table public.meal_plan_slots drop constraint if exists meal_plan_slots_fill_note_supported;
alter table public.meal_plan_slots
  add constraint meal_plan_slots_fill_note_supported check (
    fill_note in (
      'no_recipe_fits_diets',
      'all_recipes_hated',
      'recently_planned',
      'repeated_in_plan',
      'no_batch_recipe',
      'no_recipe_fits_adjustment'
    )
  );

create table if not exists public.plan_adjustment_interpretations (
  -- Hex SHA-256 of the model and the prompt (planAdjustmentService.ts).
  prompt_hash text primary key,
  model       text not null,
  -- The validated interpretation: {constraints, unsupported} (planAdjustmentSchema in shared/utils/planAdjustment.schema.ts).
  adjustment  jsonb not null,
  created_at  timestamptz not null default now(),
  constraint plan_adjustment_interpretations_prompt_hash_format check (prompt_hash ~ '^[0-9a-f]{64}$'),
  constraint plan_adjustment_interpretations_adjustment_object check (jsonb_typeof(adjustment) = 'object')
);

comment on table public.plan_adjustment_interpretations is
  'AI interpretations of plan adjustment requests (I3), cached by prompt hash. Service role only.';

-- Row level security with no policy: only the service role, which bypasses it, can read or write.
alter table public.plan_adjustment_interpretations enable row level security;
revoke all on public.plan_adjustment_interpretations from anon, authenticated;

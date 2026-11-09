-- Plan overview and history (E6).
--   * meal_plans gains end_date, the plan's last day (start_date + day_count - 1), computed by Postgres so it can
--     never disagree with the dates it is made of. The plan list asks for current and upcoming plans
--     (end_date >= today) and pages through past ones (end_date < today) by it; "today" is the viewer's own date,
--     sent by the app.
--   * Who sees which plan does not change: E1's policies already let every member of a household read its plans,
--     past and upcoming, and only the owner read an individual plan (supabase/tests/meal_plan_history.test.sql).
-- Additive and safe for the previous app version: no function or policy changes, and a generated column is not
-- written by any insert. Run it before deploying the code that uses it. Every statement can run again.

alter table public.meal_plans
  add column if not exists end_date date generated always as (start_date + day_count - 1) stored;

-- "This household's plans" and "my individual plans" that end before or after a date: the plan list's sections.
create index if not exists meal_plans_household_id_end_date_idx on public.meal_plans (household_id, end_date);
create index if not exists meal_plans_user_id_end_date_idx on public.meal_plans (user_id, end_date);

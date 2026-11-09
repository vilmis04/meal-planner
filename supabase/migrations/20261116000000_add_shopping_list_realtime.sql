-- Household shared list with live updates (G6).
--
-- The list page subscribes to Supabase Realtime "postgres_changes" for its list, so a change one member makes shows on
-- every open copy of the list without a reload. Realtime sends a row's change only to subscribers whose SELECT
-- policies let them read it ("shopping items are readable with their list", can_access_shopping_list(), and
-- "shopping lists are readable with their plan", can_access_meal_plan()), so household members get their household
-- plan's changes and nobody else does; a member who leaves stops getting them at once. Nothing about access changes
-- here: G2's policies already say who can read a list, and G4's functions already write one line's own fields per
-- call, so two people's changes to different lines (or different fields of one line) never overwrite each other.
--
-- What this adds is the two tables in the supabase_realtime publication, which is what Realtime reads changes from:
--   * shopping_items: a line added, changed or deleted (by a person, or by a rebuild);
--   * shopping_lists: source_version moving (someone changed the plan, so open lists rebuild themselves) and a
--     rebuild finishing (missing_swap_count).
-- The replica identity stays the default (the primary key). With row level security Realtime sends only the primary
-- key of a deleted row whatever the replica identity, and cannot check a deleted row against the policies, so the page
-- listens to deletes of any line and drops the id if it shows it; ids are random and carry nothing else. A full
-- replica identity would only make every update write the whole old row to the WAL.
--
-- Additive and re-runnable: a table already in the publication is left alone. When there is no supabase_realtime
-- publication (plain Postgres, such as a test database without Realtime) or it already publishes every table, nothing
-- changes; the list then still works and catches up when it is opened or the tab comes back.

do $$
declare
  publication_publishes_all_tables boolean;
  published_table_name text;
begin
  select puballtables into publication_publishes_all_tables
  from pg_catalog.pg_publication
  where pubname = 'supabase_realtime';

  if not found then
    raise notice 'No supabase_realtime publication: shopping lists are not published to Realtime (G6).';
    return;
  end if;
  if publication_publishes_all_tables then
    return;
  end if;

  foreach published_table_name in array array['shopping_lists', 'shopping_items'] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = published_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', published_table_name);
    end if;
  end loop;
end;
$$;

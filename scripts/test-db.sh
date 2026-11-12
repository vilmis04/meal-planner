#!/usr/bin/env bash
# Runs the pgTAP tests (supabase/tests) on a plain PostgreSQL 16 server with pgTAP, without the Supabase CLI: creates
# a fresh database, adds the Supabase parts the migrations need (supabase/ci/supabase-stub.sql), applies every
# migration in order and runs the tests with pg_prove. CI runs it; see README, "Testing and CI".
#
# The server comes from the usual libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD); the user must be a superuser.
# TEST_DATABASE names the database, which is dropped and created again (default meal_planner_test).
set -euo pipefail

TEST_DATABASE="${TEST_DATABASE:-meal_planner_test}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

run_sql_file() {
  psql -X -q -v ON_ERROR_STOP=1 -d "$TEST_DATABASE" -f "$1" >/dev/null
}

dropdb --if-exists "$TEST_DATABASE"
createdb "$TEST_DATABASE"

run_sql_file "$ROOT_DIR/supabase/ci/supabase-stub.sql"
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  run_sql_file "$migration"
done

pg_prove -d "$TEST_DATABASE" "$ROOT_DIR"/supabase/tests/*.test.sql

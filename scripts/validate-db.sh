#!/usr/bin/env bash
# Applies every migration to an EMPTY plain-PostgreSQL database, then runs the
# schema smoke test and the RLS behavior test. Used by CI; safe to run locally
# against a throwaway database. Never point it at production.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/validate-db.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to an empty throwaway database}"
cd "$(dirname "$0")/.."

run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

run supabase/tests/supabase-shim.sql
for migration in supabase/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  run "$migration"
done
run docs/migration-smoke-test.sql
echo "schema smoke test passed"
run docs/rls-behavior-test.sql
run docs/editor-workflow-test.sql
run docs/unsubscribe-test.sql

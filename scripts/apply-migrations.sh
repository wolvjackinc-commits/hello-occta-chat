#!/usr/bin/env bash
# Applies every Supabase migration, in order, to $DATABASE_URL.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must be set}"
for f in supabase/migrations/*.sql; do
  echo "── applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "All migrations applied."

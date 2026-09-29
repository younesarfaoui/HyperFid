#!/usr/bin/env bash
# Runs supabase/tests/rls.test.sql (security + business-rule assertions).
#
#   npm run test:db
#       Spins up a throwaway local PostgreSQL (needs the server binaries:
#       initdb/pg_ctl), applies the Supabase shim, the migrations and the seed,
#       runs the tests, then tears everything down.
#
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#       Runs against an already-migrated database (e.g. after `supabase start`).
#       Everything the tests write is rolled back.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TESTS="$ROOT/supabase/tests/rls.test.sql"

if [[ -n "${DATABASE_URL:-}" ]]; then
  exec psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$TESTS"
fi

PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL server binaries not found (set PG_BIN or DATABASE_URL)." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54399}"
RUN=()
if [[ "$(id -u)" == "0" ]]; then
  # initdb refuses to run as root.
  chown postgres:postgres "$WORK"
  chmod 755 "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

# Apply a SQL file, hiding routine NOTICE/WARNING chatter but failing loudly on errors.
apply() {
  local out
  if ! out="$("${PSQL[@]}" -f "$1" 2>&1)"; then
    echo "$out" >&2
    echo "Failed to apply $1" >&2
    exit 1
  fi
}

apply "$ROOT/supabase/tests/_shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  apply "$migration"
done
apply "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$TESTS"

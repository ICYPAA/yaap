#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
supabase_dir="$repo_root/apps/functions/supabase"
migrations_dir="$supabase_dir/migrations"
project_id="$(
  sed -n 's/^project_id = "\(.*\)"/\1/p' "$supabase_dir/config.toml" |
    head -n 1
)"

if [[ -z "$project_id" ]]; then
  echo "Could not read project_id from $supabase_dir/config.toml." >&2
  exit 1
fi

database_container="supabase_db_${project_id}"

if ! docker inspect "$database_container" >/dev/null 2>&1; then
  echo "Local Supabase database container is missing." >&2
  exit 1
fi

container_health="$(
  docker inspect \
    --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$database_container"
)"

if [[ "$container_health" != "healthy" && "$container_health" != "running" ]]; then
  echo "Local database is not healthy (state: $container_health)." >&2
  exit 1
fi

expected_versions="$(
  for migration in "$migrations_dir"/*.sql; do
    basename "$migration" | cut -d_ -f1
  done | sort
)"

applied_versions="$(
  docker exec "$database_container" \
    psql -U postgres -d postgres -Atc \
    "select version from supabase_migrations.schema_migrations order by version;"
)"

if [[ "$expected_versions" != "$applied_versions" ]]; then
  echo "Tracked and applied migration versions differ." >&2
  diff \
    <(printf '%s\n' "$expected_versions") \
    <(printf '%s\n' "$applied_versions") >&2 || true
  exit 1
fi

table_count="$(
  docker exec "$database_container" \
    psql -U postgres -d postgres -Atc \
    "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"
)"

if [[ ! "$table_count" =~ ^[0-9]+$ || "$table_count" -eq 0 ]]; then
  echo "No public application tables were found." >&2
  exit 1
fi

migration_count="$(printf '%s\n' "$applied_versions" | sed '/^$/d' | wc -l | tr -d ' ')"

echo "Local database verified: $table_count public tables, $migration_count migrations applied."

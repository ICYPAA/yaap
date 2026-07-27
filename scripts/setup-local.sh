#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
reset_database=false

if [[ "${1:-}" == "--reset" ]]; then
  reset_database=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--reset]" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for local Supabase." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but its engine is not running." >&2
  exit 1
fi

pnpm --dir "$repo_root" supabase:start

if [[ "$reset_database" == true ]]; then
  pnpm --dir "$repo_root" supabase:db:reset
else
  pnpm --dir "$repo_root" supabase:migration:up
fi

"$repo_root/scripts/configure-local-env.sh"
"$repo_root/scripts/verify-local-db.sh"

echo
echo "Local services are ready. Stop them later with 'pnpm supabase:stop'."

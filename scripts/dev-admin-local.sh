#!/usr/bin/env bash
set -euo pipefail

pnpm supabase:start

cleanup() {
  pnpm supabase:stop >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

pnpm dev:admin

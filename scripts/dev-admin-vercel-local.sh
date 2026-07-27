#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pnpm --dir "$repo_root" setup:local

cd "$repo_root/apps/admin-web"
pnpm dlx vercel dev

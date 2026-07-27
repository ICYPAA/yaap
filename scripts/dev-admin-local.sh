#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pnpm --dir "$repo_root" setup:local

pnpm --dir "$repo_root" dev:admin

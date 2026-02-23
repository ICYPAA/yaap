# YAAP Monorepo

This repository is a monorepo managed by `pnpm` workspaces + Turborepo.

## Apps

- `apps/mobile`: Expo React Native app
- `apps/admin-web`: Next.js host/admin app (Vercel target)
- `apps/functions`: Supabase functions + migrations workspace

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop (required for local Supabase)

## Install

```bash
pnpm install
```

## Development

Start individual apps:

```bash
pnpm dev:mobile
pnpm dev:admin
```

Start an app with local Supabase Docker automatically:

```bash
pnpm dev:mobile:local
pnpm dev:admin:local
pnpm dev:admin:vercel:local
```

The `:local` scripts start Supabase containers first, then stop them when the app process exits.
On first run, image pulls can take several minutes.

## Supabase CLI

Supabase CLI is installed as a workspace dev dependency and run via `pnpm`:

```bash
pnpm supabase:status
pnpm supabase:start
pnpm supabase:stop
pnpm supabase:db:reset
```

After `pnpm supabase:start`, run `pnpm supabase:status` to get local URLs and anon/service keys for `.env` files.

Link this repo to the hosted Supabase project:

```bash
pnpm supabase:login
pnpm supabase:link
```

`supabase:link` requires a valid Supabase access token (via `supabase login` or `SUPABASE_ACCESS_TOKEN`).

Override project ref if needed:

```bash
SUPABASE_PROJECT_REF=your-ref pnpm supabase:link
```

## Vercel

Deploy `apps/admin-web` as the Vercel project root.

For local Vercel-style Next development:

```bash
cd apps/admin-web
pnpm dev
```

# Supabase workspace

This workspace owns the local Supabase configuration, PostgreSQL migrations,
SQL helpers, and Deno Edge Functions.

Run commands from the repository root so they use the pinned Supabase CLI.

## Local database

```bash
pnpm setup:local
pnpm local:verify
pnpm supabase:status
pnpm supabase:stop
```

To discard local data and reapply every migration:

```bash
pnpm setup:local:reset
```

The reset also loads `supabase/seed.sql`, which creates disposable local admin
accounts and a complete test conference used by both E2E suites. It never
targets the hosted project.

The full workflow and recovery instructions are in the repository
[local startup guide](../../docs/LOCAL_STARTUP.md).

## Edge Functions

Deno 2.x is required for the direct lint and type check:

```bash
pnpm --filter @yaap/functions check
```

Serve the functions through local Supabase:

```bash
pnpm supabase:functions:serve
```

## Hosted project

Hosted-project commands require a Supabase access token and database password:

```bash
pnpm supabase:login
pnpm supabase:link
```

Override the default project reference when needed:

```bash
SUPABASE_PROJECT_REF=your-project-ref pnpm supabase:link
```

# Functions Workspace

This workspace owns Supabase-backed serverless functions, SQL helpers, and migration history.

## Local Dev

1. Install Docker Desktop and ensure it's running.
2. From monorepo root, start local Supabase:

```bash
pnpm supabase:start
```

3. Check status:

```bash
pnpm supabase:status
```

4. Stop local Supabase:

```bash
pnpm supabase:stop
```

## Link to Hosted Project

```bash
pnpm supabase:login
pnpm supabase:link
```

Override the project ref if needed:

```bash
SUPABASE_PROJECT_REF=yourref pnpm supabase:link
```

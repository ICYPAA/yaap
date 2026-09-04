# Discord membership bot

This service keeps previously authenticated YAAP users synchronized with the
configured Discord server. Discord OAuth performs login and the Supabase Edge
Function performs the initial membership check; this process handles later
role changes, departures, rejoins, and periodic reconciliation.

It requires the Discord `GUILD_MEMBERS` privileged intent, but no Discord
server permission bit. Keep both the bot token and Supabase service-role key in
the deployment platform's secret store.

Copy `.env.example` to an ignored `.env` file for local development, then run
`pnpm dev:discord` from the repository root. Build and start the production
process with `pnpm --filter @yaap/discord-bot build` followed by
`pnpm --filter @yaap/discord-bot start`.

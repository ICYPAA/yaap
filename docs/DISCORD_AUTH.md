# Discord authentication and server connection

YAAP uses one Discord application in two ways:

1. Discord OAuth identifies the person signing in.
2. The application's bot stays in the host Discord server and keeps prior
   sign-ins synchronized when members leave, rejoin, or change roles.

The Supabase Edge Function performs the initial, trusted membership check. The
mobile and admin clients do not decide whether a Discord account belongs to the
server.

## Required access

- Access to the existing application in the Discord Developer Portal.
- Supabase project-owner or administrator access for Auth provider settings,
  Edge Function deployment, and secrets.
- A Discord member with **Manage Server** in the new server for the one-time
  bot installation. Full Discord Administrator access is not required.
- An always-on Node.js host for `apps/discord-bot`.

## 1. Copy the new server ID

In Discord, enable **User Settings → Advanced → Developer Mode**. Right-click
the new server, choose **Copy Server ID**, and keep that value as
`DISCORD_GUILD_ID`.

The guild ID is the connection between YAAP and the new server. The OAuth
application and callbacks do not otherwise change when the committee moves to
a different Discord server.

## 2. Confirm the existing Discord application

Open the existing application at <https://discord.com/developers/applications>.
Use a Discord Developer Team rather than leaving the application owned by one
person, so future maintainers can manage OAuth settings and rotate the bot
token.

Under **OAuth2**, register the callback URL shown in **Supabase Dashboard →
Authentication → Sign In / Providers → Discord**. Hosted callbacks have this
form:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

For direct local Discord OAuth testing, also register:

```text
http://localhost:54321/auth/v1/callback
```

The app-to-app destinations such as `yaap://auth/callback` and the admin
website's `/auth/callback` belong in Supabase's redirect allow list, not in the
Discord Developer Portal.

In the Supabase Discord provider settings, enter the existing Discord
application's **Application ID** and **Client Secret**.

YAAP requests these user scopes in both clients:

```text
identify email guilds guilds.members.read
```

The final scope lets the verification function read the signing-in person's
membership and role IDs in the configured server.

## 3. Enable and install the bot

In the Discord application's **Bot** settings:

1. Create or reset the bot token if the existing token is unavailable. A reset
   immediately invalidates the old token.
2. Enable the **Server Members Intent** privileged gateway intent.
3. Do not enable Message Content or Presence intents; YAAP does not use them.

Install the bot in the new server using the application's installation page or
this URL, replacing both placeholders:

```text
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=0&guild_id=DISCORD_GUILD_ID&disable_guild_select=true
```

The bot only observes its own server membership events and fetches individual
members. It does not need Administrator, Manage Roles, message, channel, or
voice permissions. The person approving this link needs **Manage Server** in
the destination server.

## 4. Deploy the database and verification function

Apply the database migration through the normal hosted migration workflow.
Then store the new server ID as an Edge Function secret and deploy the
function:

```bash
pnpm supabase:login
pnpm supabase:link
pnpm exec supabase secrets set DISCORD_GUILD_ID=NEW_SERVER_ID
pnpm exec supabase functions deploy verify_discord_membership
```

Keep membership enforcement disabled while these prerequisites are being set
up. It is off by default in both clients and in `discord_access_config`, so a
schema deployment cannot lock existing Discord users out.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to its Edge
Functions. Do not put the Discord client secret, bot token, or Supabase
service-role key in either client application.

The verification record expires after seven days unless it is renewed by a
fresh login or by the synchronization bot. A server departure is applied as
soon as the running bot receives the event.

## 5. Deploy the synchronization bot

Deploy `apps/discord-bot` as an always-on worker, not as a request-based Vercel
or Supabase Edge Function. Configure these deployment secrets:

```text
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DISCORD_SYNC_INTERVAL_MINUTES=360
```

Build and start commands:

```bash
pnpm --filter @yaap/discord-bot build
pnpm --filter @yaap/discord-bot start
```

The service reconciles all known Discord users at startup and every six hours
by default. It also reacts immediately to member additions, removals, and role
changes.

## 6. Turn on membership enforcement

After the guild secret, verification function, and always-on worker are all
healthy, set `DISCORD_MEMBERSHIP_VERIFICATION_ENABLED=true` in the admin web
deployment and `EXPO_PUBLIC_DISCORD_MEMBERSHIP_VERIFICATION_ENABLED=true` in
the mobile build environment. Then enable the database boundary in the
Supabase SQL editor:

```sql
UPDATE public.discord_access_config
SET enforce_membership = true,
    updated_at = now()
WHERE id = true;
```

If the service needs to be taken offline, reverse those flags and set
`enforce_membership` back to `false` before stopping the worker.

## 7. Verify the connection

1. Sign in with a Discord account that has completed the new server's
   membership screening. It should receive the default YAAP `host` role if no
   application role has been assigned yet.
2. Sign in with an account outside the server. YAAP should sign it back out.
3. Remove the first test account from the server. The bot should mark its
   membership inactive and database role policies should stop returning its
   host role.
4. Rejoin and complete membership screening, then sign in again. Access should
   be restored.
5. Confirm that an explicitly provisioned email recovery administrator can
   still sign in without Discord.

## Moving to another Discord server later

Install the same bot into the replacement server and change
`DISCORD_GUILD_ID` in both the Edge Function and bot deployments. Existing
membership rows are re-keyed during each person's next OAuth login. Keep the
old bot installed until the transition is complete if both servers must work
during a migration; supporting two active servers simultaneously would require
an intentional schema and policy change.

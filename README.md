# YAAP

YAAP is a conference guide built with Expo, backed by local or hosted
Supabase, with a focused Next.js control board for conference administrators.

## Product areas

- Mobile conference guide: onboarding, program, personal schedule, profile,
  venue information, services, accommodations, and safety.
- Conference control board: current-conference status, program and category
  management, venue/food/activity/hospitality content, app design and copy,
  attendee feature flags, and safety content.
- Access control: administrator, conference-staff, and view-only access,
  enforced in both the UI and PostgreSQL row-level policies.

Legacy host operations such as registration, geography, committee reports,
shift scheduling, outreach, panels, and notification tooling are not part of
the control board.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/mobile` | Expo SDK 55 iOS/Android conference app |
| `apps/admin-web` | Next.js 15 conference control board |
| `apps/functions` | Supabase config, PostgreSQL migrations, seed, and Edge Functions |
| `scripts` | Reproducible setup, verification, development, and E2E entry points |

## Toolchain

- Node.js 22.13+ (22.19.0 is pinned in `.nvmrc`)
- pnpm 10.12.3 through Corepack
- Docker Desktop or another Docker-compatible engine
- Workspace-pinned Supabase CLI 2.75.0
- Expo SDK 55, React Native, and Expo Router
- Next.js 15 and Playwright
- Xcode, an iOS Simulator runtime, CocoaPods, Maestro 2.7+, and Java 17 for
  native iOS E2E

Apple does not include `simctl` or Simulator runtimes in the standalone
Command Line Tools package. Native iOS work therefore requires the Xcode
developer bundle even if the Xcode editor itself is not used.

## Start locally

Start Docker, then run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm setup:local:reset
```

This recreates PostgreSQL, applies all migrations, loads deterministic
conference and account fixtures, generates ignored local environments, and
verifies the database.

The seed includes a complete **Local Test Conference** with an active
conference, program events, venue amenities, attendee services, safety
information, and local admin accounts. The mobile app displays this conference
and its program immediately when started against the generated local
environment.

Start the admin board:

```bash
pnpm dev:admin:local
```

Open [http://localhost:3000](http://localhost:3000).

The native iOS project is generated and Git-ignored. On a fresh checkout,
boot exactly one iOS Simulator and create and install the development client
once:

```bash
open -a Simulator
cd apps/mobile
YAAP_LOCAL_IOS=1 pnpm exec expo prebuild --platform ios --clean
YAAP_LOCAL_IOS=1 pnpm exec expo run:ios
```

`YAAP_LOCAL_IOS=1` omits the Apple Sign-In entitlement for unsigned local
Simulator builds; production builds keep Apple Sign-In enabled. Expo generates
the Xcode project, workspace, Pods, and `YAAP` scheme; do not create them
manually. The final command builds, installs, and opens
`com.themindfulpug.icypaa` in the booted Simulator.

After that first install, return to the repository root and start normal
mobile development with:

```bash
pnpm dev:mobile:local
```

Press `i` only after the development client has been installed. The web target
remains available for development, but native conference acceptance and E2E
testing are done in the iOS Simulator.

For normal later starts, use `pnpm setup:local` instead of the destructive
reset. See the [local startup guide](docs/LOCAL_STARTUP.md) for the complete
workflow.

## Local accounts

`supabase/seed.sql` creates disposable accounts only in the local database:

| Access | Email | Password |
| --- | --- | --- |
| Administrator | `admin@yaap.local` | `local-admin-password` |
| Conference manager | `manager@yaap.local` | `local-manager-password` |
| View only | `viewer@yaap.local` | `local-viewer-password` |

The local admin sign-in form is enabled only in the generated local
environment. Hosted environments keep it disabled and use configured OAuth.

## Local environment and secrets

Setup generates these ignored files:

- `apps/mobile/.env.local`
- `apps/admin-web/.env.local`

They contain loopback URLs, Supabase's local publishable key, and a local-auth
feature flag. They do **not** contain production credentials or an admin
service-role key. No actual secrets are required for the local mobile app,
admin board, seeded database, or E2E suites.

The generator will not replace a custom `.env.local` unless invoked with
`pnpm local:env --force`.

## Useful commands

```bash
# Local database
pnpm setup:local
pnpm setup:local:reset
pnpm local:verify
pnpm supabase:status
pnpm supabase:stop

# Applications
pnpm dev:mobile:local
pnpm dev:mobile:web:local
pnpm dev:admin:local

# Regression suites
pnpm e2e:admin
pnpm e2e:mobile:ios

# Repository checks
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

See [E2E testing](docs/E2E_TESTING.md) for coverage and native prerequisites,
and the [setup failure log](docs/LOCAL_SETUP_FAILURES.md) for the failures and
fixes found while making this workflow reproducible.

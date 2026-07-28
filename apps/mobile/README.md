# YAAP Mobile

The mobile workspace is an Expo SDK 52 application using React Native,
TypeScript, Expo Router, and Supabase.

Run mobile development from the monorepo root so the pinned pnpm and Supabase
versions, local database migrations, and generated environment are all used.

## Start with local Supabase

```bash
pnpm install --frozen-lockfile
pnpm setup:local:reset
```

The `ios` directory is generated and Git-ignored. On a fresh checkout, boot
exactly one iOS Simulator, then generate, build, and install the development
client:

```bash
open -a Simulator
cd apps/mobile
YAAP_LOCAL_IOS=1 pnpm exec expo prebuild --platform ios --clean
YAAP_LOCAL_IOS=1 pnpm exec expo run:ios
```

The local profile applies the repository's Expo SDK 52 compatibility fixes
for current Xcode versions. Expo creates `YAAP.xcodeproj`,
`YAAP.xcworkspace`, the Pods, and the shared `YAAP` scheme automatically; do
not create a scheme manually or open the `.xcodeproj`.

After the development client is installed, use this from the repository root
for normal starts:

```bash
pnpm dev:mobile:local
```

Press `i` only after the initial development client is installed. The web
target is available through `pnpm dev:mobile:web:local` for development
convenience, but conference acceptance is performed natively.

On later runs, `dev:mobile:local` starts or reuses Supabase and applies only
pending migrations; it does not reset local data.

The generated `apps/mobile/.env.local` points the application to the local
Supabase API and is ignored by Git.

For the complete setup, device networking, and troubleshooting instructions,
see the repository [local startup guide](../../docs/LOCAL_STARTUP.md).

## Main areas

- Program and saved schedules
- Conference accommodations, services, maps, and safety information
- Accessibility, hospitality, support, and volunteering workflows
- Optional attendee profiles and schedule sharing
- Restricted host-committee tools

## Workspace commands

From the repository root:

```bash
pnpm --filter @yaap/mobile typecheck
pnpm --filter @yaap/mobile lint
pnpm --filter @yaap/mobile test
pnpm --filter @yaap/mobile exec expo export --platform web
```

## Native end-to-end tests

After installing Xcode with an iOS runtime, Maestro, and Java 17:

```bash
pnpm e2e:mobile:ios
```

This resets the disposable local database, builds and installs the Expo
development client in an iOS Simulator, and tests onboarding, the conference
program, profile and schedule, accommodations, services, accessibility, and
safety. See the repository [E2E guide](../../docs/E2E_TESTING.md).

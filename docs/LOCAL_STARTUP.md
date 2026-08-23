# Local startup guide

This guide starts YAAP from a clean checkout with both applications pointing
to a fully migrated and seeded local Supabase/PostgreSQL database.

## 1. Prerequisites

Install:

- Node.js 22.13+ (22.19.0 is pinned in `.nvmrc`)
- Corepack, included with supported Node releases
- Docker Desktop, OrbStack, Colima, or another Docker-compatible engine
- Xcode plus an iOS Simulator runtime for the native conference app
- CocoaPods for native iOS dependencies (`brew install cocoapods`)
- Deno 2.x only for direct Edge Function checks

Standalone Apple Command Line Tools are insufficient for Simulator testing:
`simctl`, the iOS SDK, and device runtimes ship in the Xcode developer bundle.

After installing Xcode, complete Apple's one-time setup yourself:

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

Then install an iOS runtime from **Xcode → Settings → Components** and verify:

```bash
xcode-select -p
xcodebuild -version
xcrun --find simctl
xcrun simctl list runtimes
```

## 2. Install dependencies

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Expo and Supabase are workspace dependencies; global installs are not needed.

## 3. Build the local database

Start Docker, then run:

```bash
pnpm setup:local:reset
```

The reset:

1. Starts this repository's Supabase containers.
2. Recreates local PostgreSQL.
3. Applies every tracked migration.
4. Seeds three access-control accounts and a complete test conference.
5. Generates both ignored `.env.local` files.
6. Verifies container health, migrations, and public tables.

The reset deletes only this repository's local Supabase data. Expected output
currently ends with:

```text
Local database verified: 35 public tables, 6 migrations applied.
```

Use the non-destructive command on later starts:

```bash
pnpm setup:local
```

## 4. Start the admin board

```bash
pnpm dev:admin:local
```

Open [http://localhost:3000](http://localhost:3000) and use one of the local
accounts documented in the root README.

The board contains conference/app setup and access control only. It does not
require Twilio, email, Google, hCaptcha, Vercel Blob, or a Supabase
service-role secret.

## 5. Start the native conference app

The repository intentionally ignores `apps/mobile/ios`. A fresh checkout does
not contain an installed development client, and `pnpm dev:mobile:local`
starts Metro but does not create or install one.

For the first native start, boot exactly one Simulator and run:

```bash
open -a Simulator
cd apps/mobile
YAAP_LOCAL_IOS=1 pnpm exec expo prebuild --platform ios --clean
YAAP_LOCAL_IOS=1 pnpm exec expo run:ios
```

The clean prebuild generates `YAAP.xcodeproj`, `YAAP.xcworkspace`, CocoaPods,
and the shared `YAAP` scheme. `YAAP_LOCAL_IOS=1` also applies the repository's
Xcode 26 compatibility fixes and removes the production-only Apple Sign-In
entitlement from the unsigned local Simulator build. Do not manually create a
scheme. If Xcode must be used for troubleshooting, open
`apps/mobile/ios/YAAP.xcworkspace`, never `YAAP.xcodeproj`.

After that command installs `com.themindfulpug.icypaa`, use the normal command
from the repository root on later starts:

```bash
pnpm dev:mobile:local
```

Press `i` only after the development client is installed. Otherwise Expo
correctly reports `No development build ... is installed`. The generated
`http://127.0.0.1:54321` Supabase URL is reachable from the Simulator.

The Expo web target can be started with `pnpm dev:mobile:web:local` for
development convenience, but the conference app's acceptance suite uses the
iOS Simulator.

## 6. Local environment files

`pnpm setup:local` generates:

### `apps/mobile/.env.local`

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local publishable key>
EXPO_PUBLIC_ADMIN_API_BASE_URL=http://127.0.0.1:3000
```

### `apps/admin-web/.env.local`

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local publishable key>
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_URL=http://127.0.0.1:3000
NEXT_PUBLIC_ENABLE_LOCAL_AUTH=true
```

These values are local endpoints and public client configuration, not
production secrets. Both files are Git-ignored.

## 7. Device networking

The default loopback URL works for Expo web and the iOS Simulator.

Android Emulator uses the host alias `10.0.2.2`:

```bash
LOCAL_SUPABASE_URL=http://10.0.2.2:54321 \
LOCAL_ADMIN_API_BASE_URL=http://10.0.2.2:3000 \
pnpm setup:local
```

For a physical device, use the computer's LAN address:

```bash
LOCAL_SUPABASE_URL=http://192.168.1.50:54321 \
LOCAL_ADMIN_API_BASE_URL=http://192.168.1.50:3000 \
pnpm setup:local
```

The computer and device must share a network, and the firewall must allow
ports 3000, 54321, and 8081.

## 8. Local services

| Service | URL |
| --- | --- |
| Admin board | [http://localhost:3000](http://localhost:3000) |
| Expo | [http://localhost:8081](http://localhost:8081) |
| Supabase API | [http://127.0.0.1:54321](http://127.0.0.1:54321) |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | [http://127.0.0.1:54323](http://127.0.0.1:54323) |
| Local email viewer | [http://127.0.0.1:54324](http://127.0.0.1:54324) |

## 9. Troubleshooting

### Xcode license blocks Git or Simulator

The command exits with status 69 and asks for license acceptance. Review and
accept the license in a Terminal:

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

### No iOS runtime is listed

Install one from **Xcode → Settings → Components**. `simctl` alone cannot boot
a device without a runtime.

### Expo reports that no development build is installed

`pnpm dev:mobile:local` starts Metro; it does not build or install the native
application. Follow the first-native-start commands in section 5. Confirm the
installation with:

```bash
xcrun simctl get_app_container booted com.themindfulpug.icypaa app
```

The command prints the installed application path. If it cannot find the
bundle, keep exactly one Simulator booted and rerun the
`YAAP_LOCAL_IOS=1 ... expo run:ios` command.

### Docker is installed but unavailable

Start the Docker engine and wait for `docker info` to succeed, then rerun
`pnpm setup:local`.

### Supabase says it is running but its database exited

Recreate only this project's local stack:

```bash
pnpm --dir apps/functions exec supabase stop --no-backup
pnpm setup:local:reset
```

### A custom `.env.local` blocks setup

Move it aside, or explicitly replace it:

```bash
pnpm local:env --force
```

### Metro reports a missing package

```bash
pnpm install --frozen-lockfile
pnpm --filter @yaap/mobile exec expo start --clear
```

### A development port is occupied

The default ports are 3000, 54321-54324, 54327, and 8081. Stop the conflicting
process or other local Supabase project before retrying.

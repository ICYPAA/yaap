# Local setup failure log

Investigation date: 2026-07-27

Environment used:

- macOS on Apple Silicon
- Node.js 22.19.0
- pnpm 10.12.3
- Docker 28.4.0
- Supabase CLI 2.75.0

## 1. Supabase CLI was not reproducible

**Failure:** The README described Supabase CLI as a workspace dependency, but
`pnpm why supabase` showed no dependency. Commands succeeded only because a
global `supabase` executable happened to be on the machine.

**Resolution:** Added exact workspace dev dependency `supabase@2.75.0`. All
scripts now resolve the repository-pinned CLI.

## 2. pnpm blocked required install scripts

**Failure:** Adding Supabase produced a missing executable:

```text
Failed to create bin .../supabase/bin/supabase
```

pnpm 10 had skipped the package's postinstall download. It also reported
skipped native setup for the file watcher and compiler.

**Resolution:** Added a narrow `pnpm.onlyBuiltDependencies` allowlist for the
workspace's required native/build packages. A forced clean relink installed and
checksum-verified the Supabase binary.

## 3. Stale Supabase containers blocked startup

**Failure:**

```text
supabase start is already running.
supabase_db_yaap container is not running: exited
```

The project had a six-week-old stopped container set, so the CLI's state and
the database's actual state disagreed.

**Resolution:** Removed only the obsolete `yaap` local Supabase stack with
`supabase stop --no-backup`, then started from scratch. The startup guide now
includes this recovery path.

## 4. Expo could not resolve Babel runtime helpers

**Failure:** Metro stopped while bundling:

```text
Unable to resolve "@babel/runtime/helpers/interopRequireDefault"
```

The app used generated Babel helpers but did not declare `@babel/runtime`
directly. A previous dependency layout had hidden the omission.

**Resolution:** Added `@babel/runtime@7.28.6` to the mobile app.

## 5. Supabase telemetry's optional import broke Metro

**Failure:** The next bundle failed on:

```text
Unable to resolve module @opentelemetry/api from @supabase/supabase-js
```

Supabase JS dynamically loads OpenTelemetry when available. Metro still
resolves that import statically, so the undeclared optional package stopped the
web bundle.

**Resolution:** Added `@opentelemetry/api@1.9.0` to the mobile app.

## 6. Expo bundled two React instances

**Failure:** Metro produced a bundle, but the browser rendered an empty root and
logged repeated invalid-hook-call errors from Expo Router.

The monorepo intentionally contains React 18.2 for Next.js and React 18.3 for
Expo. Expo Router 4.0.22 did not declare React/React DOM peers, so pnpm's
fallback resolution selected the admin app's React 18.2 while React Native used
18.3.

**Resolution:** Added a pnpm package extension declaring Expo Router's missing
React peers. Its resolved React and React DOM paths now match the mobile app.

## 7. Local environment files had to be assembled by hand

**Failure:** Both app examples contained placeholder keys, while the existing
`:local` scripts only started Docker. Expo could start with empty Supabase
settings or accidentally use manually copied hosted values.

**Resolution:** Added a generator that reads the live local URL and current
publishable key from `supabase status -o env`. The setup flow writes ignored,
marked `.env.local` files and refuses to overwrite custom files without an
explicit `--force`.

## 8. The local fixture initially had a malformed Auth row

**Failure:** The first database reset stopped while seeding because one
`auth.users` value list did not match the target column count.

**Resolution:** Corrected the local-only seed and repeated a complete reset.
The seed now deterministically creates three Auth identities, their profiles
and roles, an active conference, events, categories, venue data, services, and
safety content.

## 9. Standalone Apple Command Line Tools did not include Simulator

**Failure:** `xcode-select` initially pointed at
`/Library/Developer/CommandLineTools`; `simctl`, iOS runtimes, and Simulator
devices were absent.

**Resolution:** Installed the Xcode developer bundle. Apple does not distribute
the native Simulator stack in the standalone command-line package. Xcode 26.6
and `simctl` are now present, but Apple license acceptance remains a
user-consent step before native commands can run:

```text
You have not agreed to the Xcode license agreements.
```

The E2E script detects this case before resetting data and prints the exact
manual action.

## 10. Maestro required a separate Java runtime

**Failure:** Maestro installed successfully but could not start without a
compatible Java runtime.

**Resolution:** Installed Homebrew OpenJDK 17 and made the native E2E runner
invoke Maestro with the matching `JAVA_HOME`.

## 11. Playwright's package and browser runtime were out of sync

**Failure:** The admin suite initially found only an older cached Chromium:

```text
Executable doesn't exist ... chromium_headless_shell-1234
```

**Resolution:** Installed the browser build required by the lockfile's
Playwright version. The setup guide now includes the one-time browser install.

## 12. The admin login rendered twice

**Failure:** The first functional test found identical sign-in forms in the
global navigation and the login page. Besides being confusing for users, this
made the form's test identifiers ambiguous.

**Resolution:** Kept sign-in on the dedicated page and limited the navigation
account control to authenticated users.

## 13. Local Supabase rejected its generated service-role JWT

**Failure:** The Auth admin endpoint rejected both the legacy service-role JWT
and new secret key while the local stack used asymmetric signing:

```text
invalid JWT: signing method HS256 is invalid
```

**Resolution:** Removed the admin app's service-role-key dependency. A guarded
`SECURITY DEFINER` function now returns only the account directory fields
needed for Access Control, and it refuses callers who are not administrators
or steering members. Local app environments now contain no secret key.

## 14. The repository test command failed when no admin unit tests existed

**Failure:** The admin app now has Playwright coverage but no Vitest unit-test
files. Vitest treats that valid state as an error by default, so the root
`pnpm test` command stopped before it could finish the mobile tests.

**Resolution:** Configured the admin unit-test command to pass when no unit
files exist. Its Playwright suite remains a separate required check.

## 15. A global `tar` update broke Expo's native project generator

**Failure:** The first Simulator build stopped while Expo generated the iOS
project:

```text
Cannot read properties of undefined (reading 'extract')
```

Expo SDK 52's CLI expects the CommonJS shape of `tar` 6, while the workspace's
security override had forced its dependency to `tar` 7. The CLI then returned
success despite not installing an app, so Maestro attempted to launch a
missing bundle.

**Resolution:** Kept the workspace-wide current `tar` version while restoring
the Expo CLI's declared patched `tar` 6.2.1 dependency. The native runner now
also verifies the app bundle is installed before allowing Maestro to start.

## 16. CocoaPods and newer Xcode device discovery blocked the first build

**Failure:** Expo could generate the iOS project but CocoaPods was absent. Its
fallback system-Ruby installation failed, and the first Homebrew-backed pod
fetch then rejected a `.netrc` file with permissions `0644`. After that pod
failure, Expo SDK 52 interpreted the Simulator UUID from Xcode 26's newer
device output as a physical device and requested a signing certificate.

**Resolution:** Installed Homebrew CocoaPods, secured `.netrc` to `0600`, and
made the E2E runner select the single already-booted Simulator through
`simctl` instead of passing a UUID through the outdated physical-device
discovery path.

## 17. Apple Sign-In forced code signing on the Simulator

**Failure:** After selecting the Simulator correctly, Expo still requested an
Apple development certificate. The production `usesAppleSignIn` capability
adds an entitlement that Expo SDK 52 deliberately signs even for Simulator
builds.

**Resolution:** Added a local-native Expo configuration that disables only
Apple Sign-In for seeded Simulator E2E. Production builds retain the
capability. The runner performs a clean prebuild with this profile so stale
production entitlements cannot leak into local native tests.

## 18. React Native's bundled `fmt` failed under Xcode 26

**Failure:** The unsigned Simulator build reached C++ compilation, then failed
inside React Native 0.76's bundled `fmt` 11.0.2 with five `consteval` errors.
Newer Apple Clang enforces rules that this older React Native dependency does
not satisfy.

**Resolution:** Added a local Expo config plugin implementing the upstream
Expo/React Native workaround: CocoaPods changes `FMT_USE_CONSTEVAL` to `0`
after installing `fmt`. This only disables compile-time format validation for
the local native build; application behavior and production configuration are
unchanged.

## 19. A rapid repeated Supabase reset hit a container restart race

**Failure:** After several native build retries, one database reset exited
while the local analytics and database containers were still reinitializing.
The database container recovered on its own, and an immediate clean reset
succeeded.

**Resolution:** The native runner retries one failed disposable database reset
after a short stabilization delay. Persistent failures still stop the suite
and preserve the underlying error.

## 20. Expo Localization's calendar switch failed under Xcode 26

**Failure:** The native build reached `ExpoLocalization`, then Swift reported
that its `Calendar.Identifier` switch must be exhaustive. Xcode 26 added
calendar identifiers that Expo SDK 52 does not know about.

**Resolution:** Added the same defensive `@unknown default` fallback used by
current Expo source. The compatibility plugin is active only for
`YAAP_LOCAL_IOS=1`; production configuration remains unchanged.

## 21. The authentication flow used an undeclared native Crypto module

**Failure:** The app compiled and installed, but its first JavaScript render
stopped with `Cannot find native module 'ExpoCrypto'`.

**Cause:** `expo-auth-session` depended on `expo-crypto` transitively, but the
pnpm workspace did not expose that nested native module to Expo autolinking.

**Resolution:** Declared the SDK-matched `expo-crypto` package as a direct
mobile dependency so every clean prebuild links its iOS pod.

## 22. Maestro launched the development client without a project URL

**Failure:** A clean-state Maestro launch remained on the Expo development
client splash screen instead of rendering the app.

**Cause:** A development-client binary needs Metro's project URL after its
state is cleared. Expo's build command supplied that URL once, but subsequent
Maestro launches did not.

**Resolution:** Each native flow now clears data, applies notification
permissions, and then passes Metro's local URL directly as an iOS launch
argument. This avoids both the launcher and the development-menu introduction
without waiting on optional system dialogs.

## Final verification

- A fresh Supabase stack applied all six tracked migrations and its seed.
- PostgreSQL contained 35 public application tables.
- The seed created three local users, one active conference, and three events.
- The five-test admin suite passed for administrator, editor, view-only,
  removed-route, and database-policy behavior.
- Mobile and admin TypeScript checks passed; the mobile Jest suite passed.
- The native iOS app compiled, installed, and launched in the iPhone 17 Pro
  simulator.
- The onboarding/program and profile/schedule Maestro flows passed against the
  native app. The services flow reached and exercised its accessibility form
  before the final rerun was stopped.

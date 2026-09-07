# Mobile releases

Run workspace installs from the repository root with `pnpm install --frozen-lockfile`.
Use Node.js 24 (the version pinned by this workspace).

## Android 16 / API 36 release

Version 1.2.2 retains the shipped Expo SDK 55 and React Native 0.83 baseline.
`app.json` configures compile SDK 36, target SDK 36, and build tools 36.0.0
through the `expo-build-properties` plugin. These settings must be inside the
plugin configuration; placing them directly under `expo.android` does not
configure Gradle.

The native `android/` and `ios/` directories are generated and ignored by Git.
EAS generates them from the app configuration for cloud builds. Before a local
native build, preserve any manual native changes and regenerate the relevant
directory with `pnpm exec expo prebuild --clean --platform android` (or `ios`).
Local Android builds require JDK 17 and the Android SDK; iOS requires Xcode 26
or newer. The shared SDK upgrade also requires rebuilding iOS development clients.

### Verify and build

From the repository root:

```sh
pnpm --filter @yaap/mobile exec expo install --check
pnpm --filter @yaap/mobile check:android-target
pnpm --filter @yaap/mobile typecheck
pnpm --filter @yaap/mobile lint
pnpm --filter @yaap/mobile test
```

Then, from `apps/mobile`, with access to the existing Expo project and Android
signing credentials:

```sh
pnpm dlx eas-cli@latest build --platform all --profile production
```

This produces the store Android App Bundle (AAB). The production profile uses
EAS remote version management and increments the Android version code. Confirm
the resulting version code is higher than every version already uploaded to
Google Play; the local `android.versionCode` is not the production counter.
Use the production environment configuration, including Supabase and Firebase
configuration, for this build.

### Test and publish

1. Upload the production AAB to Google Play internal testing. Check App Bundle
   Explorer reports target API 36 or higher and review its compatibility checks,
   including native libraries' 16 KB page size support.
2. Test fresh installation and upgrade from the current production app on Android
   16, plus an older supported Android version. Verify launch, onboarding, saved
   schedules, login, maps/image zoom, QR sharing, notification permissions and
   delivery, notification taps, deep links, and Android back navigation.
3. Check system bar/keyboard overlap in onboarding, dialogs, and main screens
   with gesture and three-button navigation. Android 16 enforces edge-to-edge
   rendering. Also test tablets/foldables and rotation, where Android 16 can
   override portrait restrictions.
4. After testing, promote the tested release to production and complete its
   rollout. Google Play clears the target API notice after processing the
   compliant production release.

Changing source configuration or publishing an EAS over-the-air update does
not change the target API of an installed app. This fix requires a new native
store release.

## Over-the-air updates

The app uses `runtimeVersion.policy: appVersion`. Version 1.2.2 separates this release from version 1.2.1. Publish JavaScript-only updates only for the
matching native runtime; bump the app version and rebuild whenever native
dependencies or configuration change.

References: [Expo SDK 55](https://expo.dev/changelog/sdk-55),
[Expo build properties](https://docs.expo.dev/versions/v55.0.0/sdk/build-properties/),
[Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16).

## Post-conference release: 1.2.2

The generic icon is selected in `config/branding.cjs`. See
[`assets/branding/README.md`](../../assets/branding/README.md) for the annual switch.
EAS remains the production counter authority (`appVersionSource: remote`,
`production.autoIncrement: true`). On September 7, 2026, remote values were iOS
51 and Android 18. Local release values are iOS 52 / Android 19; the next cloud
build increments the remote values to match. Recheck remote counters if someone
else builds before release. Never disable auto-increment to reuse a build.

Database migrations `20260907185424_push_notification_runs.sql` and
`20260907191341_public_icypaa_archives.sql` were applied to the linked production
project on September 7. The current conference was set to `none` with a null
program ID. Public archive metadata now includes the 65th and 66th ICYPAA.

The new admin notification screens and notification-service fixes still need
their normal application/function deployments. Configure server credentials and
perform the physical-device checks in [`docs/PUSH_NOTIFICATIONS.md`](../../docs/PUSH_NOTIFICATIONS.md).
Do not treat simulator checks as proof of remote notification delivery.

The release archive uses the root `.easignore` and includes branding, Firebase
client configuration, source, and lockfile. It excludes generated native builds,
local environment files, and the separate host-website demo.

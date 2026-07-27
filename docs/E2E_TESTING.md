# E2E testing

YAAP has separate end-to-end suites for the native conference app and the web
control board.

## Native iOS conference suite

The mobile suite uses Maestro against a real iOS Simulator build. It does not
use the Expo website as a substitute for native acceptance.

Install the test runner and Java runtime:

```bash
brew install openjdk@17
brew install mobile-dev-inc/tap/maestro
brew install cocoapods
```

Verify the Apple prerequisites in the local startup guide, then run:

```bash
pnpm e2e:mobile:ios
```

The command intentionally resets disposable local Supabase data, loads the
fixtures, starts or reuses an iOS Simulator, builds and installs the Expo
development client, starts Metro, and runs every flow under
`apps/mobile/e2e/maestro/tests`.

Current native coverage:

- First launch, tutorial, safety acknowledgement, program list, and timeline.
- Attendee profile creation, saving a program event, and My Schedule.
- Accommodations, venue amenities, food, local activities, app services,
  accessibility request submission, and conference safety content.

Artifacts are written under `apps/mobile/e2e/maestro/artifacts` and ignored by
Git.

## Admin control-board suite

Install Playwright's browser once:

```bash
pnpm --filter @yaap/admin-web exec playwright install chromium
```

Then run:

```bash
pnpm e2e:admin
```

This resets local Supabase, starts the admin board for the test, and verifies:

- An administrator can see conference setup and access control.
- Conference staff with `program:edit` can manage conference content but
  cannot manage access.
- View-only staff cannot enter conference management.
- Removed legacy host routes return not found.
- PostgreSQL allows conference editors to update conference data and blocks a
  view-only account at the row-level-policy boundary.

For a database that is already seeded, run only the Playwright tests:

```bash
pnpm --filter @yaap/admin-web e2e
```

Failure screenshots, videos, traces, and reports are generated under
`apps/admin-web/test-results` and `apps/admin-web/playwright-report`; both are
ignored by Git.

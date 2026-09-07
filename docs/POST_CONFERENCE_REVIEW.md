# Post-conference release review — September 7, 2026

## Visual review completed

The iPhone 17 Pro simulator runs the native Expo SDK 55 app against local
Supabase. It contains local copies of the **public** 65th and 66th programs;
production attendee profiles were not copied. Use Exit look back, choose another
program, switch List / Timeline / My Schedule, and open the sliders icon beside the category chips for Event type / Time / Room.
The look-back toolbar contains the timezone, Switch, and X. The original conference title and theme header remains below it.
Conference colors now update on selection and reset on exit; My Schedule stays on one line.

The local review admin is at http://localhost:3000. Its sign-in accounts are the
disposable accounts documented in the repository's local setup. Administrator
notification diagnostics and the in-app push guide are ready to inspect there.

The local database also contains **ICYPAA · Active preview**, a local-only test program.
September 7 opens Monday. Open the sliders icon beside the category chips and
toggle **Hide past events**: Morning meeting disappears; the two evening events remain.
Both the local review and production currently have no active program.
Select the active preview in the local admin only when testing live controls.

## Verified

- Native iOS Simulator build succeeded; mobile app tested with computer use.
- Generic home with no current program; archive dropdown excludes HACYPAA.
- Explicitly selecting an archive loads it; switching changes program and timezone.
- Archive event details expand, events are not faded, saved events appear in My Schedule.
- Closing the app with an archive open and relaunching returns to the holding screen.
- Live conference starts on the current conference-local day.
- Hide/Show past works in list and timeline; Event type / Time / Room regroup correctly.
- Diagnostics is absent from public home/Profile and available only under Host to a signed-in full administrator, including between conferences.
- Host subscriptions no longer recreate themselves whenever pending counts update.
- Native notification diagnostics handles simulator limitations without inventing a token.
- Local administrator can access diagnostics and committee screens; a program editor cannot access either by direct URL.
- Invalid test token rejected before delivery; no real notifications sent.
- SQL row-access checks: a program editor sees no push logs, a permitted host sees only their own, full admin sees all. Test writes were rolled back.
- Mobile: 10 suites / 34 tests passed. Admin: 5 suites / 16 tests passed.
- Type checks, lint, Expo dependency compatibility, and admin production build passed.
- Android prebuild generates target/compile API 36 and the generic icon's adaptive inset.
- EAS release upload inspected: needed source/assets/config included; local credentials and generated native content excluded.

## Production state and remaining release steps

The production current program is cleared, and both new database migrations are
applied. App version is 1.2.2; prepared build numbers are iOS 52 and Android 19,
with EAS automatic increments enabled. Visual sign-off was received after the default palette changed to generic ICYPAA navy blue.
Store submissions have not started.

Release steps: start both production EAS builds, deploy the admin notification
screens and updated notification_service function, configure its server-side
credentials, and run the administrator's test on physical iOS/Android devices.
Google Play compliance requires publishing the new Android bundle to production;
the source change and simulator build alone do not clear the notice.

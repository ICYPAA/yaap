# Push notifications: host handoff and administrator checks

## Two separate dashboard sections

- **Dashboard → Committee announcements** (`/host/push-notifications`): administrators and accounts explicitly granted `notifications:send` can compose, review, send, and check their delivery attempts. `program:edit` alone does not grant sending. There must be an active conference. The audience is **all app profiles with notifications enabled and a valid token**, not an attendance or saved-program list.
- **Dashboard → Administrator diagnostics** (`/admin/push-notifications`): only the `admin` role can inspect configuration and send a `[TEST]` message to one entered device. Hosts cannot access this action, even by calling it directly. Administrators can view all attempts; hosts see their own.

Use Manage access to grant a host `notifications:send`. Remove it after the handoff. Steering members who need to send should be deliberately assigned notification access; steering status alone does not unlock the new sender.

## Administrator setup before a conference

1. Apply `20260907185424_push_notification_runs.sql` through the normal migration workflow. It adds delivery history with row-level access; only the server writes it. Deploy the updated admin app and `notification_service` function.
2. Set `SUPABASE_SERVICE_ROLE_KEY` on the **admin server only**, using the same project as `NEXT_PUBLIC_SUPABASE_URL`. Never expose it with a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix. Local testing uses the local service key, never the production one.
3. Check the existing Expo project `15c03e66-5f31-409b-b31a-b53b92e00fb1`. In EAS credentials, verify APNs credentials for `com.themindfulpug.icypaa` and FCM v1 credentials for `com.themindfulpug.yaap`. Ensure the Android Google services file belongs to that Firebase app. Replace revoked/expired credentials as needed; don't rotate working credentials merely because the conference changed.
4. If Expo enhanced push security is enabled, set a valid `EXPO_ACCESS_TOKEN` in **both** the admin server and Supabase Edge Function secrets. Redeploy/restart the affected service after changing its configuration. The dashboard reports presence, not validity.
5. Install the intended native development/TestFlight/store build on your own iOS and Android devices. Allow notifications. Confirm the displayed app version and project ID in Notification diagnostics. Simulator UI checks do not prove APNs/FCM delivery.

## Live single-device test

1. In the mobile app, open **Notification diagnostics** under Host → Notification diagnostics, signed in as a full administrator. Tap **Refresh token**, then press and hold the displayed token to copy it. A profile is not needed for this single-device test. A profile with notifications enabled is needed for committee broadcasts.
2. Open **Administrator diagnostics** in YAAP Admin. Paste that device's Expo push token, enter a recognizable test title and message, review, and send. The sender targets that token only and adds `[TEST]`.
3. Verify the banner on the device in the foreground, then repeat with the app backgrounded and device locked. Check system Focus/Do Not Disturb, permission, and notification-channel settings if the device stays silent.
4. Open delivery history and **Check receipts** after approximately 15 minutes (within 24 hours). A ticket means Expo accepted the request; a successful receipt means Apple/Google accepted the handoff. Neither proves a person saw it. Verify the actual device too.
5. Record platform, app/build version, attempt time, ticket/receipt outcome, and observed behavior in the release checklist. Don't paste push tokens or server secrets into public issues.

## Host committee sending process

1. An administrator completes the live tests, then grants selected host accounts `notifications:send`.
2. Open Committee announcements; confirm the displayed conference is active.
3. Enter a short title and clear message. Review the exact text and **all opted-in app devices** audience before sending.
4. Wait for the result and inspect delivery history. Do not send the same announcement again just because a response was slow. A reserved attempt prevents accidental duplicate requests; an uncertain result needs investigation.
5. Check receipts after 15 minutes and escalate errors to the full administrator. Review history is per host account, with administrator oversight.
6. At conference completion, clear the current program using Current Conference → No conference. This disables committee announcements. The administrator's single-device diagnostics remain available year round.

## Troubleshooting

| Symptom / error | What to check |
| --- | --- |
| No recipients | A user profile exists, its `settings.notifications` is true, and `expo_push_token` contains a current Expo token. Refresh registration on the device. |
| Registration fails | Native build/project ID, device network, OS permission, APNs/FCM native configuration. A failed refresh now preserves the previously saved token. |
| `InvalidCredentials` / `MismatchSenderId` | Check the EAS APNs/FCM credentials and Firebase project/application mapping. Rebuild if native configuration changed. |
| `UNAUTHORIZED` | Check Expo enhanced push security and `EXPO_ACCESS_TOKEN` in the service actually sending. |
| `DeviceNotRegistered` | Administrator should clear that obsolete token from the corresponding user profile; stop using it until the device registers again. Refresh on reinstall. The current delivery log does not automatically prune tokens. |
| Ticket accepted, no alert | Fetch receipts; check device permission, Focus, lock-screen settings, and Android channel. |
| Failed/partial/sending attempt | Inspect saved tickets and receipts before retrying. A network failure can leave the delivery outcome uncertain. Don't resend to the entire audience blindly. |
| History/configuration unavailable | Apply the migration and check server-only credentials. Sending is blocked when history cannot be reserved. |
| Existing event/service notifications fail | They use the separate `notification_service` Edge Function. Inspect its logs and deployed version, caller session, category notification preferences, and its own Expo access token configuration. The new dashboard history covers dashboard sends only. |

The app refreshes an already permitted token on startup, foreground, and native token changes. Profile creation and the diagnostics screen request permission when needed. Both `ExpoPushToken[…]` and `ExponentPushToken[…]` formats are accepted.

References: [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo tickets, receipts, and error codes](https://docs.expo.dev/push-notifications/sending-notifications/).

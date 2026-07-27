# YAAP conference control board

This Next.js app exists only to configure and support the attendee-facing
conference app.

It manages:

- Current conference and publication state
- Program events and categories
- Venue, amenities, food, activities, and attendee hospitality information
- App design, content, services, safety information, and feature flags
- Administrator and conference-staff access

It does not contain the former host-operation tools for registration,
geography, reports, panels, shifts, outreach, notifications, or volunteer
operations.

From the repository root:

```bash
pnpm setup:local
pnpm dev:admin:local
```

Open [http://localhost:3000](http://localhost:3000). Local setup provides
disposable email/password accounts and requires no production secrets.

Run its regression suite with:

```bash
pnpm e2e:admin
```

See the repository [local startup guide](../../docs/LOCAL_STARTUP.md) and
[E2E guide](../../docs/E2E_TESTING.md).

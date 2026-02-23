# On-Call Notification Integration Guide

## How to integrate on-call notifications

When a new request comes in for any service (accessibility, volunteers, hospitality, support), you need to call the appropriate notification function after successfully inserting the record.

### Example: Accessibility Request

In `/app/(tabs)/services/accessibility.tsx`, update the `handleSubmit` function:

```typescript
import { notifyAccessibilityOnCall } from "../../../lib/oncallNotifications"

const handleSubmit = async () => {
  // ... validation code ...

  try {
    const supabaseWithDeviceId = await withDeviceId()
    const { data, error } = await supabaseWithDeviceId
      .from("accessibility_forms")
      .insert({
        program_id: 3, // Use actual program ID
        // ... other fields ...
      })
      .select()
      .single()

    if (error) {
      console.error("Error submitting accessibility request:", error)
      return
    }

    // Send notification to on-call person
    if (data?.id) {
      await notifyAccessibilityOnCall(3, data.id)
    }

    // ... success handling ...
  } catch (error) {
    // ... error handling ...
  }
}
```

### Example: Volunteer Sign-up

```typescript
import { notifyVolunteerOnCall } from "../../../lib/oncallNotifications"

// After successful insert:
if (data?.id) {
  await notifyVolunteerOnCall(programId, data.id)
}
```

### Example: Hospitality Update

```typescript
import { notifyHospitalityOnCall } from "../../../lib/oncallNotifications"

// After successful insert:
if (data?.id) {
  await notifyHospitalityOnCall(programId, data.id)
}
```

### Example: Support Chat

```typescript
import { notifySupportOnCall } from "../../../lib/oncallNotifications"

// After successful insert:
if (data?.id) {
  await notifySupportOnCall(programId, data.id)
}
```

## Database Schema

The on-call system uses the following tables:

1. **oncall_assignments** - Stores which user is on-call for each service
2. **notification_logs** - Logs all notification attempts for auditing

## Permissions

- Only users with `admin` or `steering` roles can manage on-call assignments
- The on-call management page is at `/host/oncall`
- General push notifications are restricted to admin/steering roles only

## Notes

- Make sure users have push tokens stored in the `users` table
- The system uses Expo Push Notifications API
- Notifications are sent immediately when a new request comes in
- If no one is assigned on-call, no notification is sent (fails silently)
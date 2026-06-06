import { supabase } from "./supabase"

const NOTIFICATION_SERVICE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notification_service`
  : ""

/**
 * Send a notification using the Edge Function notification service
 * @param eventType The type of notification ('hospitality', 'schedule', or 'host')
 * @param programId The program ID
 * @param data Additional data to send with the notification
 * @param userId Optional user ID (required for schedule notifications)
 */
export async function sendNotification({
  eventType,
  programId,
  data,
  userId
}: {
  eventType: "hospitality" | "schedule" | "host" | "support"
  programId: number
  data: any
  userId?: number
}) {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      console.warn("Skipping notification send because no user session exists")
      return
    }

    if (!NOTIFICATION_SERVICE_URL) {
      console.error("Missing EXPO_PUBLIC_SUPABASE_URL for notification service")
      return
    }

    // Prepare the request body
    const body: any = {
      program_id: programId,
      event_type: eventType,
      data
    }

    // Add user_id if event type is schedule
    if (eventType === "schedule" && userId) {
      body.user_id = userId
    } else if (eventType === "schedule" && !userId) {
      console.error("userId is required for schedule notifications")
      return
    }

    const response = await fetch(NOTIFICATION_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error("Failed to send notification:", await response.text())
    } else {
      console.log(`Successfully sent ${eventType} notification`)
    }
  } catch (error) {
    console.error("Error sending notification:", error)
  }
}

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
  eventType: "hospitality" | "schedule" | "host"
  programId: number
  data: any
  userId?: number
}) {
  try {
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

    // Call the edge function
    const response = await fetch(
      "https://oolqeopfhhiuvsmamxln.supabase.co/functions/v1/notification_service",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " + btoa(`yaap:${process.env.EDGE_PASSWORD ?? "hacypaa9"}`)
        },
        body: JSON.stringify(body)
      }
    )

    if (!response.ok) {
      console.error("Failed to send notification:", await response.text())
    } else {
      console.log(`Successfully sent ${eventType} notification`)
    }
  } catch (error) {
    console.error("Error sending notification:", error)
  }
}

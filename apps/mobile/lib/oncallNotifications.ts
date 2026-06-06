import { withDeviceId } from "./supabase"

/**
 * Send push notification to on-call user for a service
 * This should be called when a new request comes in
 */
export async function notifyOnCallUser(
  serviceType: "accessibility" | "volunteers" | "hospitality" | "support",
  programId: number,
  requestId: string | number
) {
  try {
    const supabaseWithDeviceId = await withDeviceId()
    
    // Get the current on-call assignment
    const { data: assignment, error } = await supabaseWithDeviceId
      .from("oncall_assignments")
      .select("user_id")
      .eq("program_id", programId)
      .eq("service_type", serviceType)
      .eq("is_active", true)
      .single()

    if (error || !assignment) {
      console.log(`No on-call assignment found for ${serviceType}`)
      return
    }

    // Get user's push token from users table (using user_id which is a UUID)
    const { data: userData, error: userError } = await supabaseWithDeviceId
      .from("users")
      .select("expo_push_token")
      .eq("user_id", assignment.user_id)
      .single()

    if (userError || !userData?.expo_push_token) {
      console.log(`No push token found for on-call user`)
      return
    }

    // Prepare notification message
    let title = ""
    let body = ""
    
    switch (serviceType) {
      case "accessibility":
        title = "New Accessibility Request"
        body = "A new accessibility request has been submitted"
        break
      case "volunteers":
        title = "New Volunteer Sign-up"
        body = "Someone has signed up to volunteer"
        break
      case "hospitality":
        title = "New Hospitality Notification"
        body = "A hospitality update has been submitted"
        break
      case "support":
        title = "New Support Chat"
        body = "A new support chat message has been received"
        break
    }

    // Send push notification using Expo Push API
    const message = {
      to: userData.expo_push_token,
      sound: "default",
      title: title,
      body: body,
      data: {
        service_type: serviceType,
        request_id: requestId
      },
      priority: "high",
      badge: 1
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    })

    const result = await response.json()
    
    // Log notification attempt
    await supabaseWithDeviceId
      .from("notification_logs")
      .insert({
        program_id: programId,
        user_id: assignment.user_id,
        notification_type: "oncall",
        service_type: serviceType,
        request_id: requestId.toString(),
        status: result.data?.status || "failed",
        error_message: result.data?.message
      })

    console.log(`Notification sent to on-call user for ${serviceType}`)
    
  } catch (error) {
    console.error("Error sending on-call notification:", error)
  }
}

/**
 * Helper to call when new accessibility request comes in
 */
export function notifyAccessibilityOnCall(programId: number, requestId: string | number) {
  return notifyOnCallUser("accessibility", programId, requestId)
}

/**
 * Helper to call when new volunteer sign-up comes in
 */
export function notifyVolunteerOnCall(programId: number, requestId: string | number) {
  return notifyOnCallUser("volunteers", programId, requestId)
}

/**
 * Helper to call when new hospitality notification comes in
 */
export function notifyHospitalityOnCall(programId: number, requestId: string | number) {
  return notifyOnCallUser("hospitality", programId, requestId)
}

/**
 * Helper to call when new support chat comes in
 */
export function notifySupportOnCall(programId: number, requestId: string | number) {
  return notifyOnCallUser("support", programId, requestId)
}

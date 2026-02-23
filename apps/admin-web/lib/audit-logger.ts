import { createClient } from "@/utils/supabase/server"

export interface ActivityLogData {
  actionType:
    | "create_panel"
    | "update_panel"
    | "delete_panel"
    | "send_panel_notification"
    | "send_panel_reminder"
    | "send_panel_reminder2"
    | "confirm_panel_participation"
    | "withdraw_panel_participation"
    | "create_program"
    | "update_program"
    | "create_program_event"
    | "update_program_event"
    | "delete_program_event"
    | "create_event_category"
    | "update_event_category"
    | "delete_event_category"
    | "import_panels"
    | "export_data"
    | "update_user_role"
    | "update_notification_status"
    | "user_login"
    | "user_logout"
    // Volunteer-related actions
    | "send_volunteer_notification"
    | "send_volunteer_test_notification"
    | "update_volunteer_status"
    | "update_volunteer_notification"
    | "delete_volunteer_notification"
    // Chairperson-related actions
    | "create_chairperson"
    | "update_chairperson"
    | "delete_chairperson"
    | "link_chairperson_to_user"
    // On-call related actions
    | "create_oncall_schedule"
    | "update_oncall_schedule"
    | "delete_oncall_schedule"

  metadata?: Record<string, any>
}

export async function logActivity(data: ActivityLogData): Promise<void> {
  console.log("\n\n\n\nLogging activity 1")
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      console.warn("Cannot log activity: No authenticated user")
      return
    }

    // Insert activity log
    console.log("Logging activity:", data)
    const { error: insertError } = await supabase.from("activity").insert({
      user: user.id,
      action: data.actionType,
      metadata: data.metadata
    })

    if (insertError) {
      console.error("Failed to log activity:", insertError)
      // Don't throw error to prevent breaking the main operation
    }
  } catch (error) {
    console.error("Error in logActivity:", error)
    // Don't throw error to prevent breaking the main operation
  }
}

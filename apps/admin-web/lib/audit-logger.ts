import { createClient } from "@/utils/supabase/server"

export interface ActivityLogData {
  actionType:
    | "create_program"
    | "update_program"
    | "create_program_event"
    | "update_program_event"
    | "delete_program_event"
    | "create_event_category"
    | "update_event_category"
    | "delete_event_category"
    | "update_user_role"
    | "remove_user_role"

  metadata?: Record<string, unknown>
}

export async function logActivity(data: ActivityLogData): Promise<void> {
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

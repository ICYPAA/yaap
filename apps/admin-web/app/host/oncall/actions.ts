"use server"

import { createClient } from "@/utils/supabase/server"

export interface OncallSchedule {
  id: number
  user_id: string
  display_name?: string
  discord_username?: string
  avatar_url?: string
  start_time: string
  end_time: string
  phone?: string | null
  created_at: string
}

// Get all oncall schedules (public)
export async function getOncallSchedules() {
  try {
    // Use service role for public read access
    const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Get oncall schedules with user info
    const { data, error } = await supabase
      .from("oncall_schedules")
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        phone,
        created_at
      `)
      .order("start_time", { ascending: true })

    if (error) {
      console.error("Error fetching oncall schedules:", error)
      return []
    }

    // Get user info for each schedule
    const schedulesWithUsers = await Promise.all(
      (data || []).map(async (schedule) => {
        // Get user profile from auth.users
        const { data: userData } = await supabase.auth.admin.getUserById(schedule.user_id)
        
        return {
          ...schedule,
          display_name: userData?.user?.user_metadata?.name || 
                       userData?.user?.user_metadata?.full_name || 
                       userData?.user?.email?.split('@')[0] || 
                       "Unknown User",
          discord_username: userData?.user?.user_metadata?.custom_claims?.global_name ||
                          userData?.user?.user_metadata?.provider_id ||
                          null,
          avatar_url: userData?.user?.user_metadata?.avatar_url || null
        } as OncallSchedule
      })
    )

    return schedulesWithUsers
  } catch (error) {
    console.error("Error in getOncallSchedules:", error)
    return []
  }
}

// Add oncall schedule (host members only)
export async function addOncallSchedule(data: {
  start_time: string
  end_time: string
  phone?: string | null
}) {
  const supabase = await createClient()
  
  // Check if user is authenticated (host auth is handled by middleware)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "You must be logged in to add an oncall schedule" }
  }

  try {
    // First, check if table exists and create if needed
    const { error: tableError } = await supabase
      .from("oncall_schedules")
      .select("id")
      .limit(1)
    
    if (tableError && tableError.code === "42P01") {
      // Table doesn't exist, create it
      const { error: createError } = await supabase.rpc('create_oncall_table')
      if (createError && createError.code !== "42710") { // 42710 = table already exists
        console.error("Error creating oncall table:", createError)
        return { error: "Failed to initialize oncall system" }
      }
    }

    // Add the schedule
    const { error } = await supabase
      .from("oncall_schedules")
      .insert({
        user_id: user.id,
        start_time: data.start_time,
        end_time: data.end_time,
        phone: data.phone
      })

    if (error) {
      console.error("Error adding oncall schedule:", error)
      return { error: "Failed to add oncall schedule" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in addOncallSchedule:", error)
    return { error: "Failed to add oncall schedule" }
  }
}

// Update oncall schedule (only own schedule)
export async function updateOncallSchedule(id: number, data: {
  start_time: string
  end_time: string
  phone?: string | null
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if this is the user's schedule
    const { data: schedule, error: fetchError } = await supabase
      .from("oncall_schedules")
      .select("user_id")
      .eq("id", id)
      .single()

    if (fetchError || !schedule) {
      return { error: "Schedule not found" }
    }

    if (schedule.user_id !== user.id) {
      return { error: "You can only edit your own schedules" }
    }

    // Update the schedule
    const { error } = await supabase
      .from("oncall_schedules")
      .update({
        start_time: data.start_time,
        end_time: data.end_time,
        phone: data.phone
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating oncall schedule:", error)
      return { error: "Failed to update schedule" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateOncallSchedule:", error)
    return { error: "Failed to update schedule" }
  }
}

// Delete oncall schedule (only own schedule)
export async function deleteOncallSchedule(id: number) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if this is the user's schedule
    const { data: schedule, error: fetchError } = await supabase
      .from("oncall_schedules")
      .select("user_id")
      .eq("id", id)
      .single()

    if (fetchError || !schedule) {
      return { error: "Schedule not found" }
    }

    if (schedule.user_id !== user.id) {
      return { error: "You can only delete your own schedules" }
    }

    // Delete the schedule
    const { error } = await supabase
      .from("oncall_schedules")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting oncall schedule:", error)
      return { error: "Failed to delete schedule" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteOncallSchedule:", error)
    return { error: "Failed to delete schedule" }
  }
}
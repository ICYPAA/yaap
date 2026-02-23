"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Helper function to check if user has permission to edit/delete
export async function checkEditPermission() {
  const supabase = await createClient()
  
  // Check if user has admin, steering role or volunteering:sensitive permission
  const { data: userRoles } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!userRoles) return false
  
  return (
    userRoles.role === "admin" ||
    userRoles.role === "steering" ||
    (userRoles.permissions && userRoles.permissions.includes("volunteering:sensitive"))
  )
}

// Helper function to fetch all volunteer interest records
export async function getVolunteerInterest() {
  const supabase = await createClient()

  // Call the custom security function using RPC
  const { data, error } = await supabase
    .rpc("get_volunteering_interest_safe")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching volunteer interest data:", error)
    throw new Error("Failed to fetch volunteer interest data")
  }

  // Define the volunteer interest record type
  interface VolunteerInterestRecord {
    id: string | number
    name: string
    last_initial: string
    email: string | null
    phone: string | null
    type: string
    data: any
    status: string
    created_at: string
  }

  // Check if user has access to sensitive data by examining if email/phone are accessible
  // If any record has non-null email or phone, the user has access
  const hasAccessToSensitive =
    data &&
    data.length > 0 &&
    data.some(
      (record: VolunteerInterestRecord) =>
        record.email !== null || record.phone !== null
    )
  
  // Check if user can edit/delete
  const canEdit = await checkEditPermission()

  return {
    data,
    hasAccessToSensitive,
    canEdit
  }
}

// Helper function to update a volunteer interest record's status
export async function updateVolunteerStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("volunteering_interest")
    .update({ status })
    .eq("id", id)

  if (error) {
    console.error("Error updating volunteer status:", error)
    throw new Error("Failed to update volunteer status")
  }

  return { success: true }
}

// Helper function to delete a volunteer interest record
export async function deleteVolunteerInterest(id: string) {
  const supabase = await createClient()
  
  // Check permission first
  const hasPermission = await checkEditPermission()
  if (!hasPermission) {
    throw new Error("You don't have permission to delete volunteer records")
  }

  const { error } = await supabase
    .from("volunteering_interest")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting volunteer interest:", error)
    throw new Error("Failed to delete volunteer interest")
  }

  // Revalidate the page to ensure fresh data
  revalidatePath("/host/volunteer-interest")
  
  return { success: true }
}

// Helper function to update a volunteer interest record
export async function updateVolunteerInterest(id: string, updates: {
  name?: string
  last_initial?: string
  phone?: string
  email?: string
  status?: string
  data?: any
}) {
  const supabase = await createClient()
  
  // Check permission first
  const hasPermission = await checkEditPermission()
  if (!hasPermission) {
    throw new Error("You don't have permission to edit volunteer records")
  }

  const { error } = await supabase
    .from("volunteering_interest")
    .update(updates)
    .eq("id", id)

  if (error) {
    console.error("Error updating volunteer interest:", error)
    throw new Error("Failed to update volunteer interest")
  }

  return { success: true }
}

// Get security time slot assignments
export async function getSecurityTimeSlotAssignments() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("security_time_slot_assignments")
    .select("*")
    .order("day", { ascending: true })
    .order("block", { ascending: true })
    .order("slot", { ascending: true })

  if (error) {
    console.error("Error fetching security time slot assignments:", error)
    throw new Error("Failed to fetch security time slot assignments")
  }

  return data || []
}

// Add a security time slot assignment
export async function addSecurityTimeSlotAssignment(
  volunteerId: string,
  volunteerName: string,
  day: string,
  block: string,
  slot: string
) {
  const supabase = await createClient()
  
  // Check permission first
  const hasPermission = await checkEditPermission()
  if (!hasPermission) {
    throw new Error("You don't have permission to manage time slot assignments")
  }

  const { data: userData } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from("security_time_slot_assignments")
    .insert({
      volunteer_id: volunteerId,
      volunteer_name: volunteerName,
      day,
      block,
      slot,
      assigned_by: userData.user?.id
    })

  if (error) {
    console.error("Error adding security time slot assignment:", error)
    if (error.code === '23505') { // Unique constraint violation
      throw new Error("This volunteer is already assigned to this time slot")
    }
    throw new Error("Failed to add security time slot assignment")
  }

  return { success: true }
}

// Remove a security time slot assignment
export async function removeSecurityTimeSlotAssignment(assignmentId: string) {
  const supabase = await createClient()
  
  // Check permission first
  const hasPermission = await checkEditPermission()
  if (!hasPermission) {
    throw new Error("You don't have permission to manage time slot assignments")
  }

  const { error } = await supabase
    .from("security_time_slot_assignments")
    .delete()
    .eq("id", assignmentId)

  if (error) {
    console.error("Error removing security time slot assignment:", error)
    throw new Error("Failed to remove security time slot assignment")
  }

  return { success: true }
}

"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export interface LinkedAccount {
  id: string
  email: string | null
  phone: string | null
  profile_name: string | null
  discord_name?: string | null
  discord_server_name?: string | null
  linked_volunteer_id?: number | null
  linked_chairperson_id?: number | null
  volunteer_name?: string | null
  chairperson_name?: string | null
}

export interface Volunteer {
  id: number
  name: string
  email: string | null
  phone: string | null
  type?: string
}

export interface Chairperson {
  id: number
  name: string
  phone: string | null
  panel_name: string
  day_time: string
  user_id?: string | null
}

// Check if user has permission to access account linking
export async function checkAccountLinkingPermission() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check if user is admin or steering
  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  if (roleError || !roleData) {
    return false
  }
  
  return roleData.role === "admin" || roleData.role === "steering"
}


// Get all auth users with their linked accounts
export async function getUsersWithLinkedAccounts() {
  const supabase = await createClient()
  
  // Check permissions
  const hasPermission = await checkAccountLinkingPermission()
  if (!hasPermission) {
    return { error: "Insufficient permissions. Only admins and steering members can access account linking." }
  }

  try {
    // Use service role to get all auth users
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Service role key not found!")
      return { error: "Configuration error - service role key missing" }
    }
    
    const adminClient = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Get all auth users
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    
    if (authError) {
      console.error("Error fetching auth users:", authError)
      return { error: "Failed to fetch user data" }
    }

    const authUsers = authData?.users || []

    // Get all chairpeople
    const { data: chairpeople, error: chairError } = await supabase
      .from("panel_chairpeople")
      .select("*")
      .order("name")
    
    if (chairError) {
      console.error("Error fetching chairpeople:", chairError)
    }

    // Get all volunteers
    const { data: volunteers, error: volunteerError } = await supabase
      .from("volunteering_interest")
      .select("*")
      .order("name")
    
    if (volunteerError) {
      console.error("Error fetching volunteers:", volunteerError)
    }

    // Get Discord server nicknames from profile-names table
    const { data: profileNames, error: profileError } = await supabase
      .from("profile-names")
      .select("user_id, profile_name")
    
    if (profileError) {
      console.error("Error fetching profile names:", profileError)
    }
    
    // Re-fetch profile names after any updates
    const { data: updatedProfileNames } = await supabase
      .from("profile-names")
      .select("user_id, profile_name")
    
    const finalProfileNames = updatedProfileNames || profileNames

    // Map auth users with their linked accounts
    const linkedAccounts: LinkedAccount[] = authUsers.map((authUser) => {
      // Extract phone from user metadata if available
      const phone = authUser.user_metadata?.phone || 
                   authUser.user_metadata?.phone_number || 
                   authUser.phone || 
                   null
      
      // Find potential matches by email or phone
      const volunteerMatch = volunteers?.find(v => 
        (v.email && authUser.email && v.email.toLowerCase() === authUser.email.toLowerCase()) ||
        (v.phone && phone && normalizePhone(v.phone) === normalizePhone(phone))
      )
      
      // Find chairperson by phone match (chairpeople don't have emails)
      const chairpersonMatch = chairpeople?.find(c => 
        c.phone && phone && normalizePhone(c.phone) === normalizePhone(phone)
      )

      // Get Discord server nickname if available
      const profileName = finalProfileNames?.find(p => p.user_id === authUser.id)
      const discordName = authUser.user_metadata?.full_name || 
                         authUser.user_metadata?.name ||
                         authUser.user_metadata?.custom_claims?.global_name ||
                         null

      return {
        id: authUser.id,
        email: authUser.email || null,
        phone: phone,
        profile_name: authUser.user_metadata?.full_name || 
                     authUser.user_metadata?.name ||
                     authUser.user_metadata?.custom_claims?.global_name ||
                     null,
        discord_name: discordName,
        discord_server_name: profileName?.profile_name || null,
        linked_volunteer_id: volunteerMatch?.id || null,
        linked_chairperson_id: chairpersonMatch?.id || null,
        volunteer_name: volunteerMatch?.name || null,
        chairperson_name: chairpersonMatch?.name || null
      }
    })

    return { 
      users: linkedAccounts,
      volunteers: volunteers || [],
      chairpeople: chairpeople || []
    }
  } catch (error) {
    console.error("Error in getUsersWithLinkedAccounts:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Get unlinked volunteers and chairpeople
export async function getUnlinkedRecords() {
  const supabase = await createClient()
  
  // Check permissions
  const hasPermission = await checkAccountLinkingPermission()
  if (!hasPermission) {
    return { error: "Insufficient permissions." }
  }

  try {
    // Get ALL chairpeople
    const { data: chairpeople, error: chairError } = await supabase
      .from("panel_chairpeople")
      .select("*")
      .order("name")
    
    if (chairError) {
      console.error("Error fetching chairpeople:", chairError)
    }

    // Get all volunteers
    const { data: volunteers, error: volunteerError } = await supabase
      .from("volunteering_interest")
      .select("*")
      .order("name")
    
    if (volunteerError) {
      console.error("Error fetching volunteers:", volunteerError)
    }

    // Get auth users to check for phone/email matches
    const adminClient = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: authData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    
    const authEmails = new Set((authData?.users || []).map(u => u.email?.toLowerCase()))
    const authPhones = new Set((authData?.users || []).map(u => {
      const phone = u.user_metadata?.phone || u.user_metadata?.phone_number || u.phone
      return phone ? normalizePhone(phone) : null
    }).filter(Boolean))
    
    // Filter chairpeople to find those not linked (no phone match with auth users)
    const unlinkedChairpeopleAll = (chairpeople || []).filter(c => {
      if (!c.phone) return true // If no phone, can't be linked
      const phoneLinked = authPhones.has(normalizePhone(c.phone))
      return !phoneLinked
    })
    
    // Deduplicate chairpeople by phone number - keep only one per unique phone
    const phoneToChairperson = new Map<string, any>()
    unlinkedChairpeopleAll.forEach(c => {
      const key = c.phone ? normalizePhone(c.phone) : `no-phone-${c.id}`
      // Keep the first one we find for each phone number
      if (!phoneToChairperson.has(key)) {
        // Remove panel-specific info for deduplicated display
        phoneToChairperson.set(key, {
          ...c,
          panel_name: undefined,
          day_time: undefined,
          panel_id: undefined
        })
      }
    })
    const unlinkedChairpeople = Array.from(phoneToChairperson.values())
    
    // Filter volunteers to find those not linked (no email or phone match)
    const unlinkedVolunteersAll = (volunteers || []).filter(v => {
      const emailLinked = v.email && authEmails.has(v.email.toLowerCase())
      const phoneLinked = v.phone && authPhones.has(normalizePhone(v.phone))
      return !emailLinked && !phoneLinked
    })
    
    // Deduplicate volunteers by email+phone combination
    const volunteerKey = (v: any) => {
      const email = v.email?.toLowerCase() || 'no-email'
      const phone = v.phone ? normalizePhone(v.phone) : 'no-phone'
      return `${email}-${phone}`
    }
    const volunteerMap = new Map<string, any>()
    unlinkedVolunteersAll.forEach(v => {
      const key = volunteerKey(v)
      // Keep the first one we find for each combination
      if (!volunteerMap.has(key)) {
        volunteerMap.set(key, v)
      }
    })
    const unlinkedVolunteers = Array.from(volunteerMap.values())

    return {
      unlinkedChairpeople: unlinkedChairpeople,
      unlinkedVolunteers: unlinkedVolunteers
    }
  } catch (error) {
    console.error("Error in getUnlinkedRecords:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Link a chairperson to a user account by updating the user's phone to match
export async function linkChairpersonToUser(chairpersonId: number, userId: string) {
  const supabase = await createClient()
  
  // Check permissions
  const hasPermission = await checkAccountLinkingPermission()
  if (!hasPermission) {
    return { error: "Insufficient permissions." }
  }

  try {
    // Get the chairperson's phone number
    const { data: chairperson, error: chairError } = await supabase
      .from("panel_chairpeople")
      .select("phone")
      .eq("id", chairpersonId)
      .single()
    
    if (chairError || !chairperson) {
      console.error("Error fetching chairperson:", chairError)
      return { error: "Failed to fetch chairperson data" }
    }
    
    if (!chairperson.phone) {
      return { error: "Chairperson has no phone number to link" }
    }
    
    // Update the user's phone metadata to match the chairperson
    const adminClient = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { phone: chairperson.phone }
    })
    
    if (updateError) {
      console.error("Error updating user phone:", updateError)
      return { error: "Failed to link chairperson to user" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in linkChairpersonToUser:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Unlink a chairperson from a user account by removing the user's phone
export async function unlinkChairpersonFromUser(chairpersonId: number, userId: string) {
  // Check permissions
  const hasPermission = await checkAccountLinkingPermission()
  if (!hasPermission) {
    return { error: "Insufficient permissions." }
  }

  try {
    // Clear the user's phone metadata
    const adminClient = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { phone: null }
    })
    
    if (updateError) {
      console.error("Error clearing user phone:", updateError)
      return { error: "Failed to unlink chairperson from user" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in unlinkChairpersonFromUser:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Update user phone number in metadata
export async function updateUserPhone(userId: string, phone: string | null) {
  // Check permissions
  const hasPermission = await checkAccountLinkingPermission()
  if (!hasPermission) {
    return { error: "Insufficient permissions." }
  }

  try {
    // Use service role to update user metadata
    const adminClient = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { phone: phone }
    })
    
    if (error) {
      console.error("Error updating user phone:", error)
      return { error: "Failed to update user phone number" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateUserPhone:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Helper function to normalize phone numbers for comparison
function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  let normalized = phone.replace(/\D/g, "")
  
  // Remove leading country code (1) if the number is 11 digits
  if (normalized.length === 11 && normalized.startsWith("1")) {
    normalized = normalized.substring(1)
  }
  
  return normalized
}

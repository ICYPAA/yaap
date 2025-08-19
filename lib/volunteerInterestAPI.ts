import { supabase } from "./supabase"

// Types for volunteering interest
export interface VolunteeringInterest {
  id: string
  created_at: string
  name: string | null
  last_initial: string | null
  phone: string | null
  email: string | null
  type: string | null
  data: any | null
  program_id: number | null
  status: string
}

export type VolunteerStatus = 'pending' | 'approved' | 'rejected' | 'contacted'

// Fetch all volunteer interest records
export async function getAllVolunteerInterest(programId?: number): Promise<VolunteeringInterest[]> {
  let query = supabase
    .from("volunteering_interest")
    .select("*")
    .order("created_at", { ascending: false })
  
  if (programId) {
    query = query.eq("program_id", programId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("Error fetching volunteer interest:", error)
    throw error
  }
  
  return data || []
}

// Fetch volunteer interest by status
export async function getVolunteerInterestByStatus(
  status: VolunteerStatus,
  programId?: number
): Promise<VolunteeringInterest[]> {
  let query = supabase
    .from("volunteering_interest")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
  
  if (programId) {
    query = query.eq("program_id", programId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("Error fetching volunteer interest by status:", error)
    throw error
  }
  
  return data || []
}

// Update volunteer interest status
export async function updateVolunteerStatus(
  id: string,
  status: VolunteerStatus
): Promise<VolunteeringInterest> {
  const { data, error } = await supabase
    .from("volunteering_interest")
    .update({ status })
    .eq("id", id)
    .select()
    .single()
  
  if (error) {
    console.error("Error updating volunteer status:", error)
    throw error
  }
  
  return data
}

// Update volunteer interest data (for notes, etc.)
export async function updateVolunteerData(
  id: string,
  data: any
): Promise<VolunteeringInterest> {
  const { data: result, error } = await supabase
    .from("volunteering_interest")
    .update({ data })
    .eq("id", id)
    .select()
    .single()
  
  if (error) {
    console.error("Error updating volunteer data:", error)
    throw error
  }
  
  return result
}

// Delete volunteer interest record
export async function deleteVolunteerInterest(id: string): Promise<void> {
  const { error } = await supabase
    .from("volunteering_interest")
    .delete()
    .eq("id", id)
  
  if (error) {
    console.error("Error deleting volunteer interest:", error)
    throw error
  }
}

// Batch update multiple volunteer statuses
export async function batchUpdateVolunteerStatus(
  ids: string[],
  status: VolunteerStatus
): Promise<VolunteeringInterest[]> {
  const { data, error } = await supabase
    .from("volunteering_interest")
    .update({ status })
    .in("id", ids)
    .select()
  
  if (error) {
    console.error("Error batch updating volunteer status:", error)
    throw error
  }
  
  return data || []
}

// Search volunteers by name or email
export async function searchVolunteers(
  searchTerm: string,
  programId?: number
): Promise<VolunteeringInterest[]> {
  let query = supabase
    .from("volunteering_interest")
    .select("*")
  
  if (programId) {
    query = query.eq("program_id", programId)
  }
  
  // Search in name or email fields
  query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
  
  const { data, error } = await query.order("created_at", { ascending: false })
  
  if (error) {
    console.error("Error searching volunteers:", error)
    throw error
  }
  
  return data || []
}

// Get volunteer statistics
export async function getVolunteerStats(programId?: number): Promise<{
  total: number
  pending: number
  approved: number
  rejected: number
  contacted: number
}> {
  let query = supabase
    .from("volunteering_interest")
    .select("status", { count: 'exact' })
  
  if (programId) {
    query = query.eq("program_id", programId)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    console.error("Error fetching volunteer stats:", error)
    throw error
  }
  
  const stats = {
    total: count || 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    contacted: 0
  }
  
  if (data) {
    data.forEach((record) => {
      switch (record.status) {
        case 'pending':
          stats.pending++
          break
        case 'approved':
          stats.approved++
          break
        case 'rejected':
          stats.rejected++
          break
        case 'contacted':
          stats.contacted++
          break
      }
    })
  }
  
  return stats
}
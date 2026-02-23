"use server"

import { createClient } from "@/utils/supabase/server"
import { type CleanupEntry } from "@/utils/xlsx-cleanup-parser"

interface CleanupVolunteer {
  id: string
  name: string
  last_initial: string
  phone: string | null
  email: string | null
  type: "cleanup"
  status: string
  data: {
    location: string
    date: string
    time: string
    comments?: string
  }
  created_at: string
  updated_at: string
}

export async function getCleanupVolunteers(): Promise<CleanupVolunteer[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("volunteering_interest")
    .select("*")
    .eq("type", "cleanup")
    .order("data->date", { ascending: true })

  if (error) {
    console.error("Error fetching cleanup volunteers:", error)
    return []
  }

  return data || []
}

export async function upsertCleanupVolunteers(entries: CleanupEntry[]): Promise<{
  inserted: number
  updated: number
  errors: string[]
}> {
  const supabase = await createClient()
  const results = {
    inserted: 0,
    updated: 0,
    errors: [] as string[]
  }

  for (const entry of entries) {
    try {
      // Create unique key from name, date, and time for duplicate detection
      const { data: existing } = await supabase
        .from("volunteering_interest")
        .select("id")
        .eq("type", "cleanup")
        .eq("name", entry.name)
        .eq("last_initial", entry.last_initial)
        .eq("data->date", entry.date)
        .eq("data->time", entry.time)
        .single()

      const volunteerData = {
        name: entry.name,
        last_initial: entry.last_initial,
        phone: entry.phone || null,
        email: null,
        type: "cleanup" as const,
        status: "pending",
        data: {
          location: entry.location,
          date: entry.date,
          time: entry.time,
          comments: ""
        }
      }

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from("volunteering_interest")
          .update({
            ...volunteerData,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id)

        if (error) {
          results.errors.push(`Failed to update ${entry.name}: ${error.message}`)
        } else {
          results.updated++
        }
      } else {
        // Insert new entry
        const { error } = await supabase
          .from("volunteering_interest")
          .insert(volunteerData)

        if (error) {
          results.errors.push(`Failed to insert ${entry.name}: ${error.message}`)
        } else {
          results.inserted++
        }
      }
    } catch (error) {
      results.errors.push(`Error processing ${entry.name}: ${error}`)
    }
  }

  return results
}

export async function updateCleanupVolunteer(
  id: string, 
  updates: Partial<CleanupVolunteer>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("volunteering_interest")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteCleanupVolunteer(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("volunteering_interest")
    .delete()
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
"use server"

import { createClient } from "@/utils/supabase/server"
import { type GreeterEntry } from "@/utils/xlsx-greeter-parser"

interface GreeterVolunteer {
  id: string
  name: string
  last_initial: string
  phone: string | null
  email: string | null
  type: "greeter"
  status: string
  data: {
    day: string
    time: string
    room: string
    meeting?: string
    notes?: string
    comments?: string
  }
  created_at: string
  updated_at: string
}

export async function getGreeterVolunteers(): Promise<GreeterVolunteer[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("volunteering_interest")
    .select("*")
    .eq("type", "greeter")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching greeter volunteers:", error)
    return []
  }

  return data || []
}

export async function upsertGreeterVolunteers(entries: GreeterEntry[]): Promise<{
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
      // Create unique key from type, phone, day, and time
      // First check if this entry already exists
      const { data: existing } = await supabase
        .from("volunteering_interest")
        .select("id")
        .eq("type", "greeter")
        .eq("phone", entry.phone_number || "")
        .eq("data->day", entry.day)
        .eq("data->time", entry.time)
        .single()

      const volunteerData = {
        name: entry.name,
        last_initial: entry.last_initial || entry.name.charAt(0).toUpperCase(),
        phone: entry.phone_number || null,
        email: null,
        type: "greeter" as const,
        status: entry.status || "pending",
        data: {
          day: entry.day,
          time: entry.time,
          room: entry.room,
          meeting: entry.meeting,
          notes: entry.notes,
          comments: entry.notes
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

export async function updateGreeterVolunteer(
  id: string, 
  updates: Partial<GreeterVolunteer>
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

export async function deleteGreeterVolunteer(id: string): Promise<{ success: boolean; error?: string }> {
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
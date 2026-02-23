"use server"

import { createClient } from "@/utils/supabase/server"

// Helper function to fetch an event by ID
export async function getEvent(eventId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("pre-conf-events")
    .select("*")
    .eq("id", eventId)
    .single()

  if (error) throw error
  return data
}

// Helper function to fetch all events
export async function getEvents() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("pre-conf-events")
    .select("*")
    .eq("is_icypaa_event", true)
    .order("date", { ascending: true })

  if (error) throw error
  return data || []
}

// Helper function to get volunteering data for an event
export async function getVolunteeringData(eventId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("volunteering")
    .select("*")
    .eq("event_id", eventId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No record found
      throw new Error("No volunteering data found for this event")
    }
    throw error
  }

  return data
}

const DEFAULT_VOLUNTEERING_JOBS = [
  {
    name: "Security",
    description: "Monitor entrances and check IDs",
    time_slots: []
  },
  {
    name: "Setup",
    description: "Help set up the venue before the event",
    time_slots: []
  },
  {
    name: "Cleanup",
    description: "Help clean up after the event",
    time_slots: []
  },
  {
    name: "Registration",
    description: "Help with registration and check-in",
    time_slots: []
  },
  {
    name: "Outreach Table",
    description: "Staff the outreach and information table",
    time_slots: []
  },
  {
    name: "Literature",
    description: "Manage literature and materials",
    time_slots: []
  }
]

// Helper function to create new volunteering data
export async function createVolunteeringData(eventId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("volunteering")
    .insert({
      event_id: eventId,
      jobs: DEFAULT_VOLUNTEERING_JOBS
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Helper function to update volunteering data
export async function updateVolunteeringData(eventId: string, jobs: any) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("volunteering")
    .update({
      jobs,
      updated_at: new Date().toISOString()
    })
    .eq("event_id", eventId)
    .select()
    .single()

  if (error) throw error
  return data
}

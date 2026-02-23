import { supabase } from "./supabase"

// Types to match the website's volunteering structure
export interface VolunteerSignup {
  id: string
  name: string
  last_initial: string
  phone: string
  email: string
}

export interface TimeSlot {
  time: string
  max_volunteers: number
  current_volunteers: VolunteerSignup[]
}

export interface VolunteerJob {
  name: string
  description: string
  time_slots: TimeSlot[]
}

export interface VolunteeringData {
  id: string
  event_id: string
  jobs: VolunteerJob[]
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  time: string
  location: string
  is_icypaa_event: boolean
}

// Default volunteer jobs (matches website structure)
const DEFAULT_VOLUNTEERING_JOBS: VolunteerJob[] = [
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

// Fetch all ICYPAA events
export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("pre-conf-events")
    .select("*")
    .eq("is_icypaa_event", true)
    .order("date", { ascending: true })

  if (error) throw error
  return data || []
}

// Fetch a specific event by ID
export async function getEvent(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from("pre-conf-events")
    .select("*")
    .eq("id", eventId)
    .single()

  if (error) throw error
  return data
}

// Fetch volunteering data for a specific event
export async function getVolunteeringData(
  eventId: string
): Promise<VolunteeringData> {
  const { data, error } = await supabase
    .from("volunteering")
    .select("*")
    .eq("event_id", eventId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("No volunteering data found for this event")
    }
    throw error
  }

  return data
}

// Create new volunteering data for an event
export async function createVolunteeringData(
  eventId: string
): Promise<VolunteeringData> {
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

// Update volunteering data for an event
export async function updateVolunteeringData(
  eventId: string,
  jobs: VolunteerJob[]
): Promise<VolunteeringData> {
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

// Get or create volunteering data for an event
export async function getOrCreateVolunteeringData(
  eventId: string
): Promise<VolunteeringData> {
  try {
    return await getVolunteeringData(eventId)
  } catch (error) {
    // If no data exists, create it
    if (
      error instanceof Error &&
      error.message.includes("No volunteering data found")
    ) {
      return await createVolunteeringData(eventId)
    }
    throw error
  }
}

// Add a volunteer to a specific job and time slot
export async function addVolunteerToTimeSlot(
  eventId: string,
  jobName: string,
  timeSlotTime: string,
  volunteer: VolunteerSignup
): Promise<VolunteeringData> {
  const volunteeringData = await getVolunteeringData(eventId)

  // Find the job and time slot
  const jobIndex = volunteeringData.jobs.findIndex(
    (job) => job.name === jobName
  )
  if (jobIndex === -1) {
    throw new Error(`Job ${jobName} not found`)
  }

  const timeSlotIndex = volunteeringData.jobs[jobIndex].time_slots.findIndex(
    (slot) => slot.time === timeSlotTime
  )
  if (timeSlotIndex === -1) {
    throw new Error(`Time slot ${timeSlotTime} not found`)
  }

  // Check if volunteer is already signed up
  const existingVolunteer = volunteeringData.jobs[jobIndex].time_slots[
    timeSlotIndex
  ].current_volunteers.find((v) => v.email === volunteer.email)

  if (existingVolunteer) {
    throw new Error("Volunteer is already signed up for this time slot")
  }

  // Check if time slot is full
  const currentVolunteers =
    volunteeringData.jobs[jobIndex].time_slots[timeSlotIndex].current_volunteers
  const maxVolunteers =
    volunteeringData.jobs[jobIndex].time_slots[timeSlotIndex].max_volunteers

  if (currentVolunteers.length >= maxVolunteers) {
    throw new Error("Time slot is full")
  }

  // Add volunteer to time slot
  volunteeringData.jobs[jobIndex].time_slots[
    timeSlotIndex
  ].current_volunteers.push(volunteer)

  // Update in database
  return await updateVolunteeringData(eventId, volunteeringData.jobs)
}

// Remove a volunteer from a specific job and time slot
export async function removeVolunteerFromTimeSlot(
  eventId: string,
  jobName: string,
  timeSlotTime: string,
  volunteerEmail: string
): Promise<VolunteeringData> {
  const volunteeringData = await getVolunteeringData(eventId)

  // Find the job and time slot
  const jobIndex = volunteeringData.jobs.findIndex(
    (job) => job.name === jobName
  )
  if (jobIndex === -1) {
    throw new Error(`Job ${jobName} not found`)
  }

  const timeSlotIndex = volunteeringData.jobs[jobIndex].time_slots.findIndex(
    (slot) => slot.time === timeSlotTime
  )
  if (timeSlotIndex === -1) {
    throw new Error(`Time slot ${timeSlotTime} not found`)
  }

  // Remove volunteer from time slot
  volunteeringData.jobs[jobIndex].time_slots[timeSlotIndex].current_volunteers =
    volunteeringData.jobs[jobIndex].time_slots[
      timeSlotIndex
    ].current_volunteers.filter((v) => v.email !== volunteerEmail)

  // Update in database
  return await updateVolunteeringData(eventId, volunteeringData.jobs)
}

// Add a new time slot to a job
export async function addTimeSlotToJob(
  eventId: string,
  jobName: string,
  timeSlot: TimeSlot
): Promise<VolunteeringData> {
  const volunteeringData = await getVolunteeringData(eventId)

  // Find the job
  const jobIndex = volunteeringData.jobs.findIndex(
    (job) => job.name === jobName
  )
  if (jobIndex === -1) {
    throw new Error(`Job ${jobName} not found`)
  }

  // Check if time slot already exists
  const existingTimeSlot = volunteeringData.jobs[jobIndex].time_slots.find(
    (slot) => slot.time === timeSlot.time
  )

  if (existingTimeSlot) {
    throw new Error("Time slot already exists")
  }

  // Add time slot to job
  volunteeringData.jobs[jobIndex].time_slots.push(timeSlot)

  // Update in database
  return await updateVolunteeringData(eventId, volunteeringData.jobs)
}

// Remove a time slot from a job
export async function removeTimeSlotFromJob(
  eventId: string,
  jobName: string,
  timeSlotTime: string
): Promise<VolunteeringData> {
  const volunteeringData = await getVolunteeringData(eventId)

  // Find the job
  const jobIndex = volunteeringData.jobs.findIndex(
    (job) => job.name === jobName
  )
  if (jobIndex === -1) {
    throw new Error(`Job ${jobName} not found`)
  }

  // Remove time slot from job
  volunteeringData.jobs[jobIndex].time_slots = volunteeringData.jobs[
    jobIndex
  ].time_slots.filter((slot) => slot.time !== timeSlotTime)

  // Update in database
  return await updateVolunteeringData(eventId, volunteeringData.jobs)
}

// Get all volunteers across all jobs for an event
export async function getAllVolunteersForEvent(
  eventId: string
): Promise<VolunteerSignup[]> {
  const volunteeringData = await getVolunteeringData(eventId)

  const allVolunteers: VolunteerSignup[] = []

  volunteeringData.jobs.forEach((job) => {
    job.time_slots.forEach((timeSlot) => {
      allVolunteers.push(...timeSlot.current_volunteers)
    })
  })

  // Remove duplicates based on email
  const uniqueVolunteers = allVolunteers.filter(
    (volunteer, index, self) =>
      index === self.findIndex((v) => v.email === volunteer.email)
  )

  return uniqueVolunteers
}

// Get volunteer interest records (general signups)
export async function getVolunteerInterest(): Promise<any[]> {
  const { data, error } = await supabase
    .from("volunteering_interest")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

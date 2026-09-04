"use server"

import { logActivity } from "@/lib/audit-logger"
import { normalizeConferenceDateOnly } from "@/lib/conference-time"
import {
  normalizeProgramFeatures,
  PROGRAM_FEATURE_KEYS,
  type ProgramFeatureFlags
} from "@/lib/program-features"
import { hasPermission } from "@/utils/permissions"
import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export interface ProgramLocation {
  name?: string
  address?: {
    street?: string
    suite?: string
    city?: string
    state?: string
    zip?: string
  }
}

export interface ProgramHospitality {
  location?: string
  times?: Array<{
    day?: string
    start_time?: string
    end_time?: string
  }>
}

export interface ProgramDesign {
  colors?: {
    primary?: string
    secondary?: string
    primaryDark?: string
    secondaryDark?: string
    background?: string
    text?: string
    info?: string
    success?: string
    warning?: string
    error?: string
  }
}

interface ProgramServiceContent {
  title?: string
  description?: string
  internal_description?: string
}

interface ProgramVolunteeringServiceContent extends ProgramServiceContent {
  signup_destination?: "internal" | "external"
  external_signup_url?: string
}

export interface ProgramContent {
  faq?: Array<{
    question?: string
    answer?: string
  }>
  services?: {
    rides?: ProgramServiceContent
    support?: ProgramServiceContent
    hospitality?: ProgramServiceContent
    volunteering?: ProgramVolunteeringServiceContent
    accessibility?: ProgramServiceContent
  }
}

export interface VenueFloor {
  name?: string
  description?: string
  url?: string
  rooms?: string[]
}

export interface VenueAmenity {
  name?: string
  description?: string
  location?: string
}

export interface Program {
  id: number
  title: string
  description: string
  logo: string
  start_date: string
  end_date: string
  timezone: string
  location: ProgramLocation | string | null
  venue_rooms: string[]
  hospitality: ProgramHospitality | null
  theme: string
  big_book_passage: string
  design: ProgramDesign | null
  promote: number[]
  content: ProgramContent | null
  features?: Partial<ProgramFeatureFlags> | null
}

export interface Event {
  id: number
  program_id: number
  title: string
  description: string
  image: string
  date: string
  start_time: string
  end_time: string
  location: string
  event_category_id: number
  can_save: boolean
  speakers: string[]
  chairpeople: string[]
  asl: boolean
  languages: string[]  // Array of language codes: ['spanish', 'somali', 'hmong']
  hybrid: boolean
  event_categories?: EventCategory
}

export interface EventCategory {
  id: number
  program_id: number
  title: string
  color: string
}

export interface Venue {
  id: number
  program_id: number
  floors: VenueFloor[]
  amenities: VenueAmenity[]
}

export interface Food {
  id: number
  program_id: number
  category: string
  name: string
  description: string
  image: string | null
  location: string
  distance: number | null
  menu: string | null
}

export interface Activity {
  id: number
  program_id: number
  category: string
  name: string
  description: string
  image: string | null
  location: string
  distance: number | null
}

// Program Actions
export async function getPrograms() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .order("id", { ascending: false })

  if (error) {
    console.error("Error fetching programs:", error)
    return { programs: [], error: error.message }
  }

  return { programs: data || [], error: null }
}

export async function getProgram(id: number) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching program:", error)
    return { program: null, error: error.message }
  }

  return { program: data, error: null }
}

export async function updateProgram(id: number, programData: Partial<Program>) {
  const supabase = await createClient()

  // Get existing program data before updating
  const { data: existingProgram, error: fetchError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing program:", fetchError)
    return { program: null, error: fetchError.message }
  }

  const { data, error } = await supabase
    .from("programs")
    .update(programData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating program:", error)
    return { program: null, error: error.message }
  }

  // Log successful program update
  await logActivity({
    actionType: "update_program",
    metadata: {
      programId: id,
      title: data.title,
      beforeData: existingProgram,
      changedFields: Object.keys(programData),
      afterData: data
    }
  })

  revalidatePath("/host/program-management")
  return { program: data, error: null }
}

export async function updateProgramFeatures(
  id: number,
  featureChanges: ProgramFeatureFlags
) {
  if (!Number.isInteger(id) || id <= 0) {
    return { features: null, error: "Invalid conference program." }
  }

  if (
    !featureChanges ||
    typeof featureChanges !== "object" ||
    PROGRAM_FEATURE_KEYS.some(
      (key) => typeof featureChanges[key] !== "boolean"
    )
  ) {
    return { features: null, error: "Invalid app feature settings." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { features: null, error: "Sign in to edit app features." }
  }

  const canEdit = await hasPermission(
    user.id,
    ["admin", "steering"],
    ["program:edit"]
  )
  if (!canEdit) {
    return {
      features: null,
      error: "You do not have permission to edit app features."
    }
  }

  const { data: existingProgram, error: fetchError } = await supabase
    .from("programs")
    .select("title,features")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing program features:", fetchError)
    return { features: null, error: fetchError.message }
  }

  const existingFeatures =
    existingProgram.features &&
    typeof existingProgram.features === "object" &&
    !Array.isArray(existingProgram.features)
      ? (existingProgram.features as Record<string, unknown>)
      : {}
  const currentKnownFeatures = normalizeProgramFeatures(existingFeatures)
  const updatedKnownFeatures = normalizeProgramFeatures(featureChanges)
  const updatedFeatures = {
    ...existingFeatures,
    ...updatedKnownFeatures
  }

  const { data, error } = await supabase
    .from("programs")
    .update({ features: updatedFeatures })
    .eq("id", id)
    .select("features")
    .single()

  if (error) {
    console.error("Error updating program features:", error)
    return { features: null, error: error.message }
  }

  const savedFeatures = normalizeProgramFeatures(data.features)
  const changedFeatures = PROGRAM_FEATURE_KEYS.filter(
    (key) => currentKnownFeatures[key] !== savedFeatures[key]
  )

  await logActivity({
    actionType: "update_program",
    metadata: {
      action: "update_program_features",
      programId: id,
      title: existingProgram.title,
      changedFields: changedFeatures,
      beforeData: currentKnownFeatures,
      afterData: savedFeatures
    }
  })

  revalidatePath("/host")
  revalidatePath("/host/program-management")
  return { features: savedFeatures, error: null }
}

export async function createProgram(programData: Omit<Program, "id">) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("programs")
    .insert([programData])
    .select()
    .single()

  if (error) {
    console.error("Error creating program:", error)
    return { program: null, error: error.message }
  }

  // Log successful program creation
  await logActivity({
    actionType: "create_program",
    metadata: {
      programId: data.id,
      title: data.title,
      createdData: data
    }
  })

  revalidatePath("/host/program-management")
  return { program: data, error: null }
}

// Event Actions
export async function getEvents(programId?: number) {
  const supabase = await createClient()

  let query = supabase
    .from("events")
    .select(
      `
      *,
      event_categories (
        id,
        title,
        color
      )
    `
    )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (programId) {
    query = query.eq("program_id", programId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching events:", error)
    return { events: [], error: error.message }
  }

  return { events: data || [], error: null }
}

export async function getEvent(id: number) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      event_categories (
        id,
        title,
        color
      )
    `
    )
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching event:", error)
    return { event: null, error: error.message }
  }

  return { event: data, error: null }
}

export async function createEvent(
  eventData: Omit<Event, "id" | "event_categories">
) {
  const supabase = await createClient()
  const date = normalizeConferenceDateOnly(eventData.date)
  if (!date) {
    return { event: null, error: "Invalid event date." }
  }

  const { data, error } = await supabase
    .from("events")
    .insert([{ ...eventData, date }])
    .select()
    .single()

  if (error) {
    console.error("Error creating event:", error)
    return { event: null, error: error.message }
  }

  // Log successful event creation
  await logActivity({
    actionType: "create_program_event",
    metadata: {
      eventId: data.id,
      title: data.title,
      programId: data.program_id,
      date: data.date,
      startTime: data.start_time,
      endTime: data.end_time,
      location: data.location,
      createdData: data
    }
  })

  revalidatePath("/host/program-management")
  return { event: data, error: null }
}

export async function updateEvent(id: number, eventData: Partial<Event>) {
  const supabase = await createClient()
  const normalizedEventData = eventData.date
    ? { ...eventData, date: normalizeConferenceDateOnly(eventData.date) }
    : eventData
  if (eventData.date && !normalizedEventData.date) {
    return { event: null, error: "Invalid event date." }
  }

  // Get existing event data before updating
  const { data: existingEvent, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing event:", fetchError)
    return { event: null, error: fetchError.message }
  }

  const { data, error } = await supabase
    .from("events")
    .update(normalizedEventData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating event:", error)
    return { event: null, error: error.message }
  }

  // Log successful event update
  await logActivity({
    actionType: "update_program_event",
    metadata: {
      eventId: id,
      title: data.title,
      programId: data.program_id,
      beforeData: existingEvent,
      changedFields: Object.keys(normalizedEventData),
      afterData: data
    }
  })

  revalidatePath("/host/program-management")
  return { event: data, error: null }
}

export async function deleteEvent(id: number) {
  const supabase = await createClient()

  // Get existing event data before deleting
  const { data: existingEvent, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing event:", fetchError)
    return { error: fetchError.message }
  }

  const { error } = await supabase.from("events").delete().eq("id", id)

  if (error) {
    console.error("Error deleting event:", error)
    return { error: error.message }
  }

  // Log successful event deletion
  await logActivity({
    actionType: "delete_program_event",
    metadata: {
      eventId: id,
      title: existingEvent.title,
      programId: existingEvent.program_id,
      date: existingEvent.date,
      startTime: existingEvent.start_time,
      endTime: existingEvent.end_time,
      location: existingEvent.location,
      deletedData: existingEvent
    }
  })

  revalidatePath("/host/program-management")
  return { error: null }
}

// Event Category Actions
export async function getEventCategories(programId?: number) {
  const supabase = await createClient()

  let query = supabase
    .from("event_categories")
    .select("*")
    .order("title", { ascending: true })

  if (programId) {
    query = query.eq("program_id", programId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching event categories:", error)
    return { categories: [], error: error.message }
  }

  return { categories: data || [], error: null }
}

export async function createEventCategory(
  categoryData: Omit<EventCategory, "id">
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("event_categories")
    .insert([categoryData])
    .select()
    .single()

  if (error) {
    console.error("Error creating event category:", error)
    return { category: null, error: error.message }
  }

  // Log successful event category creation
  await logActivity({
    actionType: "create_event_category",
    metadata: {
      categoryId: data.id,
      title: data.title,
      programId: data.program_id,
      color: data.color,
      createdData: data
    }
  })

  revalidatePath("/host/program-management")
  return { category: data, error: null }
}

export async function updateEventCategory(
  id: number,
  categoryData: Partial<EventCategory>
) {
  const supabase = await createClient()

  // Get existing category data before updating
  const { data: existingCategory, error: fetchError } = await supabase
    .from("event_categories")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing event category:", fetchError)
    return { category: null, error: fetchError.message }
  }

  const { data, error } = await supabase
    .from("event_categories")
    .update(categoryData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating event category:", error)
    return { category: null, error: error.message }
  }

  // Log successful event category update
  await logActivity({
    actionType: "update_event_category",
    metadata: {
      categoryId: id,
      title: data.title,
      programId: data.program_id,
      beforeData: existingCategory,
      changedFields: Object.keys(categoryData),
      afterData: data
    }
  })

  revalidatePath("/host/program-management")
  return { category: data, error: null }
}

export async function deleteEventCategory(id: number) {
  const supabase = await createClient()

  // Get existing category data before deleting
  const { data: existingCategory, error: fetchError } = await supabase
    .from("event_categories")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError) {
    console.error("Error fetching existing event category:", fetchError)
    return { error: fetchError.message }
  }

  const { error } = await supabase
    .from("event_categories")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting event category:", error)
    return { error: error.message }
  }

  // Log successful event category deletion
  await logActivity({
    actionType: "delete_event_category",
    metadata: {
      categoryId: id,
      title: existingCategory.title,
      programId: existingCategory.program_id,
      color: existingCategory.color,
      deletedData: existingCategory
    }
  })

  revalidatePath("/host/program-management")
  return { error: null }
}

// Venue Actions
export async function getVenues(programId?: number) {
  const supabase = await createClient()

  let query = supabase.from("venues").select("*")

  if (programId) {
    query = query.eq("program_id", programId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching venues:", error)
    return { venues: [], error: error.message }
  }

  return { venues: data || [], error: null }
}

// Get venue for a specific program
export async function getVenue(programId: number) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("program_id", programId)
    .maybeSingle() // Use maybeSingle instead of single to handle no rows gracefully

  if (error) {
    console.error("Error fetching venue for program", programId, ":", error)
    return { venue: null, error: error.message }
  }

  console.log("Fetched venue for program", programId, ":", data)
  return { venue: data, error: null }
}

// Create or update venue for a program
export async function updateVenue(programId: number, venueData: Partial<Venue>) {
  const supabase = await createClient()

  // Check if venue exists
  const { data: existingVenue } = await supabase
    .from("venues")
    .select("id")
    .eq("program_id", programId)
    .single()

  let result
  if (existingVenue) {
    // Update existing venue
    result = await supabase
      .from("venues")
      .update(venueData)
      .eq("program_id", programId)
      .select()
      .single()
  } else {
    // Create new venue
    result = await supabase
      .from("venues")
      .insert({ ...venueData, program_id: programId })
      .select()
      .single()
  }

  if (result.error) {
    console.error("Error updating venue:", result.error)
    return { venue: null, error: result.error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      programId, 
      title: `Venue updated`,
      changedFields: ["venue"],
      afterData: { venueData }
    }
  })

  revalidatePath("/host/program-management")
  return { venue: result.data, error: null }
}

// Get venue rooms for a specific program
export async function getVenueRooms(programId: number) {
  const supabase = await createClient()

  const { data: program, error } = await supabase
    .from("programs")
    .select("venue_rooms")
    .eq("id", programId)
    .single()

  if (error) {
    console.error("Error fetching venue rooms:", error)
    return { rooms: [], error: error.message }
  }

  return { rooms: program?.venue_rooms || [], error: null }
}

// Food Actions
export async function getFoodItems(programId: number) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("food")
    .select("*")
    .eq("program_id", programId)
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching food items:", error)
    return { foodItems: [], error: error.message }
  }

  return { foodItems: data || [], error: null }
}

export async function createFoodItem(foodData: Omit<Food, "id">) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("food")
    .insert(foodData)
    .select()
    .single()

  if (error) {
    console.error("Error creating food item:", error)
    return { foodItem: null, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "create_food_item",
      foodId: data.id,
      name: foodData.name,
      programId: foodData.program_id,
      createdData: foodData 
    }
  })

  revalidatePath("/host/program-management")
  return { foodItem: data, error: null }
}

export async function updateFoodItem(id: number, foodData: Partial<Food>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("food")
    .update(foodData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating food item:", error)
    return { foodItem: null, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "update_food_item",
      foodId: id,
      name: data.name,
      changedFields: Object.keys(foodData),
      afterData: foodData 
    }
  })

  revalidatePath("/host/program-management")
  return { foodItem: data, error: null }
}

export async function deleteFoodItem(id: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("food")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting food item:", error)
    return { success: false, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "delete_food_item",
      foodId: id
    }
  })

  revalidatePath("/host/program-management")
  return { success: true, error: null }
}

// Activities Actions
export async function getActivities(programId: number) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("program_id", programId)
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching activities:", error)
    return { activities: [], error: error.message }
  }

  return { activities: data || [], error: null }
}

export async function createActivity(activityData: Omit<Activity, "id">) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("activities")
    .insert(activityData)
    .select()
    .single()

  if (error) {
    console.error("Error creating activity:", error)
    return { activity: null, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "create_activity",
      activityId: data.id,
      name: activityData.name,
      programId: activityData.program_id,
      createdData: activityData 
    }
  })

  revalidatePath("/host/program-management")
  return { activity: data, error: null }
}

export async function updateActivity(id: number, activityData: Partial<Activity>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("activities")
    .update(activityData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating activity:", error)
    return { activity: null, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "update_activity",
      activityId: id,
      name: data.name,
      changedFields: Object.keys(activityData),
      afterData: activityData 
    }
  })

  revalidatePath("/host/program-management")
  return { activity: data, error: null }
}

export async function deleteActivity(id: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting activity:", error)
    return { success: false, error: error.message }
  }

  await logActivity({
    actionType: "update_program",
    metadata: { 
      action: "delete_activity",
      activityId: id
    }
  })

  revalidatePath("/host/program-management")
  return { success: true, error: null }
}

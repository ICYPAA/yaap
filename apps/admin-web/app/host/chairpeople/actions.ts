"use server"

import { createClient } from "@/utils/supabase/server"
import { getCurrentProgramOrNull } from "@/lib/conference-state"
import { type ParsedChairperson } from "@/utils/xlsx-chairperson-parser"
import { revalidatePath } from "next/cache"

export interface StoredChairperson {
  id: number
  created_at: string
  updated_at: string
  name: string
  phone?: string
  day_time: string
  panel_name: string
  panel_id?: number
  raw_data?: any
}

export async function getChairpeople(): Promise<StoredChairperson[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("panel_chairpeople")
    .select("*")
    .order("day_time", { ascending: true })
    .order("panel_name", { ascending: true })

  if (error) {
    console.error("Error fetching chairpeople:", error)
    return []
  }

  return data || []
}

export async function getPanels() {
  const supabase = await createClient()
  const currentProgram = await getCurrentProgramOrNull()

  const { data: panelCategories, error: categoryError } = currentProgram
    ? await supabase
        .from("event_categories")
        .select("id")
        .eq("program_id", currentProgram.id)
        .ilike("title", "%panel%")
    : { data: [], error: null }

  if (categoryError) {
    console.error("Error fetching panel categories:", categoryError)
  }

  const panelCategoryIds = panelCategories?.map((category) => category.id) || []

  const { data: eventPanels, error: eventsError } =
    currentProgram && panelCategoryIds.length > 0
      ? await supabase
          .from("events")
          .select("id, title, date, start_time, end_time, location")
          .eq("program_id", currentProgram.id)
          .in("event_category_id", panelCategoryIds)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
      : { data: [], error: null }

  // Also get panels from panel_notifications for backward compatibility
  const { data: notificationPanels, error: notifError } = await supabase
    .from("panel_notifications")
    .select("id, title, time_day, room")
    .order("time_day", { ascending: true })

  if (eventsError) {
    console.error("Error fetching event panels:", eventsError)
  }
  if (notifError) {
    console.error("Error fetching notification panels:", notifError)
  }

  // Combine both sources
  const allPanels: any[] = []

  // Add event panels with formatted time_day
  // Mark these as from events table so we don't use them for foreign key
  if (eventPanels) {
    eventPanels.forEach((panel) => {
      const date = new Date(panel.date)
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ]
      const dayName = dayNames[date.getDay()]

      // Format time from 24hr to 12hr
      const formatTime = (time24: string) => {
        const [hour, minute] = time24.split(":")
        const h = parseInt(hour)
        const ampm = h >= 12 ? "PM" : "AM"
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${hour12}:${minute} ${ampm}`
      }

      allPanels.push({
        id: `event_${panel.id}`, // Prefix to distinguish from notification panels
        title: panel.title,
        time_day: `${dayName} ${formatTime(panel.start_time)}`,
        room: panel.location || "",
        source: 'events'
      })
    })
  }

  // Add notification panels if they don't already exist
  if (notificationPanels) {
    const existingTitles = new Set(allPanels.map((p) => p.title.toLowerCase()))
    notificationPanels.forEach((panel) => {
      if (!existingTitles.has(panel.title.toLowerCase())) {
        allPanels.push({
          ...panel,
          source: 'notifications'
        })
      }
    })
  }

  // Deduplicate panels by normalized title and time_day
  const uniquePanels = new Map()
  allPanels.forEach((panel) => {
    // Normalize the key for better deduplication
    const normalizedTitle = panel.title.trim().toLowerCase()
    const normalizedTimeDay = panel.time_day.trim().toLowerCase()
    const key = `${normalizedTitle}-${normalizedTimeDay}`

    // Keep the first occurrence (or the one with lowest id for consistency)
    if (!uniquePanels.has(key) || panel.id < uniquePanels.get(key).id) {
      uniquePanels.set(key, panel)
    }
  })

  const panels = Array.from(uniquePanels.values())

  // Sort panels by parsing the time_day field with day names
  panels.sort((a, b) => {
    const dayOrder: Record<string, number> = {
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      thurs: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
      sunday: 7,
      sun: 7
    }

    // Extract day from time_day string
    const getDayValue = (timeDay: string): number => {
      const lower = timeDay.toLowerCase()
      for (const [key, value] of Object.entries(dayOrder)) {
        if (lower.includes(key)) {
          return value
        }
      }

      // Try to parse as date
      const date = new Date(timeDay + " 2025")
      if (!isNaN(date.getTime())) {
        return date.getDay() || 7 // Sunday is 0, convert to 7
      }

      return 999 // Put unrecognized days at the end
    }

    // Extract time from time_day string
    const getTimeValue = (timeDay: string): number => {
      const timeMatch = timeDay.match(/(\d{1,2})(?::(\d{2}))?\\s*(am|pm)?/i)
      if (!timeMatch) return 0

      let hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[2] || "0")
      const isPM = timeMatch[3]?.toLowerCase() === "pm"

      if (isPM && hour !== 12) hour += 12
      if (!isPM && hour === 12) hour = 0

      return hour * 60 + minute
    }

    const dayA = getDayValue(a.time_day)
    const dayB = getDayValue(b.time_day)

    if (dayA !== dayB) {
      return dayA - dayB
    }

    // If same day, sort by time
    const timeA = getTimeValue(a.time_day)
    const timeB = getTimeValue(b.time_day)

    return timeA - timeB
  })

  return panels
}

export async function saveChairpeople(
  chairpeople: ParsedChairperson[]
): Promise<void> {
  const supabase = await createClient()

  // Get all panels to match against
  const panels = await getPanels()

  // Helper function to find matching panel
  const findMatchingPanel = (dayTime: string, panelName: string) => {
    // Normalize inputs
    const normalizedPanelName = panelName.trim().toLowerCase()
    const normalizedDayTime = dayTime.trim().toLowerCase()

    return panels.find((panel) => {
      const normalizedTitle = panel.title.trim().toLowerCase()
      const normalizedTimeDay = panel.time_day.trim().toLowerCase()

      // Check for exact title match
      const titleMatch = normalizedTitle === normalizedPanelName

      // More flexible time matching
      const timeMatch =
        normalizedTimeDay === normalizedDayTime || // Exact match
        normalizedTimeDay.includes(normalizedDayTime) || // Panel time contains chair time
        normalizedDayTime.includes(normalizedTimeDay) || // Chair time contains panel time
        // Check if both contain the same day and time parts
        (extractDay(normalizedTimeDay) === extractDay(normalizedDayTime) &&
          extractTime(normalizedTimeDay) === extractTime(normalizedDayTime))

      return titleMatch && timeMatch
    })
  }

  // Helper to extract day from time string
  const extractDay = (timeStr: string) => {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun"
    ]
    for (const day of days) {
      if (timeStr.includes(day)) return day
    }
    return ""
  }

  // Helper to extract time from time string
  const extractTime = (timeStr: string) => {
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
    if (timeMatch) {
      return `${timeMatch[1]}${timeMatch[2] || "00"}${timeMatch[3].toLowerCase()}`
    }
    return ""
  }

  // Transform chairpeople data for database
  const chairpeopleData = chairpeople.map((chair) => {
    const matchingPanel = findMatchingPanel(chair.dayTime, chair.panelName)
    // Only set panel_id if it's from panel_notifications table
    // Events table IDs won't work due to foreign key constraint
    let panelId = null
    if (matchingPanel) {
      if (matchingPanel.source === 'notifications') {
        panelId = matchingPanel.id
      }
      // For event panels, we can't use the ID due to foreign key constraint
      // The panel_id will remain null
    }
    return {
      name: chair.name,
      phone: chair.phone || null,
      day_time: chair.dayTime,
      panel_name: chair.panelName,
      panel_id: panelId,
      raw_data: chair.rawData
    }
  })

  // Insert chairpeople in batches to avoid overwhelming the database
  const batchSize = 50
  for (let i = 0; i < chairpeopleData.length; i += batchSize) {
    const batch = chairpeopleData.slice(i, i + batchSize)

    const { error } = await supabase.from("panel_chairpeople").insert(batch)

    if (error) {
      console.error("Error saving chairpeople batch:", error)
      throw new Error(`Failed to save chairpeople: ${error.message}`)
    }
  }

  revalidatePath("/host/chairpeople")
}

export async function updateChairperson(
  id: number,
  updates: Partial<StoredChairperson>
): Promise<void> {
  const supabase = await createClient()

  // Helper functions for panel matching (same as in saveChairpeople)
  const extractDay = (timeStr: string) => {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun"
    ]
    for (const day of days) {
      if (timeStr.includes(day)) return day
    }
    return ""
  }

  const extractTime = (timeStr: string) => {
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
    if (timeMatch) {
      return `${timeMatch[1]}${timeMatch[2] || "00"}${timeMatch[3].toLowerCase()}`
    }
    return ""
  }

  // If panel_name is being updated, try to find matching panel
  const finalUpdates = { ...updates }
  if (updates.panel_name || updates.day_time) {
    // Get current chairperson data if we only have partial updates
    const { data: currentChair } = await supabase
      .from("panel_chairpeople")
      .select("*")
      .eq("id", id)
      .single()

    if (currentChair) {
      const panelName = updates.panel_name || currentChair.panel_name
      const dayTime = updates.day_time || currentChair.day_time

      // Normalize inputs
      const normalizedPanelName = panelName.trim().toLowerCase()
      const normalizedDayTime = dayTime.trim().toLowerCase()

      // Get all panels to match against
      const panels = await getPanels()
      const matchingPanel = panels.find((panel) => {
        const normalizedTitle = panel.title.trim().toLowerCase()
        const normalizedTimeDay = panel.time_day.trim().toLowerCase()

        // Check for exact title match
        const titleMatch = normalizedTitle === normalizedPanelName

        // More flexible time matching
        const timeMatch =
          normalizedTimeDay === normalizedDayTime || // Exact match
          normalizedTimeDay.includes(normalizedDayTime) || // Panel time contains chair time
          normalizedDayTime.includes(normalizedTimeDay) || // Chair time contains panel time
          // Check if both contain the same day and time parts
          (extractDay(normalizedTimeDay) === extractDay(normalizedDayTime) &&
            extractTime(normalizedTimeDay) === extractTime(normalizedDayTime))

        return titleMatch && timeMatch
      })

      // Update panel_id based on match (null if no match found)
      finalUpdates.panel_id = matchingPanel?.id || null
    }
  }

  const { error } = await supabase
    .from("panel_chairpeople")
    .update({
      ...finalUpdates,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating chairperson:", error)
    throw new Error(`Failed to update chairperson: ${error.message}`)
  }

  revalidatePath("/host/chairpeople")
}

export async function deleteChairperson(id: number): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("panel_chairpeople")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting chairperson:", error)
    throw new Error(`Failed to delete chairperson: ${error.message}`)
  }

  revalidatePath("/host/chairpeople")
}

export async function linkChairpersonToPanel(
  chairpersonId: number,
  panelId: number
): Promise<void> {
  await updateChairperson(chairpersonId, { panel_id: panelId })
}

export async function unlinkChairpersonFromPanel(
  chairpersonId: number
): Promise<void> {
  await updateChairperson(chairpersonId, { panel_id: undefined })
}

export async function getChairpersonStats() {
  const supabase = await createClient()

  const { data: chairpeople, error: chairError } = await supabase
    .from("panel_chairpeople")
    .select("*")

  const { data: panels, error: panelError } = await supabase
    .from("panel_notifications")
    .select("id, title")

  if (chairError || panelError) {
    console.error("Error fetching stats:", chairError || panelError)
    return {
      totalChairpeople: 0,
      linkedChairpeople: 0,
      unlinkedChairpeople: 0,
      totalPanels: 0,
      panelsWithChair: 0,
      panelsWithoutChair: 0
    }
  }

  const linkedChairpeople = chairpeople?.filter((c) => c.panel_id) || []
  const panelIdsWithChair = new Set(linkedChairpeople.map((c) => c.panel_id))

  return {
    totalChairpeople: chairpeople?.length || 0,
    linkedChairpeople: linkedChairpeople.length,
    unlinkedChairpeople: (chairpeople?.length || 0) - linkedChairpeople.length,
    totalPanels: panels?.length || 0,
    panelsWithChair: panelIdsWithChair.size,
    panelsWithoutChair: (panels?.length || 0) - panelIdsWithChair.size
  }
}

"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Shift } from "./types"

export async function saveShift(shift: Shift) {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  // Check permissions
  const { data: userRole } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", user.id)
    .single()

  const hasAccess =
    userRole &&
    (["host", "steering", "admin"].includes(userRole.role) ||
      userRole.permissions?.includes("shift:edit"))

  if (!hasAccess) throw new Error("Unauthorized")
  if (!shift.program_id) throw new Error("Missing current program")

  const shiftData = {
    program_id: shift.program_id,
    date: shift.date,
    start_time: shift.start_time,
    end_time: shift.end_time,
    job_type: shift.job_type,
    location: shift.location,
    min_volunteers: shift.min_volunteers,
    max_volunteers: shift.max_volunteers,
    assignments: shift.assignments || [],
    notes: shift.notes,
    updated_by: user.id
  }

  let result
  if (shift.id && shift.id !== "new") {
    // Update existing shift
    const { data, error } = await supabase
      .from("shifts")
      .update(shiftData)
      .eq("id", shift.id)
      .select()
      .single()

    if (error) throw error
    result = data
  } else {
    // Create new shift
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        ...shiftData,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error
    result = data
  }

  revalidatePath("/host/shift-scheduling")
  return result
}

export async function deleteShift(shiftId: string) {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  // Check permissions
  const { data: userRole } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", user.id)
    .single()

  const hasAccess =
    userRole &&
    (["host", "steering", "admin"].includes(userRole.role) ||
      userRole.permissions?.includes("shift:edit"))

  if (!hasAccess) throw new Error("Unauthorized")

  const { error } = await supabase.from("shifts").delete().eq("id", shiftId)

  if (error) throw error

  revalidatePath("/host/shift-scheduling")
}

export async function fetchVolunteers(programId: number) {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  // Get all potential volunteers from various sources
  const [
    { data: hostMembers },
    { data: volunteers },
    { data: hospitalityGroups },
    { data: panelChairs },
    { data: panelists }
  ] = await Promise.all([
    // Host committee members
    supabase.from("profiles").select("id, full_name").order("full_name"),

    // Regular volunteers (including greeter and cleanup, excluding legacy conference-only volunteers)
    // Include ALL statuses to ensure everyone shows up
    supabase
      .from("volunteering_interest")
      .select("id, name, last_initial, email, phone, type, data, status")
      .eq("program_id", programId)
      .neq("type", "ic2025")
      .order("name"),

    // Hospitality groups
    supabase
      .from("hospitality_hours")
      .select(
        "id, group_hosting, group_contact, group_phone, group_email, date_time"
      )
      .eq("program_id", programId)
      .eq("group_confirmed", true)
      .order("group_hosting"),

    // Panel chairpeople
    supabase
      .from("panel_chairpeople")
      .select("id, name, phone, panel_name, day_time")
      .order("name"),

    // Confirmed panelists
    supabase
      .from("panel_notifications")
      .select("id, panelist_name, panelist_contact, title, time_day")
      .not("confirmed_at", "is", null)
      .order("panelist_name")
  ])

  // Format volunteers for the client
  const allVolunteers = [
    ...(hostMembers || []).map((h) => ({
      id: h.id,
      name: h.full_name,
      type: "host" as const,
      source_table: "profiles"
    })),
    ...(volunteers || []).map((v) => {
      const displayName = `${v.name} ${v.last_initial || ""}`.trim()
      const contactParts = []
      if (v.email) contactParts.push(v.email)
      if (v.phone) contactParts.push(v.phone)

      return {
        id: v.id,
        name: displayName,
        contact_info: contactParts.join(" • ") || undefined,
        type: "volunteer" as const,
        volunteer_type: v.type,
        data: v.data as any,
        source_table: "volunteering_interest"
      }
    }),
    ...(hospitalityGroups || []).map((h) => ({
      id: h.id,
      name: h.group_hosting,
      contact_info:
        [h.group_email, h.group_phone, h.group_contact]
          .filter(Boolean)
          .join(" • ") || undefined,
      type: "hospitality" as const,
      data: { date_time: h.date_time },
      source_table: "hospitality_hours"
    })),
    ...(panelChairs || []).map((pc) => ({
      id: pc.id,
      name: pc.name,
      contact_info: pc.phone || undefined,
      type: "panel_chair" as const,
      data: { panel_name: pc.panel_name, day_time: pc.day_time },
      source_table: "panel_chairpeople"
    })),
    ...(panelists || []).map((p) => ({
      id: p.id,
      name: p.panelist_name,
      contact_info: p.panelist_contact || undefined,
      type: "panelist" as const,
      data: { title: p.title, time_day: p.time_day },
      source_table: "panel_notifications"
    }))
  ]

  return allVolunteers
}

export async function addVolunteer(data: {
  firstName: string
  lastInitial: string
  email: string
  phone: string
  programId: number
}) {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  // Check permissions
  const { data: userRole } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", user.id)
    .single()

  const hasAccess =
    userRole &&
    (["host", "steering", "admin"].includes(userRole.role) ||
      userRole.permissions?.includes("shift:edit"))

  if (!hasAccess) throw new Error("Unauthorized")

  // Insert volunteer into volunteering_interest table
  const { data: volunteer, error } = await supabase
    .from("volunteering_interest")
    .insert({
      name: data.firstName,
      last_initial: data.lastInitial,
      email: data.email || null,
      phone: data.phone || null,
      type: "general",
      program_id: data.programId,
      data: {
        added_by_host: true,
        added_at: new Date().toISOString()
      },
      status: "pending"
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath("/host/shift-scheduling")
  return volunteer
}

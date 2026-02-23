import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import ShiftSchedulingClient from "./shift-scheduling-client"

export default async function ShiftSchedulingPage() {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/unauthorized")
  }

  // Check if user has proper role or permission
  const { data: userRole } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", user.id)
    .single()

  const hasAccess = userRole && (
    ['host', 'steering', 'admin'].includes(userRole.role) ||
    userRole.permissions?.includes('shift:edit')
  )
  
  if (!hasAccess) {
    redirect("/unauthorized")
  }

  // Get venue rooms from program ID 3
  const { data: program } = await supabase
    .from("programs")
    .select("venue_rooms")
    .eq("id", 3)
    .single()

  // Get all shifts for the conference dates
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .gte("date", "2025-08-28")
    .lte("date", "2025-08-31")
    .order("date")
    .order("start_time")

  // Get all potential volunteers from various sources
  const [
    { data: hostMembers },
    { data: volunteers },
    { data: hospitalityGroups },
    { data: panelChairs },
    { data: panelists }
  ] = await Promise.all([
    // Host committee members
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name"),
    
    // Regular volunteers (including greeter and cleanup, excluding ic2025)
    // Include ALL statuses to ensure everyone shows up
    supabase
      .from("volunteering_interest")
      .select("id, name, last_initial, email, phone, type, data, status")
      .neq("type", "ic2025")
      .order("name"),
    
    // Hospitality groups
    supabase
      .from("hospitality_hours")
      .select("id, group_hosting, group_contact, group_phone, group_email, date_time")
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
    ...(hostMembers || []).map(h => ({
      id: h.id,
      name: h.full_name,
      type: 'host' as const,
      source_table: 'profiles'
    })),
    ...(volunteers || []).map(v => {
      // Just use the name with last initial
      const displayName = `${v.name} ${v.last_initial || ''}`.trim()
      
      return {
        id: v.id || `${v.email || v.phone}`,
        name: displayName,
        type: 'volunteer' as const,
        source_table: 'volunteering_interest',
        contact_info: v.email || v.phone,
        volunteer_type: v.type,
        volunteering_interest_id: v.id,
        data: v.data
      }
    }),
    ...(hospitalityGroups || []).map(h => ({
      id: h.id || h.group_hosting,
      name: h.group_hosting,
      type: 'hospitality' as const,
      source_table: 'hospitality_hours',
      contact_info: h.group_email || h.group_phone
    })),
    ...(panelChairs || []).map(p => ({
      id: p.id || p.phone || p.name,
      name: p.name,
      type: 'panel_chair' as const,
      source_table: 'panel_chairpeople',
      contact_info: p.phone
    })),
    ...(panelists || []).map(p => ({
      id: p.id || p.panelist_contact,
      name: p.panelist_name,
      type: 'panelist' as const,
      source_table: 'panel_notifications',
      contact_info: p.panelist_contact
    }))
  ]

  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
      <ShiftSchedulingClient 
        initialShifts={shifts || []}
        allVolunteers={allVolunteers}
        currentUserId={user.id}
        venueRooms={program?.venue_rooms || []}
      />
    </div>
  )
}
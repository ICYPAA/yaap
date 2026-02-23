"use server"

import { createClient } from "@/utils/supabase/server"

// Helper function to fetch all IC2025 volunteer interest records
export async function getIC2025VolunteerInterest() {
  const supabase = await createClient()

  // Get full record data directly from the table instead of using RPC
  const { data: fullData, error } = await supabase
    .from("volunteering_interest")
    .select("*")
    .eq("type", "ic2025")
    .order("created_at", { ascending: false })

  console.log("data", fullData)

  if (error) {
    console.error("Error fetching IC2025 volunteer interest data:", error)
    throw new Error("Failed to fetch IC2025 volunteer interest data")
  }

  // Check if user has access to sensitive data by examining if email/phone are accessible
  const hasAccessToSensitive =
    fullData &&
    fullData.length > 0 &&
    fullData.some(
      (record: any) => record.email !== null || record.phone !== null
    )

  // Transform data to match the expected interface
  const transformedData = fullData?.map((record: any) => ({
    id: record.id || Math.random().toString(),
    name: record.name || "",
    last_initial: record.last_initial || "",
    email: hasAccessToSensitive ? record.email : null,
    phone: hasAccessToSensitive ? record.phone : null,
    type: "ic2025" as const,
    status: record.status || "pending",
    data: {
      group_name: record.data?.group_name || "",
      day: record.data?.day || "",
      time_slot: record.data?.time_slot || "",
      comments: record.data?.comments || ""
    },
    created_at: record.created_at || new Date().toISOString()
  }))

  return {
    data: transformedData || [],
    hasAccessToSensitive
  }
}

// Helper function to update an IC2025 volunteer interest record's status
export async function updateIC2025VolunteerStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("volunteering_interest")
    .update({ status })
    .eq("id", id)
    .eq("type", "ic2025")

  if (error) {
    console.error("Error updating IC2025 volunteer status:", error)
    throw new Error("Failed to update IC2025 volunteer status")
  }

  return { success: true }
}

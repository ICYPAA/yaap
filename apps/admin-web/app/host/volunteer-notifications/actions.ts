"use server"

import { getEmailApiHeaders } from "@/lib/email-api"
import { logActivity } from "@/lib/audit-logger"
import { getCurrentProgramOrNull } from "@/lib/conference-state"
import { buildProgramTemplateContext } from "@/lib/panel-notification-templates"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export interface VolunteerNotification {
  id: number
  name: string
  last_initial?: string
  type: string
  contact_type: "email" | "phone"
  contact_value: string
  data?: any
  notification_sent_at?: string
  confirmed_at?: string
  created_at: string
}

// Get all volunteers from volunteering_interest table
export async function getVolunteers() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect("/auth/login")
  }

  try {
    const currentProgram = await getCurrentProgramOrNull()
    if (!currentProgram) return []

    // Get volunteer interest data with email/phone
    const { data, error } = await supabase
      .from("volunteering_interest")
      .select("*")
      .eq("program_id", currentProgram.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching volunteers:", error)
      return []
    }

    // Transform data to match VolunteerNotification interface
    const volunteers: VolunteerNotification[] = (data || []).map((record) => ({
      id: record.id,
      name: record.name,
      last_initial: record.last_initial,
      type: record.type,
      contact_type: record.email ? "email" : "phone",
      contact_value: record.email || record.phone || "",
      data: record.data,
      notification_sent_at: record.notification_sent_at,
      confirmed_at: record.confirmed_at,
      created_at: record.created_at
    }))

    return volunteers
  } catch (error) {
    console.error("Error in getVolunteers:", error)
    return []
  }
}

// Send notifications to selected volunteers (email only)
export async function sendVolunteerNotifications(volunteerIds: number[]) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const results = []

    for (const id of volunteerIds) {
      // Get volunteer details
      const { data: volunteer, error: fetchError } = await supabase
        .from("volunteering_interest")
        .select("*")
        .eq("id", id)
        .single()

      if (fetchError || !volunteer) {
        results.push({ id, success: false, error: "Volunteer not found" })
        continue
      }

      // Only send email notifications
      if (!volunteer.email) {
        results.push({
          id,
          success: false,
          error: "No email address available"
        })
        continue
      }

      // Send email notification
      const emailResult = await sendEmailNotification(volunteer)

      if (emailResult.success) {
        // Update notification_sent_at timestamp
        await supabase
          .from("volunteering_interest")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("id", id)

        results.push({ id, success: true })
      } else {
        results.push({ id, success: false, error: emailResult.error })
      }
    }

    await logActivity({
      actionType: "send_volunteer_notification",
      metadata: {
        volunteerIds,
        count: volunteerIds.length,
        successCount: results.filter((r) => r.success).length
      }
    })

    return { success: true, results }
  } catch (error) {
    console.error("Error sending volunteer notifications:", error)
    return { error: "Failed to send notifications" }
  }
}

// Helper function to send email notification
async function sendEmailNotification(volunteer: any) {
  try {
    const programContext = buildProgramTemplateContext(
      await getCurrentProgramOrNull()
    )

    // Construct email content
    const emailContent = `
Hello ${volunteer.name},

Thank you for your interest in volunteering for ${programContext.title}!

We have received your volunteer signup for: ${volunteer.type}

${volunteer.data ? `Details: ${JSON.stringify(volunteer.data, null, 2)}` : ""}

We will be in touch soon with more information about your volunteer assignment.

If you have any questions, please don't hesitate to reach out.

Thank you for your service!
${programContext.committeeName}
    `.trim()

    // Send email via API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/email`,
      {
        method: "POST",
        headers: getEmailApiHeaders("volunteer-reminder"),
        body: JSON.stringify({
          to: volunteer.email,
          subject: `${programContext.title} Volunteer Notification`,
          text: emailContent,
          html: emailContent.replace(/\n/g, "<br>")
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Email send failed: ${error}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error: "Failed to send email" }
  }
}

// Update volunteer status
export async function updateVolunteerStatus(
  id: number,
  field: string,
  value: boolean
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const updateData: any = {}
    updateData[field] = value ? new Date().toISOString() : null

    const { error } = await supabase
      .from("volunteering_interest")
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("Error updating volunteer status:", error)
      return { error: "Failed to update status" }
    }

    await logActivity({
      actionType: "update_volunteer_status",
      metadata: { volunteerId: id, field, value }
    })

    return { success: true }
  } catch (error) {
    console.error("Error in updateVolunteerStatus:", error)
    return { error: "Failed to update status" }
  }
}

// Update volunteer notification details
export async function updateVolunteerNotification(
  id: number,
  formData: FormData
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const name = formData.get("name") as string
    const lastInitial = formData.get("last_initial") as string
    const type = formData.get("type") as string
    const contactType = formData.get("contact_type") as string
    const contactValue = formData.get("contact_value") as string

    const updateData: any = {
      name,
      last_initial: lastInitial,
      type
    }

    // Update email or phone based on contact type
    if (contactType === "email") {
      updateData.email = contactValue
      updateData.phone = null
    } else {
      updateData.phone = contactValue
      updateData.email = null
    }

    const { error } = await supabase
      .from("volunteering_interest")
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("Error updating volunteer:", error)
      return { error: "Failed to update volunteer" }
    }

    await logActivity({
      actionType: "update_volunteer_notification",
      metadata: {
        volunteerId: id,
        updates: { name, lastInitial, type, contactType, contactValue }
      }
    })

    return { success: true }
  } catch (error) {
    console.error("Error in updateVolunteerNotification:", error)
    return { error: "Failed to update volunteer" }
  }
}

// Delete volunteer notification
export async function deleteVolunteerNotification(id: number) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const { error } = await supabase
      .from("volunteering_interest")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting volunteer:", error)
      return { error: "Failed to delete volunteer" }
    }

    await logActivity({
      actionType: "delete_volunteer_notification",
      metadata: { volunteerId: id }
    })

    return { success: true }
  } catch (error) {
    console.error("Error in deleteVolunteerNotification:", error)
    return { error: "Failed to delete volunteer" }
  }
}

// Send test volunteer notification
export async function sendTestVolunteerNotification(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const email = formData.get("email") as string

    const testVolunteer = {
      name: "Test Volunteer",
      email,
      type: "General Interest",
      data: { test: true, timestamp: new Date().toISOString() }
    }

    const result = await sendEmailNotification(testVolunteer)

    if (result.success) {
      await logActivity({
        actionType: "send_volunteer_test_notification",
        metadata: { email }
      })
    }

    return result
  } catch (error) {
    console.error("Error sending test notification:", error)
    return { error: "Failed to send test notification" }
  }
}

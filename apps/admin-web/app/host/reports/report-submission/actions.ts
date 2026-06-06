"use server"

import { getEmailApiHeaders } from "@/lib/email-api"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function submitReport(formData: FormData) {
  const supabase = await createClient()

  const userId = formData.get("userId") as string
  const team = formData.get("team") as string
  const agendaDocId = (formData.get("agendaDoc") as string) || ""
  const chairPosition = formData.get("chairPosition") as string
  const completedWork = (formData.get("completedWork") as string) || ""
  const currentWork = (formData.get("currentWork") as string) || ""
  const needsHelp = (formData.get("needsHelp") as string) || ""
  const teamMeetingItems = (formData.get("teamMeetingItems") as string) || ""
  const shareInMeeting = (formData.get("shareInMeeting") as string) || ""

  const { data: profile } = await supabase
    .from("profile-names")
    .select("profile_name")
    .eq("user_id", userId)
    .single()

  // Get user information for email notification
  const {
    data: { user }
  } = await supabase.auth.getUser()
  const userEmail = user?.email || "Unknown"
  const userName =
    profile?.profile_name || user?.user_metadata?.full_name || "Unknown User"

  // First, save to database
  const { error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      team,
      chair_position: chairPosition,
      completed_work: completedWork,
      current_work: currentWork,
      needs_help: needsHelp,
      team_meeting_items: teamMeetingItems,
      share_in_meeting: shareInMeeting,
      agenda_doc_id: agendaDocId,
      is_nothing_to_report: false
    })
    .select()
    .single()

  if (error) {
    console.error("Error submitting report:", error)
    throw new Error("Failed to submit report")
  }

  // Send notification email
  try {
    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/email`, {
      method: "POST",
      body: JSON.stringify({
        team,
        chairPosition,
        completedWork,
        currentWork,
        needsHelp,
        teamMeetingItems,
        shareInMeeting,
        userEmail,
        userName,
        date: new Date().toISOString()
      }),
      headers: getEmailApiHeaders("report")
    })
  } catch (error) {
    console.error("Error sending email notification:", error)
    // Continue with redirect even if email fails
  }

  // Add a success message parameter to the URL
  redirect("/host/reports?success=true&message=Report submitted successfully!")
}

export async function submitNothingToReport(formData: FormData) {
  const supabase = await createClient()

  const userId = formData.get("userId") as string
  const team = formData.get("team") as string
  const chairPosition = formData.get("chairPosition") as string

  const nothingToReportMessage = "Nothing to report"

  const { data: profile } = await supabase
    .from("profile-names")
    .select("profile_name")
    .eq("user_id", userId)
    .single()

  // Get user information for email notification
  const {
    data: { user }
  } = await supabase.auth.getUser()
  const userEmail = user?.email || "Unknown"
  const userName =
    profile?.profile_name || user?.user_metadata?.full_name || "Unknown User"

  // Save a "nothing to report" entry to the database
  const { error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      team,
      chair_position: chairPosition,
      completed_work: nothingToReportMessage,
      current_work: nothingToReportMessage,
      needs_help: nothingToReportMessage,
      team_meeting_items: nothingToReportMessage,
      share_in_meeting: nothingToReportMessage,
      agenda_doc_id: "",
      is_nothing_to_report: true
    })
    .select()
    .single()

  if (error) {
    console.error("Error submitting nothing to report:", error)
    throw new Error("Failed to submit nothing to report")
  }

  // Send notification email
  try {
    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/email`, {
      method: "POST",
      body: JSON.stringify({
        team,
        chairPosition,
        isNothingToReport: true,
        userEmail,
        userName,
        date: new Date().toISOString()
      }),
      headers: getEmailApiHeaders("report")
    })
  } catch (error) {
    console.error("Error sending email notification:", error)
    // Continue with redirect even if email fails
  }

  // Add a success message parameter to the URL
  redirect(
    "/host/reports?success=true&message=Nothing to report submitted successfully!"
  )
}

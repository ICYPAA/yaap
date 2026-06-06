"use server"

import { PanelNotification } from "@/app/host/panels/actions"
import { getEmailApiHeaders } from "@/lib/email-api"
import { generateConfirmationNotificationEmail } from "@/lib/panel-notification-templates"
import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function confirmPanelParticipation(formData: FormData) {
  const token = formData.get("token") as string

  if (!token) {
    throw new Error("Token is required")
  }

  // Handle test token case - don't try to update database
  if (token === "test-token") {
    // For test token, just simulate success without database operation
    console.log("Test token confirmation simulated")
    revalidatePath(`/host/panels/confirm/${token}`)
    return
  }

  const supabase = await createClient()

  try {
    // Update the notification record to mark as confirmed
    const { data, error } = await supabase
      .from("panel_notifications")
      .update({
        confirmed_at: new Date().toISOString()
      })
      .eq("confirmation_token", token)
      .is("confirmed_at", null) // Only update if not already confirmed
      .select()
      .single()

    if (error) {
      console.error("Error confirming panel participation:", error)
      throw new Error("Failed to confirm participation")
    }

    if (!data) {
      // Already confirmed or invalid token
      return
    }

    // Send notification email to program@ and chair@
    const emailData = generateConfirmationNotificationEmail(
      data as PanelNotification,
      true
    )

    // Send notification emails
    const recipients = ["program@icyhost.org", "chair@icyhost.org"]
    for (const recipient of recipients) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
          {
            method: "POST",
            headers: getEmailApiHeaders("panel-notification"),
            body: JSON.stringify({
              to: recipient,
              subject: emailData.subject,
              emailContent: emailData.body
            })
          }
        )
      } catch (emailError) {
        console.error(`Error sending notification to ${recipient}:`, emailError)
      }
    }

    // Revalidate the confirmation page
    revalidatePath(`/host/panels/confirm/${token}`)
  } catch (error) {
    console.error("Error confirming panel participation:", error)
    throw error
  }
}

export async function withdrawPanelParticipation(formData: FormData) {
  const token = formData.get("token") as string

  if (!token) {
    throw new Error("Token is required")
  }

  // Handle test token case - don't try to update database
  if (token === "test-token") {
    // For test token, just simulate success without database operation
    console.log("Test token withdrawal simulated")
    revalidatePath(`/host/panels/confirm/${token}`)
    return
  }

  const supabase = await createClient()

  try {
    // Update the notification record to mark as denied/withdrawn
    const { data, error } = await supabase
      .from("panel_notifications")
      .update({
        denied_at: new Date().toISOString()
      })
      .eq("confirmation_token", token)
      .is("denied_at", null) // Only update if not already denied
      .select()
      .single()

    if (error) {
      console.error("Error withdrawing panel participation:", error)
      throw new Error("Failed to withdraw participation")
    }

    if (!data) {
      // Already withdrawn or invalid token
      return
    }

    // Send notification email to program@ and chair@
    const emailData = generateConfirmationNotificationEmail(
      data as PanelNotification,
      false
    )

    // Send notification emails
    const recipients = ["program@icyhost.org", "chair@icyhost.org"]
    for (const recipient of recipients) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
          {
            method: "POST",
            headers: getEmailApiHeaders("panel-notification"),
            body: JSON.stringify({
              to: recipient,
              subject: emailData.subject,
              emailContent: emailData.body
            })
          }
        )
      } catch (emailError) {
        console.error(`Error sending notification to ${recipient}:`, emailError)
      }
    }

    // Revalidate the confirmation page
    revalidatePath(`/host/panels/confirm/${token}`)
  } catch (error) {
    console.error("Error withdrawing panel participation:", error)
    throw error
  }
}

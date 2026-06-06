"use server"

import { createClient } from "@/utils/supabase/server"
import { getEmailApiHeaders } from "@/lib/email-api"
import {
  parseXLSXPanelData,
  type PanelPanelist,
  type ParsedPanel
} from "@/utils/xlsx-panel-parser"
// Note: Sentry import removed - needs to be added to project dependencies
import { logActivity } from "@/lib/audit-logger"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import twilio from "twilio"
import {
  buildProgramTemplateContext,
  generateInitialEmailTemplate,
  generateInitialSMSTemplates,
  generateFollowUpReminderEmailTemplate,
  generateFollowUpReminderSMSTemplate,} from "@/lib/panel-notification-templates"
import { getCurrentProgramOrNull } from "@/lib/conference-state"

export interface PanelFormData {
  timeDay: string
  room: string
  title: string
  topic?: string
  description?: string
  literatureReference?: string
  panelists: PanelPanelist[]
}

export interface PanelNotification {
  id: number
  time_day: string
  room: string
  title: string
  topic?: string
  description?: string
  literature_reference?: string
  panelist_name: string
  panelist_contact: string
  contact_type: string
  notification_sent_at?: string
  confirmed_at?: string
  denied_at?: string
  confirmation_token: string
  send_status?: "success" | "failed" | "pending"
  send_error?: string
  reminder_followup_sent_at?: string
  reminder_send_status?: "success" | "failed" | "pending"
  reminder_send_error?: string
  reminder2_followup_sent_at?: string
  reminder2_send_status?: "success" | "failed" | "pending"
  reminder2_send_error?: string
  reminder3_followup_sent_at?: string
  reminder3_send_status?: "success" | "failed" | "pending"
  reminder3_send_error?: string
}

export interface NewPanelistEntry {
  panel: ParsedPanel
  panelist: PanelPanelist
  existingPanel: PanelNotification // Reference to any existing notification for this panel
}

type SmsMessageOptions = {
  from: string
  to: string
  body: string
  statusCallback: string
  statusCallbackMethod?: "POST"
}

type TwilioError = {
  code?: number
  message?: string
}

type PanelNotificationQueryResult = {
  data: PanelNotification[] | null
  error: Error | null
}

type PanelNotificationQuery = PromiseLike<PanelNotificationQueryResult> & {
  not(column: string, operator: string, value: unknown): PanelNotificationQuery
  is(column: string, value: unknown): PanelNotificationQuery
}

// Helper function to normalize phone numbers for SMS
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")

  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`
  } else {
    return `+${digits}`
  }
}

// Helper function to send multiple SMS messages with enhanced tracking
async function sendMultipleSMS(
  to: string,
  messages: string[],
  notificationId?: number,
  reminderType?: "initial" | "reminder1" | "reminder2"
): Promise<{ success: boolean; error?: string; messageIds?: string[] }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration")
    return { success: false, error: "Missing Twilio configuration" }
  }

  const normalizedPhone = normalizePhoneNumber(to)
  const messageIds: string[] = []

  try {
    const client = twilio(accountSid, authToken)

    // Construct webhook URL
    const webhookUrl = `https://icyhost.org/api/webhooks/twilio`

    // Send messages with a small delay between them
    for (let i = 0; i < messages.length; i++) {
      const messageOptions: SmsMessageOptions = {
        from: fromNumber,
        to: normalizedPhone,
        body: messages[i],
        // Add status callback for delivery tracking
        statusCallback: webhookUrl
      }

      // Add custom parameters for webhook processing
      if (notificationId) {
        messageOptions.statusCallbackMethod = "POST"
        // Custom parameters that will be sent back in the webhook
        messageOptions.statusCallback = `${webhookUrl}?NotificationId=${notificationId}&ReminderType=${reminderType || "initial"}`
      }

      const message = await client.messages.create(messageOptions)
      messageIds.push(message.sid)

      // Add a small delay between messages to ensure proper order
      if (i < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(
      `${messages.length} SMS messages queued successfully to ${normalizedPhone}. Message IDs: ${messageIds.join(", ")}`
    )
    return { success: true, messageIds }
  } catch (error: unknown) {
    const twilioError = error as TwilioError
    console.error(`Error sending SMS to ${normalizedPhone}:`, error)

    // Extract meaningful error message
    let errorMessage = "Failed to send SMS"

    if (twilioError.code === 21211 || twilioError.code === 21614) {
      errorMessage = "Invalid phone number format"
    } else if (twilioError.code === 21408) {
      errorMessage = "Permission denied to send to this number"
    } else if (twilioError.code === 21610) {
      errorMessage = "Recipient has opted out of messages"
    } else if (twilioError.code === 21612) {
      errorMessage = "Not a valid mobile number (may be landline)"
    } else if (twilioError.message) {
      errorMessage = twilioError.message
    }

    return { success: false, error: errorMessage }
  }
}

export async function savePanelsFromXLSX(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  try {
    const file = formData.get("panels-file") as File

    if (!file) {
      return { error: "No file provided" }
    }

    // Parse the XLSX file
    const parsedData = await parseXLSXPanelData(file)

    if (parsedData.errors.length > 0) {
      return {
        error: "Parsing errors occurred",
        details: parsedData.errors,
        panels: parsedData.panels
      }
    }

    // Save panel notifications to database (one row per panelist)
    const savedNotifications = []

    for (const panel of parsedData.panels) {
      for (const panelist of panel.panelists) {
        if (!panelist.name) continue

        // Check if this panelist notification already exists
        const { data: existing, error: existingError } = await supabase
          .from("panel_notifications")
          .select("id")
          .eq("title", panel.title)
          .eq("panelist_name", panelist.name)
          .eq("topic", panel.topic)
          .maybeSingle()

        if (existingError) {
          console.error(
            "Error checking for existing notification:",
            existingError
          )
          continue
        }

        if (existing) {
          // Skip this entry as it already exists
          console.log(`Skipping duplicate: ${panel.title} - ${panelist.name}`)
          continue
        }

        const contactType = panelist.email ? "email" : "phone"
        const contactValue = panelist.email || panelist.phone

        if (contactValue) {
          const { data: savedNotification, error } = await supabase
            .from("panel_notifications")
            .insert({
              time_day: panel.timeDay,
              room: panel.room,
              title: panel.title,
              topic: panel.topic,
              description: panel.description,
              literature_reference: panel.literatureReference,
              panelist_name: panelist.name,
              panelist_contact: contactValue,
              contact_type: contactType,
              raw_data: panel.rawData
            })
            .select()
            .single()

          if (error) {
            console.error("Error saving panel notification:", error)
            continue
          }

          savedNotifications.push(savedNotification)
        }
      }
    }

    revalidatePath("/host/panels")

    // Count unique panels (by title + time + room)
    const uniquePanels = new Set(
      savedNotifications.map((n) => `${n.title}-${n.time_day}-${n.room}`)
    ).size

    return {
      success: `Successfully saved ${uniquePanels} panels with ${savedNotifications.length} panelist notifications`,
      notifications: savedNotifications
    }
  } catch (error) {
    console.error("Error processing panels:", error)
    return { error: "Failed to process panels file" }
  }
}

export async function classifyPanelsFromXLSX(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  try {
    const file = formData.get("panels-file") as File

    if (!file) {
      return { error: "No file provided" }
    }

    // Parse the XLSX file
    const parsedData = await parseXLSXPanelData(file)

    if (parsedData.errors.length > 0) {
      return {
        error: "Parsing errors occurred",
        details: parsedData.errors
      }
    }

    // Get all existing panel notifications
    const { data: existingNotifications, error: fetchError } = await supabase
      .from("panel_notifications")
      .select("*")

    if (fetchError) {
      return { error: "Failed to fetch existing panels" }
    }

    const newPanels: ParsedPanel[] = []
    const updatedPanels: {
      existing: PanelNotification
      newData: ParsedPanel
    }[] = []
    const newPanelists: NewPanelistEntry[] = []

    for (const panel of parsedData.panels) {
      // Check if this panel exists at all (by title)
      const existingPanelNotifications = existingNotifications.filter(
        (n) => n.title === panel.title
      )

      if (existingPanelNotifications.length === 0) {
        // Completely new panel
        newPanels.push(panel)
        continue
      }

      // Panel exists, check for updates and new panelists
      let hasUpdates = false

      // Check for time/room updates using the first existing notification as reference
      const referenceNotification = existingPanelNotifications[0]
      if (
        referenceNotification.time_day !== panel.timeDay ||
        referenceNotification.room !== panel.room
      ) {
        hasUpdates = true
      }

      // Process each panelist in this panel
      for (const panelist of panel.panelists) {
        if (!panelist.name || (!panelist.email && !panelist.phone)) continue

        const contactValue = panelist.email || panelist.phone
        if (!contactValue) continue

        const existingPanelistNotification = existingPanelNotifications.find(
          (n) => n.panelist_contact === contactValue
        )

        if (!existingPanelistNotification) {
          // This is a new panelist for an existing panel
          newPanelists.push({
            panel,
            panelist,
            existingPanel: referenceNotification
          })
        }
      }

      // Add to updated panels if there are time/room changes
      if (hasUpdates) {
        // Add each existing panelist's notification to updates (avoid duplicates)
        for (const existingNotification of existingPanelNotifications) {
          if (
            !updatedPanels.some(
              (p) => p.existing.id === existingNotification.id
            )
          ) {
            updatedPanels.push({
              existing: existingNotification,
              newData: panel
            })
          }
        }
      }
    }

    return {
      success: "Successfully classified panels",
      newPanels,
      updatedPanels,
      newPanelists
    }
  } catch (error) {
    console.error("Error classifying panels:", error)
    return { error: "Failed to classify panels file" }
  }
}

export async function saveClassifiedPanels(
  newPanels: ParsedPanel[],
  updatedPanels: {
    existing: PanelNotification
    newData: ParsedPanel
  }[],
  newPanelists: NewPanelistEntry[] = []
) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const newNotifications = []
  const newPanelistNotifications = []
  const updatedNotifications = []
  const errors: { message: string; data: unknown }[] = []

  // Process new panels
  for (const panel of newPanels) {
    for (const panelist of panel.panelists) {
      if (!panelist.name) continue

      const contactType = panelist.email ? "email" : "phone"
      const contactValue = panelist.email || panelist.phone

      if (contactValue) {
        const { data: saved, error } = await supabase
          .from("panel_notifications")
          .insert({
            time_day: panel.timeDay,
            room: panel.room,
            title: panel.title,
            topic: panel.topic,
            description: panel.description,
            literature_reference: panel.literatureReference,
            panelist_name: panelist.name,
            panelist_contact: contactValue,
            contact_type: contactType,
            raw_data: panel.rawData
          })
          .select()
          .single()

        if (error) {
          errors.push({ message: "Error creating panel", data: error })
        } else {
          newNotifications.push(saved)
        }
      }
    }
  }

  // Process new panelists for existing panels
  for (const { panel, panelist } of newPanelists) {
    const contactType = panelist.email ? "email" : "phone"
    const contactValue = panelist.email || panelist.phone

    if (contactValue) {
      const { data: saved, error } = await supabase
        .from("panel_notifications")
        .insert({
          time_day: panel.timeDay,
          room: panel.room,
          title: panel.title,
          topic: panel.topic,
          description: panel.description,
          literature_reference: panel.literatureReference,
          panelist_name: panelist.name,
          panelist_contact: contactValue,
          contact_type: contactType,
          raw_data: panel.rawData
        })
        .select()
        .single()

      if (error) {
        errors.push({ message: "Error adding new panelist", data: error })
      } else {
        newPanelistNotifications.push(saved)
      }
    }
  }

  // Process updated panels
  for (const { existing, newData } of updatedPanels) {
    const { error } = await supabase
      .from("panel_notifications")
      .update({
        time_day: newData.timeDay,
        room: newData.room
      })
      .eq("id", existing.id)

    if (error) {
      errors.push({ message: "Error updating panel", data: error })
    } else {
      updatedNotifications.push(existing.id)
    }
  }

  if (errors.length > 0) {
    return { error: "Some errors occurred", details: errors }
  }

  // Log successful import
  await logActivity({
    actionType: "import_panels",
    metadata: {
      newPanelsCount: newPanels.length,
      updatedPanelsCount: updatedPanels.length,
      newPanelistsCount: newPanelists.length,
      newNotificationsCount: newNotifications.length,
      newPanelistNotificationsCount: newPanelistNotifications.length,
      updatedNotificationsCount: updatedNotifications.length
    }
  })

  revalidatePath("/host/panels")

  const totalCreated = newNotifications.length + newPanelistNotifications.length
  let message = `Successfully created ${totalCreated} and updated ${updatedNotifications.length} notifications`

  if (newPanelistNotifications.length > 0) {
    message += ` (including ${newPanelistNotifications.length} new panelists added to existing panels)`
  }

  return {
    success: message,
    created: newNotifications,
    newPanelists: newPanelistNotifications,
    updated: updatedNotifications
  }
}

export async function getPanels() {
  const supabase = await createClient()

  const { data: notifications, error } = await supabase
    .from("panel_notifications")
    .select("*")
    .order("time_day", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    console.error("Error fetching panel notifications:", error)
    return []
  }

  return notifications || []
}

export async function updatePanel(
  originalTitle: string,
  originalTimeDay: string,
  originalRoom: string,
  data: PanelFormData
) {
  const supabase = await createClient()

  try {
    // First, delete existing notifications for this panel (identified by original title, time, room)
    await supabase
      .from("panel_notifications")
      .delete()
      .eq("title", originalTitle)
      .eq("time_day", originalTimeDay)
      .eq("room", originalRoom)

    // Then create new ones with updated data
    const insertPromises = data.panelists.map((panelist) => {
      const contactType = panelist.email ? "email" : "phone"
      const contactValue = panelist.email || panelist.phone

      if (contactValue) {
        return supabase.from("panel_notifications").insert({
          time_day: data.timeDay,
          room: data.room,
          title: data.title,
          topic: data.topic,
          description: data.description,
          literature_reference: data.literatureReference,
          panelist_name: panelist.name,
          panelist_contact: contactValue,
          contact_type: contactType,
          updated_at: new Date().toISOString()
        })
      }
    })

    // Wait for all inserts to complete
    await Promise.all(insertPromises.filter(Boolean))

    // Log successful update
    await logActivity({
      actionType: "update_panel",
      metadata: {
        panelId: `${originalTitle}-${originalTimeDay}-${originalRoom}`,
        panelTitle: data.title,
        originalTitle,
        originalTimeDay,
        originalRoom,
        newTitle: data.title,
        newTimeDay: data.timeDay,
        newRoom: data.room,
        topic: data.topic,
        description: data.description,
        literatureReference: data.literatureReference,
        panelistCount: data.panelists.length
      }
    })

    revalidatePath("/host/panels")

    return { success: "Panel updated successfully" }
  } catch (error) {
    console.error("Error updating panel:", error)
    return { error: "Failed to update panel" }
  }
}

export async function deletePanel(
  title: string,
  timeDay: string,
  room: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("panel_notifications")
    .delete()
    .eq("title", title)
    .eq("time_day", timeDay)
    .eq("room", room)

  if (error) {
    console.error("Error deleting panel:", error)
    return { error: "Failed to delete panel" }
  }

  // Log successful deletion
  await logActivity({
    actionType: "delete_panel",
    metadata: {
      panelId: `${title}-${timeDay}-${room}`,
      panelTitle: title,
      title,
      timeDay,
      room
    }
  })

  revalidatePath("/host/panels")

  return { success: "Panel deleted successfully" }
}

export async function deletePanelNotification(notificationId: number) {
  const supabase = await createClient()

  // Get the notification data before deleting for audit logging
  const { data: notificationToDelete, error: fetchError } = await supabase
    .from("panel_notifications")
    .select("*")
    .eq("id", notificationId)
    .single()

  if (fetchError) {
    console.error("Error fetching panel notification:", fetchError)
    return { success: false, error: "Failed to fetch notification" }
  }

  const { error } = await supabase
    .from("panel_notifications")
    .delete()
    .eq("id", notificationId)

  if (error) {
    console.error("Error deleting panel notification:", error)
    return { success: false, error: "Failed to delete notification" }
  }

  // Log successful panel deletion
  await logActivity({
    actionType: "delete_panel",
    metadata: {
      panelId: notificationToDelete.id,
      title: notificationToDelete.title,
      timeDay: notificationToDelete.time_day,
      room: notificationToDelete.room,
      panelistName: notificationToDelete.panelist_name,
      panelistContact: notificationToDelete.panelist_contact,
      contactType: notificationToDelete.contact_type,
      topic: notificationToDelete.topic,
      description: notificationToDelete.description,
      literatureReference: notificationToDelete.literature_reference,
      wasNotificationSent: !!notificationToDelete.notification_sent_at,
      wasConfirmed: !!notificationToDelete.confirmed_at,
      wasDenied: !!notificationToDelete.denied_at
    }
  })

  revalidatePath("/host/panels")

  return { success: true }
}

export async function sendPanelNotifications(notificationIds: number[]) {
  const supabase = await createClient()

  try {
    const templateContext = buildProgramTemplateContext(
      await getCurrentProgramOrNull()
    )

    // Get the notifications to send (excluding confirmed and withdrawn)
    const { data: notifications, error } = await supabase
      .from("panel_notifications")
      .select("*")
      .in("id", notificationIds)
      .is("notification_sent_at", null)
      .is("confirmed_at", null)
      .is("denied_at", null)

    if (error) throw error

    if (!notifications || notifications.length === 0) {
      throw new Error(
        "No notifications found or all notifications already sent"
      )
    }

    const results = []

    for (const notification of notifications) {
      try {
        const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/host/panels/confirm/${notification.confirmation_token}`

        let success = false
        let smsResult: {
          success: boolean
          error?: string
          messageIds?: string[]
        } | null = null

        if (notification.contact_type === "email") {
          // Send email using the email API
          const emailContent = generateInitialEmailTemplate(
            notification,
            confirmationUrl,
            templateContext
          )

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
            {
              method: "POST",
              headers: getEmailApiHeaders("panel-notification"),
              body: JSON.stringify({
                to: notification.panelist_contact,
                subject: `${templateContext.title} Panel Invitation: ${notification.title}`,
                panelTitle: notification.title,
                panelTime: notification.time_day,
                panelRoom: notification.room,
                panelistName: notification.panelist_name,
                confirmationUrl: confirmationUrl,
                emailContent: emailContent
              })
            }
          )

          success = response.ok
        } else if (notification.contact_type === "phone") {
          // Send SMS
          const smsMessages = generateInitialSMSTemplates(
            notification,
            confirmationUrl,
            templateContext
          )
          smsResult = await sendMultipleSMS(
            notification.panelist_contact,
            smsMessages,
            notification.id,
            "initial"
          )
          success = smsResult.success

          // Store detailed error if failed
          if (!success && smsResult.error) {
            // We'll update the database with the error below
            notification.send_error = smsResult.error
          }
        }

        if (success) {
          // Update notification as sent with success status
          const updateData: Record<string, string | null> = {
            notification_sent_at: new Date().toISOString(),
            send_status: "success",
            send_error: null
          }

          // Store Twilio message SID if SMS was sent
          if (
            notification.contact_type === "phone" &&
            smsResult?.messageIds
          ) {
            updateData.twilio_message_sid = smsResult.messageIds[0] || null
          }

          const { error: updateError } = await supabase
            .from("panel_notifications")
            .update(updateData)
            .eq("id", notification.id)

          if (updateError) throw updateError

          results.push({
            id: notification.id,
            success: true,
            message: `${notification.contact_type === "email" ? "Email" : "SMS"} sent successfully`
          })
        } else {
          // Update notification with failed status
          const { error: updateError } = await supabase
            .from("panel_notifications")
            .update({
              send_status: "failed",
              send_error:
                notification.send_error ||
                `Failed to send ${notification.contact_type === "email" ? "email" : "SMS"}`
            })
            .eq("id", notification.id)
          if (updateError)
            console.error("Failed to update send status:", updateError)

          results.push({
            id: notification.id,
            success: false,
            message: `Failed to send ${notification.contact_type === "email" ? "email" : "SMS"}`
          })
        }
      } catch (error) {
        // Update notification with error status
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        const { error: updateError } = await supabase
          .from("panel_notifications")
          .update({
            send_status: "failed",
            send_error: errorMessage
          })
          .eq("id", notification.id)
        if (updateError)
          console.error("Failed to update send status:", updateError)

        results.push({
          id: notification.id,
          success: false,
          message: `Error: ${errorMessage}`
        })
      }
    }

    // Log notification sending activity for successful sends only
    const successCount = results.filter((r) => r.success).length

    if (successCount > 0) {
      await logActivity({
        actionType: "send_panel_notification",
        metadata: {
          notificationIds,
          totalNotifications: notifications.length,
          successCount,
          sentNotifications: results.filter((r) => r.success)
        }
      })
    }

    revalidatePath("/host/panels")
    return { success: true, results }
  } catch (error) {
    console.error("Error sending panel notifications:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function sendPanelReminders(
  notificationIds: number[],
  isSecondReminder: boolean = false
) {
  const supabase = await createClient()

  try {
    const templateContext = buildProgramTemplateContext(
      await getCurrentProgramOrNull()
    )

    // Get the notifications to send reminders for (excluding confirmed and withdrawn)
    let query = supabase
      .from("panel_notifications")
      .select("*")
      .in("id", notificationIds)
      .not("notification_sent_at", "is", null)
      .is("confirmed_at", null) // Don't send to confirmed
      .is("denied_at", null) as unknown as PanelNotificationQuery // Don't send to withdrawn

    if (isSecondReminder) {
      // For second reminder, must have first reminder sent but not second
      query = query
        .not("reminder_followup_sent_at", "is", null)
        .is("reminder2_followup_sent_at", null)
    } else {
      // For first reminder, must not have first reminder sent
      query = query.is("reminder_followup_sent_at", null)
    }

    const { data: notifications, error } = await query

    if (error) throw error

    if (!notifications || notifications.length === 0) {
      throw new Error(
        `No notifications found or all ${isSecondReminder ? "second " : ""}reminders already sent`
      )
    }

    const results = []

    for (const notification of notifications) {
      try {
        const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/host/panels/confirm/${notification.confirmation_token}`

        let success = false
        let reminderContent = ""
        let smsResult: {
          success: boolean
          error?: string
          messageIds?: string[]
        } | null = null

        if (notification.contact_type === "email") {
          // Generate reminder email content using the template
          reminderContent = generateFollowUpReminderEmailTemplate(
            notification,
            confirmationUrl,
            templateContext
          )

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
            {
              method: "POST",
              headers: getEmailApiHeaders("panel-notification"),
              body: JSON.stringify({
                to: notification.panelist_contact,
                subject: `Reminder: ${templateContext.title} Panel - ${notification.title}`,
                emailContent: reminderContent
              })
            }
          )

          success = response.ok
        } else if (notification.contact_type === "phone") {
          // Generate reminder SMS content using the template
          const smsMessages = [
            generateFollowUpReminderSMSTemplate(
              notification,
              confirmationUrl,
              templateContext
            )
          ]

          smsResult = await sendMultipleSMS(
            notification.panelist_contact,
            smsMessages,
            notification.id,
            isSecondReminder ? "reminder2" : "reminder1"
          )
          success = smsResult.success

          // Store detailed error if failed
          if (!success && smsResult.error) {
            // This will be used in the error handling below
            notification.reminder_send_error = smsResult.error
          }
        }

        if (success) {
          // Update notification with reminder sent
          const updateData: Record<string, string | null> = isSecondReminder
            ? {
                reminder2_followup_sent_at: new Date().toISOString(),
                reminder2_send_status: "success" as const,
                reminder2_send_error: null
              }
            : {
                reminder_followup_sent_at: new Date().toISOString(),
                reminder_send_status: "success" as const,
                reminder_send_error: null
              }

          // Store Twilio message SID if SMS was sent
          if (
            notification.contact_type === "phone" &&
            smsResult?.messageIds
          ) {
            if (isSecondReminder) {
              updateData.twilio_reminder2_sid = smsResult.messageIds[0] || null
            } else {
              updateData.twilio_reminder_sid = smsResult.messageIds[0] || null
            }
          }

          const { error: updateError } = await supabase
            .from("panel_notifications")
            .update(updateData)
            .eq("id", notification.id)

          if (updateError) throw updateError

          results.push({
            id: notification.id,
            success: true,
            message: `Reminder ${notification.contact_type === "email" ? "email" : "SMS"} sent successfully`
          })
        } else {
          // Update notification with failed reminder status
          const errorMsg =
            notification.reminder_send_error ||
            `Failed to send ${isSecondReminder ? "second " : ""}reminder ${notification.contact_type === "email" ? "email" : "SMS"}`
          const updateData = isSecondReminder
            ? {
                reminder2_send_status: "failed" as const,
                reminder2_send_error: errorMsg
              }
            : {
                reminder_send_status: "failed" as const,
                reminder_send_error: errorMsg
              }

          const { error: updateError } = await supabase
            .from("panel_notifications")
            .update(updateData)
            .eq("id", notification.id)
          if (updateError)
            console.error("Failed to update reminder status:", updateError)

          results.push({
            id: notification.id,
            success: false,
            message: `Failed to send reminder ${notification.contact_type === "email" ? "email" : "SMS"}`
          })
        }
      } catch (error) {
        // Update notification with error status
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        const updateData = isSecondReminder
          ? {
              reminder2_send_status: "failed" as const,
              reminder2_send_error: errorMessage
            }
          : {
              reminder_send_status: "failed" as const,
              reminder_send_error: errorMessage
            }

        const { error: updateError } = await supabase
          .from("panel_notifications")
          .update(updateData)
          .eq("id", notification.id)
        if (updateError)
          console.error("Failed to update reminder status:", updateError)

        results.push({
          id: notification.id,
          success: false,
          message: `Error: ${errorMessage}`
        })
      }
    }

    // Log reminder sending activity
    const successCount = results.filter((r) => r.success).length

    if (successCount > 0) {
      await logActivity({
        actionType: isSecondReminder
          ? "send_panel_reminder2"
          : "send_panel_reminder",
        metadata: {
          notificationIds,
          totalReminders: notifications.length,
          successCount,
          isSecondReminder,
          sentReminders: results.filter((r) => r.success)
        }
      })
    }

    revalidatePath("/host/panels")
    return { success: true, results }
  } catch (error) {
    console.error("Error sending panel reminders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function sendTestNotification(formData: FormData) {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string

  if (!email && !phone) {
    return { error: "Either email or phone is required" }
  }

  // Fetch the first panel to use as a template
  const supabase = await createClient()
  const { data: panel, error: panelError } = await supabase
    .from("panel_notifications")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (panelError || !panel) {
    return {
      error: "Could not fetch a sample panel. Please add a panel first."
    }
  }

  // Create a mock notification object using the first panel's data
  const mockNotification: PanelNotification = {
    ...panel,
    panelist_contact: email || phone,
    contact_type: email ? "email" : "phone",
    confirmation_token: "test-token"
  }

  const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/host/panels/confirm/${mockNotification.confirmation_token}`
  const templateContext = buildProgramTemplateContext(
    await getCurrentProgramOrNull()
  )

  try {
    let success = false
    if (email) {
      const emailContent = generateInitialEmailTemplate(
        mockNotification,
        confirmationUrl,
        templateContext
      )
      const emailData = {
        to: email,
        subject: `${templateContext.title} Panel Invitation: ${mockNotification.title}`,
        emailContent
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
        {
          method: "POST",
          headers: getEmailApiHeaders("panel-notification"),
          body: JSON.stringify(emailData)
        }
      )
      success = response.ok
    }

    if (phone) {
      const smsContent = generateInitialSMSTemplates(
        mockNotification,
        confirmationUrl,
        templateContext
      )
      const smsResult = await sendMultipleSMS(phone, smsContent)
      success = smsResult.success
    }

    if (success) {
      return { success: "Test notification sent successfully!" }
    } else {
      return { error: "Failed to send test notification" }
    }
  } catch (error) {
    console.error("Error sending test notification:", error)
    return { error: "An unexpected error occurred while sending." }
  }
}

export async function getTestNotificationPreview(formData: FormData) {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string

  if (!email && !phone) {
    return { error: "Either email or phone is required" }
  }

  // Fetch the first panel to use as a template
  const supabase = await createClient()
  const { data: panel, error: panelError } = await supabase
    .from("panel_notifications")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (panelError || !panel) {
    return {
      error: "Could not fetch a sample panel. Please add a panel first."
    }
  }

  // Create a mock notification object using the first panel's data
  const mockNotification: PanelNotification = {
    ...panel,
    panelist_contact: email || phone,
    contact_type: email ? "email" : "phone",
    confirmation_token: "test-token"
  }

  const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/host/panels/confirm/${mockNotification.confirmation_token}`
  const templateContext = buildProgramTemplateContext(
    await getCurrentProgramOrNull()
  )

  let content: string
  if (email) {
    content = generateInitialEmailTemplate(
      mockNotification,
      confirmationUrl,
      templateContext
    )
  } else if (phone) {
    const smsMessages = generateInitialSMSTemplates(
      mockNotification,
      confirmationUrl,
      templateContext
    )
    content = smsMessages.join("\\n\\n--- MESSAGE BREAK --\\n\\n")
  } else {
    return { error: "No contact method provided." }
  }

  return { success: true, content }
}

export async function getUnconfirmedNotifications() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("panel_notifications")
    .select("*")
    .is("notification_sent_at", null)
    .order("time_day", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    console.error("Error fetching unconfirmed notifications:", error)
    return []
  }

  return data || []
}

export async function updateNotificationStatus(
  notificationId: number,
  field: string,
  value: boolean
) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Define allowed fields for safety
  const allowedFields = [
    "notification_sent_at",
    "confirmed_at",
    "denied_at",
    "reminder_followup_sent_at",
    "reminder2_followup_sent_at"
  ]

  if (!allowedFields.includes(field)) {
    return { error: "Invalid field specified" }
  }

  try {
    // Prepare update data
    const updateData: Record<string, string | null> = {}

    if (value) {
      // Setting to true - add timestamp
      updateData[field] = new Date().toISOString()

      // Also set corresponding status fields to success if they exist
      if (field === "notification_sent_at") {
        updateData.send_status = "success"
        updateData.send_error = null
      } else if (field === "reminder_followup_sent_at") {
        updateData.reminder_send_status = "success"
        updateData.reminder_send_error = null
      } else if (field === "reminder2_followup_sent_at") {
        updateData.reminder2_send_status = "success"
        updateData.reminder2_send_error = null
      }
    } else {
      // Setting to false - remove timestamp
      updateData[field] = null

      // Also clear corresponding status fields
      if (field === "notification_sent_at") {
        updateData.send_status = null
        updateData.send_error = null
      } else if (field === "reminder_followup_sent_at") {
        updateData.reminder_send_status = null
        updateData.reminder_send_error = null
      } else if (field === "reminder2_followup_sent_at") {
        updateData.reminder2_send_status = null
        updateData.reminder2_send_error = null
      }
    }

    // Handle special logic for confirmed_at and denied_at (mutually exclusive)
    if (field === "confirmed_at" && value) {
      updateData.denied_at = null
    } else if (field === "denied_at" && value) {
      updateData.confirmed_at = null
    }

    // Update the notification
    const { error } = await supabase
      .from("panel_notifications")
      .update(updateData)
      .eq("id", notificationId)

    if (error) {
      console.error("Error updating notification status:", error)
      return { error: "Failed to update notification status" }
    }

    // Log the manual status update
    await logActivity({
      actionType: "update_notification_status",
      metadata: {
        notificationId,
        field,
        newValue: value,
        updatedFields: updateData
      }
    })

    revalidatePath("/host/panels")
    return { success: "Notification status updated successfully" }
  } catch (error) {
    console.error("Error updating notification status:", error)
    return { error: "Failed to update notification status" }
  }
}

export async function createSinglePanel(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const timeDay = formData.get("time_day") as string
  const room = formData.get("room") as string
  const title = formData.get("title") as string
  const topic = formData.get("topic") as string
  const description = formData.get("description") as string
  const literatureReference = formData.get("literature_reference") as string
  const panelistName = formData.get("panelist_name") as string
  const panelistContact = formData.get("panelist_contact") as string
  const contactType = formData.get("contact_type") as string

  // Validation
  if (
    !timeDay ||
    !room ||
    !title ||
    !panelistName ||
    !panelistContact ||
    !contactType
  ) {
    return { error: "Please fill in all required fields" }
  }

  if (contactType !== "email" && contactType !== "phone") {
    return { error: "Contact type must be either email or phone" }
  }

  try {
    // Check if this panelist notification already exists
    const { data: existing, error: existingError } = await supabase
      .from("panel_notifications")
      .select("id")
      .eq("title", title)
      .eq("panelist_name", panelistName)
      .eq("time_day", timeDay)
      .eq("room", room)
      .maybeSingle()

    if (existingError) {
      console.error("Error checking for existing notification:", existingError)
      return { error: "Error checking for existing panel" }
    }

    if (existing) {
      return {
        error:
          "A panel notification already exists for this panelist on this panel"
      }
    }

    // Create the panel notification
    const { data: savedNotification, error } = await supabase
      .from("panel_notifications")
      .insert({
        time_day: timeDay,
        room: room,
        title: title,
        topic: topic || null,
        description: description || null,
        literature_reference: literatureReference || null,
        panelist_name: panelistName,
        panelist_contact: panelistContact,
        contact_type: contactType
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating panel notification:", error)
      return { error: "Failed to create panel notification" }
    }

    // Log successful panel creation
    await logActivity({
      actionType: "create_panel",
      metadata: {
        panelId: savedNotification.id,
        title: savedNotification.title,
        timeDay: savedNotification.time_day,
        room: savedNotification.room,
        panelistName: savedNotification.panelist_name,
        panelistContact: savedNotification.panelist_contact,
        contactType: savedNotification.contact_type,
        topic: savedNotification.topic,
        description: savedNotification.description,
        literatureReference: savedNotification.literature_reference
      }
    })

    revalidatePath("/host/panels")
    return {
      success: "Panel notification created successfully",
      data: savedNotification
    }
  } catch (error) {
    console.error("Error creating panel notification:", error)
    return { error: "Failed to create panel notification" }
  }
}

export async function updatePanelNotification(
  notificationId: number,
  formData: FormData
) {
  try {
    const supabase = await createClient()

    // Get current user for audit log
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Extract form data
    const timeDay = formData.get("time_day") as string
    const room = formData.get("room") as string
    const title = formData.get("title") as string
    const topic = formData.get("topic") as string | null
    const description = formData.get("description") as string | null
    const literatureReference = formData.get("literature_reference") as
      | string
      | null
    const panelistName = formData.get("panelist_name") as string
    const contactType = formData.get("contact_type") as string
    const panelistContact = formData.get("panelist_contact") as string

    // Validate required fields
    if (
      !timeDay ||
      !room ||
      !title ||
      !panelistName ||
      !contactType ||
      !panelistContact
    ) {
      return { error: "Missing required fields" }
    }

    // Update the panel notification
    const { data: updatedNotification, error } = await supabase
      .from("panel_notifications")
      .update({
        time_day: timeDay,
        room: room,
        title: title,
        topic: topic || null,
        description: description || null,
        literature_reference: literatureReference || null,
        panelist_name: panelistName,
        panelist_contact: panelistContact,
        contact_type: contactType,
        updated_at: new Date().toISOString()
      })
      .eq("id", notificationId)
      .select()
      .single()

    if (error) {
      console.error("Error updating panel notification:", error)
      return { error: "Failed to update panel notification" }
    }

    // Log the update activity
    await logActivity({
      actionType: "update_panel",
      metadata: {
        notificationId,
        panel: {
          title,
          timeDay,
          room,
          panelistName,
          panelistContact
        }
      }
    })

    revalidatePath("/host/panels")
    return {
      success: "Panel notification updated successfully",
      data: updatedNotification
    }
  } catch (error) {
    console.error("Error updating panel notification:", error)
    return { error: "Failed to update panel notification" }
  }
}

import { PanelNotification } from "@/app/host/panels/actions"
import { Shift, ShiftAssignment } from "@/app/host/shift-scheduling/types"
import { getEmailApiHeaders } from "@/lib/email-api"
import {
  generateOneDayReminderEmailTemplate,
  generateOneDayReminderSMSTemplate,
  generateOneHourReminderEmailTemplate,
  generateOneHourReminderSMSTemplate
} from "@/lib/panel-notification-templates"
import {
  generateVolunteerReminderEmailTemplate,
  generateVolunteerReminderSMSTemplate,
  VolunteerShiftDetails
} from "@/lib/volunteer-notification-templates"
import { createClient } from "@/utils/supabase/server"
import { NextRequest } from "next/server"
import twilio from "twilio"

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

// Helper function to send SMS
async function sendSMS(
  to: string,
  message: string,
  notificationId?: number
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration")
    return { success: false, error: "Missing Twilio configuration" }
  }

  const normalizedPhone = normalizePhoneNumber(to)

  try {
    const client = twilio(accountSid, authToken)

    // Construct webhook URL
    const webhookUrl = `https://icyhost.org/api/webhooks/twilio`

    const messageOptions: any = {
      from: fromNumber,
      to: normalizedPhone,
      body: message,
      statusCallback: webhookUrl
    }

    // Add custom parameters for webhook processing
    if (notificationId) {
      messageOptions.statusCallbackMethod = "POST"
      messageOptions.statusCallback = `${webhookUrl}?NotificationId=${notificationId}&ReminderType=auto`
    }

    const sentMessage = await client.messages.create(messageOptions)

    console.log(
      `SMS sent successfully to ${normalizedPhone}. Message ID: ${sentMessage.sid}`
    )
    return { success: true, messageId: sentMessage.sid }
  } catch (error: any) {
    console.error(`Error sending SMS to ${normalizedPhone}:`, error)

    // Extract meaningful error message
    let errorMessage = "Failed to send SMS"

    if (error.code === 21211 || error.code === 21614) {
      errorMessage = "Invalid phone number format"
    } else if (error.code === 21408) {
      errorMessage = "Permission denied to send to this number"
    } else if (error.code === 21610) {
      errorMessage = "Recipient has opted out of messages"
    } else if (error.code === 21612) {
      errorMessage = "Not a valid mobile number (may be landline)"
    } else if (error.message) {
      errorMessage = error.message
    }

    return { success: false, error: errorMessage }
  }
}

// Helper function to parse panel time and check if reminder should be sent
function shouldSendReminder(
  timeDay: string,
  hoursBeforePanel: number
): boolean {
  // Parse the time and day from the timeDay string
  const dayMatch = timeDay.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
  )
  const timeMatch = timeDay.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i)

  if (!dayMatch || !timeMatch) {
    console.log(`Could not parse time/day from: ${timeDay}`)
    return false
  }

  const day = dayMatch[1]
  let hour = parseInt(timeMatch[1])
  const minute = parseInt(timeMatch[2])
  const period = timeMatch[3]

  // Convert to 24-hour format
  if (period) {
    if (period.toUpperCase() === "PM" && hour !== 12) {
      hour += 12
    } else if (period.toUpperCase() === "AM" && hour === 12) {
      hour = 0
    }
  }

  // Map day names to dates for the conference
  const dayToDates: Record<string, string> = {
    thursday: "2025-08-28",
    friday: "2025-08-29",
    saturday: "2025-08-30",
    sunday: "2025-08-31"
  }

  const panelDate = dayToDates[day.toLowerCase()]
  if (!panelDate) {
    console.log(`Unknown day: ${day}`)
    return false
  }

  // Create panel datetime in CST (times from DB are already in CST)
  const panelDateTime = new Date(
    `${panelDate}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00-05:00`
  )

  // Calculate when reminder should be sent
  const reminderTime = new Date(
    panelDateTime.getTime() - hoursBeforePanel * 60 * 60 * 1000
  )

  // Current time
  const now = new Date()

  // Check if we're within 5 minutes of the reminder time
  const timeDiff = Math.abs(now.getTime() - reminderTime.getTime())
  const shouldSend = timeDiff <= 5 * 60 * 1000

  if (shouldSend) {
    console.log(
      `Should send ${hoursBeforePanel}-hour reminder for panel at ${timeDay}`
    )
  }

  return shouldSend
}

// Helper function to check if volunteer shift reminder should be sent
function shouldSendVolunteerReminder(
  shiftDate: string,
  startTime: string,
  hoursBeforeShift: number
): boolean {
  // Shift times from DB are already in CST
  // Create shift datetime in CST
  const shiftDateTime = new Date(`${shiftDate}T${startTime}:00-05:00`)

  // Calculate when reminder should be sent
  const reminderTime = new Date(
    shiftDateTime.getTime() - hoursBeforeShift * 60 * 60 * 1000
  )

  // Current time
  const now = new Date()

  // Check if we're within 5 minutes of the reminder time
  const timeDiff = Math.abs(now.getTime() - reminderTime.getTime())
  const shouldSend = timeDiff <= 5 * 60 * 1000

  if (shouldSend) {
    console.log(
      `Should send ${hoursBeforeShift}-hour reminder for shift on ${shiftDate} at ${startTime}`
    )
  }

  return shouldSend
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    // PANEL REMINDERS TEMPORARILY DISABLED
    // Commenting out panel reminder logic per request
    /*
    const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Fetch all confirmed panel notifications
    const { data: notifications, error } = await supabase
      .from("panel_notifications")
      .select("*")
      .not("confirmed_at", "is", null) // Only confirmed panelists
      .is("denied_at", null) // Not withdrawn

    if (error) {
      console.error("Error fetching panel notifications:", error)
      return new Response("Error fetching notifications", { status: 500 })
    }

    let oneDayRemindersSent = 0
    let oneHourRemindersSent = 0
    let errors = 0

    for (const notification of notifications as PanelNotification[]) {
      // Check for 1-day reminder (uses reminder2 fields)
      if (
        !notification.reminder2_followup_sent_at &&
        shouldSendReminder(notification.time_day, 24)
      ) {
        let success = false
        let errorMessage = ""

        try {
          if (notification.contact_type === "email") {
            // Send email reminder
            const emailContent =
              generateOneDayReminderEmailTemplate(notification)

            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
              {
                method: "POST",
                headers: getEmailApiHeaders("panel-notification"),
                body: JSON.stringify({
                  to: notification.panelist_contact,
                  subject: `Reminder: Speaking Tomorrow - ${notification.title}`,
                  emailContent: emailContent
                })
              }
            )

            success = response.ok
          } else if (notification.contact_type === "phone") {
            // Send SMS reminder
            const smsContent = generateOneDayReminderSMSTemplate(notification)
            const smsResult = await sendSMS(
              notification.panelist_contact,
              smsContent,
              notification.id
            )
            success = smsResult.success
            if (!success) errorMessage = smsResult.error || ""
          }

          // Update database with reminder status (using reminder2 fields for 1-day)
          const updateData: any = {
            reminder2_followup_sent_at: success
              ? new Date().toISOString()
              : null,
            reminder2_send_status: success ? "success" : "failed",
            reminder2_send_error: success ? null : errorMessage
          }

          await supabase
            .from("panel_notifications")
            .update(updateData)
            .eq("id", notification.id)

          if (success) {
            oneDayRemindersSent++
            console.log(`1-day reminder sent to ${notification.panelist_name}`)
          } else {
            errors++
            console.error(
              `Failed to send 1-day reminder to ${notification.panelist_name}`
            )
          }
        } catch (error) {
          errors++
          console.error(`Error sending 1-day reminder:`, error)
        }
      }

      // Check for 1-hour reminder (uses reminder3 fields)
      if (
        !notification.reminder3_followup_sent_at &&
        shouldSendReminder(notification.time_day, 1)
      ) {
        let success = false
        let errorMessage = ""

        try {
          if (notification.contact_type === "email") {
            // Send email reminder
            const emailContent =
              generateOneHourReminderEmailTemplate(notification)

            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
              {
                method: "POST",
                headers: getEmailApiHeaders("panel-notification"),
                body: JSON.stringify({
                  to: notification.panelist_contact,
                  subject: `Starting Soon: ${notification.title}`,
                  emailContent: emailContent
                })
              }
            )

            success = response.ok
          } else if (notification.contact_type === "phone") {
            // Send SMS reminder
            const smsContent = generateOneHourReminderSMSTemplate(notification)
            const smsResult = await sendSMS(
              notification.panelist_contact,
              smsContent,
              notification.id
            )
            success = smsResult.success
            if (!success) errorMessage = smsResult.error || ""
          }

          // Update database with reminder status (using reminder3 fields for 1-hour)
          const updateData: any = {
            reminder3_followup_sent_at: success
              ? new Date().toISOString()
              : null,
            reminder3_send_status: success ? "success" : "failed",
            reminder3_send_error: success ? null : errorMessage
          }

          await supabase
            .from("panel_notifications")
            .update(updateData)
            .eq("id", notification.id)

          if (success) {
            oneHourRemindersSent++
            console.log(`1-hour reminder sent to ${notification.panelist_name}`)
          } else {
            errors++
            console.error(
              `Failed to send 1-hour reminder to ${notification.panelist_name}`
            )
          }
        } catch (error) {
          errors++
          console.error(`Error sending 1-hour reminder:`, error)
        }
      }
    }
    */

    // PANEL AND VOLUNTEER REMINDERS TEMPORARILY DISABLED
    // Process volunteer shift reminders
    // console.log("Processing volunteer shift reminders...")
    // let volunteerRemindersSent = 0
    // let volunteerErrors = 0

    /*
    // Fetch all shifts with assignments for reminder checking
    const { data: shifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("*")
      .not("assignments", "eq", "[]") // Only shifts with assignments

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError)
    } else if (shifts) {
      for (const shift of shifts as Shift[]) {
        // Check if we should send 1-hour reminder for this shift
        if (shouldSendVolunteerReminder(shift.date, shift.start_time, 1)) {
          // Process each assignment in this shift
          for (const assignment of shift.assignments) {
            // Skip if no contact info
            if (!assignment.contact) continue

            // Track if reminder was already sent (store in assignment metadata)
            const assignmentWithMeta = assignment as any
            if (assignmentWithMeta.reminderSent) continue

            let success = false
            let errorMessage = ""

            // Determine if contact is email or phone
            const isEmail = assignment.contact.includes("@")

            const shiftDetails: VolunteerShiftDetails = {
              volunteerId: assignment.id,
              volunteerName: assignment.name,
              volunteerContact: assignment.contact,
              shiftDate: shift.date,
              startTime: shift.start_time,
              endTime: shift.end_time,
              jobType: shift.job_type,
              location: shift.location
            }

            try {
              if (isEmail) {
                // Send email reminder
                const emailContent =
                  generateVolunteerReminderEmailTemplate(shiftDetails)

                const response = await fetch(
                  `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
                  {
                    method: "POST",
                    headers: getEmailApiHeaders("volunteer-reminder"),
                    body: JSON.stringify({
                      to: assignment.contact,
                      subject: `Volunteer Reminder: ${shift.job_type} Tomorrow`,
                      emailContent: emailContent
                    })
                  }
                )

                success = response.ok
              } else {
                // Send SMS reminder
                const smsContent =
                  generateVolunteerReminderSMSTemplate(shiftDetails)
                const smsResult = await sendSMS(assignment.contact, smsContent)
                success = smsResult.success
                if (!success) errorMessage = smsResult.error || ""
              }

              if (success) {
                volunteerRemindersSent++
                console.log(
                  `Volunteer reminder sent to ${assignment.name} for ${shift.job_type} shift`
                )

                // Mark reminder as sent in assignment metadata
                const updatedAssignments = shift.assignments.map(
                  (a: ShiftAssignment) => {
                    if (a.id === assignment.id) {
                      return { ...a, reminderSent: true } as any
                    }
                    return a
                  }
                )

                // Update shift with marked assignment
                await supabase
                  .from("shifts")
                  .update({ assignments: updatedAssignments })
                  .eq("id", shift.id)
              } else {
                volunteerErrors++
                console.error(
                  `Failed to send volunteer reminder to ${assignment.name}: ${errorMessage}`
                )
              }
            } catch (error) {
              volunteerErrors++
              console.error(
                `Error sending volunteer reminder to ${assignment.name}:`,
                error
              )
            }
          }
        }
      }
    }
    */

    // Return a simple response indicating reminders are disabled
    return new Response(
      JSON.stringify({
        success: true,
        message: "Panel and volunteer reminders are temporarily disabled",
        panelReminders: {
          oneDayRemindersSent: 0,
          oneHourRemindersSent: 0,
          errors: 0
        },
        volunteerReminders: {
          remindersSent: 0,
          errors: 0
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error("Error in panel reminders cron:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

import { NextRequest } from "next/server"
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
    const currentProgram = await getCurrentProgramOrNull()
    const dayToDates = buildProgramDayMap(currentProgram)

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
        shouldSendReminder(notification.time_day, 24, dayToDates)
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
        shouldSendReminder(notification.time_day, 1, dayToDates)
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

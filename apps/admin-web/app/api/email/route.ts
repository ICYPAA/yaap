import { headers } from "next/headers"
import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Helper functions for volunteer email formatting
function getVolunteerTypeDisplayName(volunteerType: string): string {
  const typeMap: Record<string, string> = {
    general: "General Volunteering Interest",
    marathon: "Marathon Meeting",
    hospitality: "Hospitality",
    ic2025: "IC 2025 Conference",
    outreach: "Outreach Committee",
    specific: "Specific Event Volunteering"
  }
  return typeMap[volunteerType] || volunteerType
}

function formatVolunteerDetails(volunteerType: string, details: any): string {
  switch (volunteerType) {
    case "general":
      const interests = []
      if (details.interests?.greeter) interests.push("Greeter")
      if (details.interests?.security) interests.push("Security")
      if (details.interests?.cleanup) interests.push("Cleanup")
      if (details.interests?.setup) interests.push("Setup")
      if (details.interests?.hostCommittee) interests.push("Host Committee")
      if (details.interests?.wherever) interests.push("Wherever Needed")

      const timeSlots = []
      if (details.timeSlots?.thursdayPM) timeSlots.push("Thursday PM")
      if (details.timeSlots?.fridayAM) timeSlots.push("Friday AM")
      if (details.timeSlots?.fridayMidday) timeSlots.push("Friday Midday")
      if (details.timeSlots?.fridayPM) timeSlots.push("Friday PM")
      if (details.timeSlots?.saturdayAM) timeSlots.push("Saturday AM")
      if (details.timeSlots?.saturdayMidday) timeSlots.push("Saturday Midday")
      if (details.timeSlots?.saturdayPM) timeSlots.push("Saturday PM")
      if (details.timeSlots?.sundayAM) timeSlots.push("Sunday AM")
      if (details.timeSlots?.sundayMidday) timeSlots.push("Sunday Midday")
      if (details.timeSlots?.sundayPM) timeSlots.push("Sunday PM")

      return `
Areas of Interest: ${interests.join(", ") || "None specified"}
Available Time Slots: ${timeSlots.join(", ") || "None specified"}
${details.timeSlots?.other ? `Other Availability: ${details.timeSlots.other}` : ""}
${details.comments ? `Additional Comments: ${details.comments}` : ""}`

    case "marathon":
      return `
Day: ${details.day}
Time Slot: ${details.timeSlot}
${details.bringingScript ? "Bringing Script: Yes" : "Bringing Script: No"}
${details.meetingCommittee ? `Meeting Committee: ${details.meetingCommittee}` : ""}
${details.comments ? `Comments: ${details.comments}` : ""}`

    case "hospitality":
      return `
Day: ${details.day}
Time Slot: ${details.timeSlot}
Previous Experience: ${details.previousExperience ? "Yes" : "No"}
${details.groupName ? `Group Name: ${details.groupName}` : ""}
${details.comments ? `Comments: ${details.comments}` : ""}`

    case "ic2025":
      return `
Day: ${details.day}
Time Slot: ${details.timeSlot}
Group Name: ${details.groupName}
${details.comments ? `Comments: ${details.comments}` : ""}`

    case "outreach":
      return `
Committee: ${details.committee}
Willing to Serve: ${details.willingToServe ? "Yes" : "No"}
${details.comments ? `Comments: ${details.comments}` : ""}`

    case "specific":
      return `
Event: ${details.event}
Selected Time Slots: ${details.slots?.map((slot: any) => `${slot.job} - ${slot.timeSlot}`).join(", ") || "None specified"}`

    default:
      return ""
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers()
    const hCaptchaToken = headersList.get("captcha-token")
    const emailType = headersList.get("email-type") || "contact"

    // Only verify hCaptcha for contact form submissions
    if (emailType === "contact") {
      // Verify the hCaptcha token
      const { success } = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `response=${hCaptchaToken}&secret=${process.env.HCAPTCHA_SECRET_KEY!}`
      }).then((res) => res.json())

      if (!success) {
        return NextResponse.json(
          { error: "Failed to verify hCaptcha token" },
          { status: 400 }
        )
      }
    }

    // Parse the form data from the request body
    const data = await req.json()

    // Set up Nodemailer transporter with your email provider details
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "josh@themindfulpug.com",
        pass: process.env.EMAIL_PASSWORD
      }
    })

    let mailOptions

    if (emailType === "volunteer-confirmation") {
      const { name, email, volunteerType, details } = data

      // Create volunteer-specific email content based on type
      let emailSubject = `Volunteer Signup Confirmation - ${name}`
      let emailContent = `Dear ${name},

Thank you for signing up to volunteer for the 65th ICYPAA Conference!

Volunteer Type: ${getVolunteerTypeDisplayName(volunteerType)}
${formatVolunteerDetails(volunteerType, details)}

We appreciate your willingness to serve and will be reaching out with more details as the conference approaches.

If you have any questions, please don't hesitate to contact us.

In Unity and Service,
The 65th ICYPAA Host Committee

---
This is an automated confirmation email. Please do not reply to this email.`

      mailOptions = {
        from: '"The 65th ICYPAA Host Committee" <josh@themindfulpug.com>',
        to: email,
        subject: emailSubject,
        text: emailContent
      }
    } else if (emailType === "report") {
      const {
        team,
        chairPosition,
        completedWork,
        currentWork,
        needsHelp,
        teamMeetingItems,
        shareInMeeting,
        userEmail,
        userName,
        date,
        isNothingToReport = false
      } = data

      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })

      // Build the email content based on whether it's a "nothing to report" email or a regular report
      let emailContent
      let emailSubject

      if (isNothingToReport) {
        emailSubject = `[Report Submission] ${team} - ${userName} - ${chairPosition}`
        emailContent = `Report Date: ${formattedDate}

Submitted By: ${userName} (${userEmail})
Report For: ${team}
Position: ${chairPosition}

This member has submitted a "Nothing to Report" status.`
      } else {
        emailSubject = `[Report Submission] ${team} - ${userName} - ${chairPosition}`
        emailContent = `Report Date: ${formattedDate}

Submitted By: ${userName} (${userEmail})
Report For: ${team}
Position: ${chairPosition}

Completed Since Last Meeting:
${completedWork || "No completed work reported"}

Current Work:
${currentWork || "No current work reported"}

Needs Help With:
${needsHelp || "No help needed"}

Team Meeting Items:
${teamMeetingItems || "No team meeting items"}

Pertinent to Share in Meeting:
${shareInMeeting || "No pertinent items to share"}`
      }

      mailOptions = {
        from: '"ICYPAA Host Committee" <josh@themindfulpug.com>',
        to: "it-chair@icyhost.org",
        subject: emailSubject,
        text: emailContent
      }

      if (team === "MAIN_MEETING") {
        mailOptions.to =
          "chair@icyhost.org,altchair@icyhost.org,secretary@icyhost.org"
      } else if (team === "HOST_TEAM_1") {
        mailOptions.to = "altchair@icyhost.org"
      } else if (team === "HOST_TEAM_2") {
        mailOptions.to = "treasurer@icyhost.org"
      } else if (team === "HOST_TEAM_3") {
        mailOptions.to = "secretary@icyhost.org"
      } else {
        mailOptions.to = "it-chair@icyhost.org"
      }
    } else if (emailType === "panel-notification") {
      const { to, subject, emailContent } = data

      mailOptions = {
        from: '"The 65th ICYPAA Program Committee" <josh@themindfulpug.com>',
        to: to || undefined,
        subject: subject,
        text: emailContent
      }
    } else if (emailType === "test-notification") {
      // Handle test notifications
      const { to, subject, emailContent } = data

      mailOptions = {
        from: '"ICYPAA Test Notification" <josh@themindfulpug.com>',
        to: to || undefined,
        subject: subject,
        text: emailContent
      }
    } else {
      // Default to contact form email
      const { firstName, lastName, inquiryType, email, phone, message } = data

      mailOptions = {
        from: '"Josh Greenwell" <josh@themindfulpug.com>',
        to: "secretary@icyhost.org",
        subject: `${inquiryType.charAt(0).toUpperCase() + inquiryType.slice(1).toLowerCase()} | Website Contact Form Submission`,
        text: `Name: ${firstName} ${lastName}\nEmail: ${email}\nPhone ${phone}\n\n${message}`
      }
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions)

    // Return a success response with message ID for tracking
    return NextResponse.json({ 
      message: "Email sent successfully!",
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    })
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}

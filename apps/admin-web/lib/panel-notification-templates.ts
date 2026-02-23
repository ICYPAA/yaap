import { PanelNotification } from "@/app/host/panels/actions"

// Helper function to get first name from full name
function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName
}

// Helper function to format time with 1-hour duration
function formatPanelTime(timeString: string): string {
  if (!timeString || !timeString.includes(":")) return "TBD"

  const [time, period] = timeString.split(" ")
  const [hourStr, minuteStr] = time.split(":")
  let hour = parseInt(hourStr, 10)

  if (period && period.toLowerCase() === "pm" && hour < 12) {
    hour += 12
  }
  if (period && period.toLowerCase() === "am" && hour === 12) {
    hour = 0
  }

  const startDate = new Date()
  startDate.setHours(hour, parseInt(minuteStr, 10), 0, 0)

  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

  const formatTime = (date: Date) => {
    let h = date.getHours()
    const m = date.getMinutes().toString().padStart(2, "0")
    const p = h >= 12 ? "PM" : "AM"
    h = h % 12 || 12
    return `${h}:${m} ${p}`
  }

  return `${formatTime(startDate)} - ${formatTime(endDate)}`
}

// Helper function to parse time and day for display
function parseTimeAndDay(timeDay: string): { time: string; day: string } {
  // Try to extract day and time from the timeDay string
  const dayMatch = timeDay.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
  )
  const timeMatch = timeDay.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i)

  const day = dayMatch ? dayMatch[1] : timeDay
  const time = timeMatch ? timeMatch[1] : "TBD"

  // Format the day for display
  const dayMappings: Record<string, string> = {
    thursday: "Thursday, Aug 28th",
    friday: "Friday, Aug 29th",
    saturday: "Saturday, Aug 30th",
    sunday: "Sunday, Aug 31st"
  }

  const formattedDay = dayMappings[day.toLowerCase()] || day

  return { time, day: formattedDay }
}

// Generate initial invitation email template
export function generateInitialEmailTemplate(
  notification: PanelNotification,
  confirmationLink: string
): string {
  const firstName = getFirstName(notification.panelist_name)
  const { time, day } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  return `Dear ${firstName}

We are so hyped to formally send this loving invitation on behalf of The 65th ICYPAA Host Committee to be one of the panelists at our "${notification.title}: ${notification.topic || ""}" panel, at The 65th International Conference of Young People in Alcoholics Anonymous in Minneapolis, MN August 28th - August 31st, 2025. Details are as follows:

(Subject to Change) Date of Meeting: ${day}
Time: ${formattedTime}
Meeting Room: ${notification.room}
Length of Your Talk: 10-15 Minutes

The Description for the panel is: ${notification.description || "No description provided"}

Confirm you will be there: ${confirmationLink}

We do have some things we'd like you to be mindful of when speaking on a panel at ICYPAA.

- Please arrive 10 minutes early to your panel and introduce yourself to the Host member chairing the meeting.
- Dress appropriately.
- Be respectful to the other panelists you're sharing with.
- Make sure to share on the topic you're asked to speak on.
- Please avoid obscene language and any derogatory comments that may offend attendees.

ICYPAA strives to provide a safe and welcoming space, and allow for all its attendees to experience A New And Wonderful World.

If you're unable to make it to speak on your panel. Please let us know as soon as possible.

Ever mindful that our primary purpose is to stay sober and help other alcoholics to achieve sobriety, we ask all speakers, as they weave the selected topic into their talk, to focus on their experience, strength and hope, as it relates to their recovery in AA from alcoholism. Remember; you may be the first impression on someone hearing AA for the first time.

Don't forget to pre-register, book your room, and buy a pre-con ticket! → https://www.icypaa.org/.
We do not pay travel expenses or registration fees for AA panelists who participate in the conference, all attendees must be pre-registered or plan to register at the conference.

In love and service,

Danielle J.
The 65th ICYPAA Program Chair
(518) 708-7458`
}

// Generate initial invitation SMS templates (multiple messages)
export function generateInitialSMSTemplates(
  notification: PanelNotification,
  confirmationLink: string
): string[] {
  const firstName = getFirstName(notification.panelist_name)
  const { time, day } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  const messages = [
    // Message 1: Invitation and basic details
    `Dear ${firstName}

We are so hyped to formally send this loving invitation on behalf of The 65th ICYPAA Host Committee to be one of the panelists at our "${notification.title}: ${notification.topic || ""}" panel, at The 65th International Conference of Young People in Alcoholics Anonymous in Minneapolis, MN August 28th - August 31st, 2025. Details are as follows:

Date: ${day}
Time: ${formattedTime}
Room: ${notification.room}
Talk Length: 10-15 Minutes

Description: ${notification.description || "No description provided"}`,

    // Message 2: Guidelines
    `Panel Guidelines:

- Arrive 10 minutes early and introduce yourself to the Host member chairing the meeting
- Dress appropriately
- Be respectful to other panelists
- Share on the assigned topic
- Avoid obscene language and derogatory comments

ICYPAA strives to provide a safe and welcoming space for all attendees to experience A New And Wonderful World.`,

    // Message 3: Additional info and confirmation
    `Ever mindful that our primary purpose is to stay sober and help other alcoholics achieve sobriety, please focus on your experience, strength and hope as it relates to your recovery in AA from alcoholism.

If unable to attend, please let us know ASAP.

Don't forget to pre-register, book your room, and buy a pre-con ticket! https://www.icypaa.org/
We do not pay travel expenses or registration fees for AA panelists who participate in the conference, all attendees must be pre-registered or plan to register at the conference.

In love and service,
Danielle J. - The 65th ICYPAA Program Chair
(518) 708-7458

Confirm attendance: ${confirmationLink}`
  ]

  return messages
}

// Generate follow-up reminder email template (for unconfirmed panelists)
export function generateFollowUpReminderEmailTemplate(
  notification: PanelNotification,
  confirmationLink: string
): string {
  const { time, day } = parseTimeAndDay(notification.time_day)

  return `Hello, The 65th ICYPAA Host Committee again, reminding you to confirm your availability for ${notification.title} panel on ${day} ${time}

Click link to confirm or withdraw:

${confirmationLink}

Time and Date are subject to change.

In service,
DJ`
}

// Generate follow-up reminder SMS template (for unconfirmed panelists)
export function generateFollowUpReminderSMSTemplate(
  notification: PanelNotification,
  confirmationLink: string
): string {
  const { time, day } = parseTimeAndDay(notification.time_day)

  return `Hello, The 65th ICYPAA Host Committee again, reminding you to confirm your availability for ${notification.title} panel on ${day} ${time}

Click link to confirm or withdraw:

${confirmationLink}

Time and Date are subject to change.

In service,
DJ
(518) 708-7458

Responding to this text goes to the void!`
}

// Generate 1-day before panel reminder email template
export function generateOneDayReminderEmailTemplate(
  notification: PanelNotification
): string {
  const firstName = getFirstName(notification.panelist_name)
  const { time, day } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  return `Hi ${firstName},

This is a friendly reminder that you're speaking on the "${notification.title}" panel tomorrow!

Panel Details:
Date: ${day}
Time: ${formattedTime}
Room: ${notification.room}
Talk Length: 10-15 Minutes

Please remember to:
- Arrive 10 minutes early
- Introduce yourself to the Host member chairing the meeting
- Prepare a 10-15 minute share on the topic

Looking forward to hearing your experience, strength, and hope!

In love and service,
Danielle J.
The 65th ICYPAA Program Chair
(518) 708-7458`
}

// Generate 1-day before panel reminder SMS template
export function generateOneDayReminderSMSTemplate(
  notification: PanelNotification
): string {
  const firstName = getFirstName(notification.panelist_name)
  const { time, day } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  return `Hi ${firstName}! Reminder: You're speaking on the "${notification.title}" panel tomorrow at ${formattedTime} in ${notification.room}. Please arrive 10 minutes early. Looking forward to hearing your share! - DJ, ICYPAA Program Chair`
}

// Generate 1-hour before panel reminder email template
export function generateOneHourReminderEmailTemplate(
  notification: PanelNotification
): string {
  const firstName = getFirstName(notification.panelist_name)
  const { time } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  return `Hi ${firstName},

Your panel starts in 1 hour!

"${notification.title}"
Time: ${formattedTime}
Room: ${notification.room}

Please head to ${notification.room} soon and introduce yourself to the Host member chairing the meeting.

Thank you for your service!

Danielle J.
The 65th ICYPAA Program Chair`
}

// Generate 1-hour before panel reminder SMS template
export function generateOneHourReminderSMSTemplate(
  notification: PanelNotification
): string {
  const firstName = getFirstName(notification.panelist_name)
  const { time } = parseTimeAndDay(notification.time_day)
  const formattedTime = formatPanelTime(time)

  return `${firstName}, your panel "${notification.title}" starts in 1 hour at ${formattedTime} in ${notification.room}. Please arrive 10 minutes early. Thank you! - DJ, ICYPAA`
}

// Generate confirmation notification email to program@ and chair@
export function generateConfirmationNotificationEmail(
  notification: PanelNotification,
  isConfirmed: boolean
): {
  subject: string
  body: string
} {
  const { time, day } = parseTimeAndDay(notification.time_day)
  const status = isConfirmed ? "CONFIRMED" : "WITHDRAWN"

  return {
    subject: `Panel ${status}: ${notification.panelist_name} - ${notification.title}`,
    body: `Panel participation ${status.toLowerCase()}.

Panelist: ${notification.panelist_name}
Panel: ${notification.title}
Topic: ${notification.topic || "N/A"}
Date/Time: ${day} ${time}
Room: ${notification.room}
Contact: ${notification.panelist_contact}

Status: ${status}
Timestamp: ${new Date().toLocaleString()}

${!isConfirmed ? "Please arrange for a replacement panelist if needed." : ""}

- ICYPAA Panel Management System`
  }
}
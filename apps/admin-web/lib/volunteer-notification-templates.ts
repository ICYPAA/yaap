// Helper function to get first name from full name
function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName
}

// Helper function to format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00") // Add noon time to avoid timezone issues
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago" // CST/CDT
  }
  return date.toLocaleDateString("en-US", options)
}

// Helper function to format time
function formatTime(timeStr: string): string {
  // Time is already in CST from database
  const [hours, minutes] = timeStr.split(":").map(Number)
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
}

// Helper function to format time range
function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`
}

// Helper function to format location
function formatLocation(location: string[] | undefined): string {
  if (!location || location.length === 0) {
    return "TBD"
  }
  return location.join(", ")
}

export interface VolunteerShiftDetails {
  volunteerId: string
  volunteerName: string
  volunteerContact: string
  shiftDate: string
  startTime: string
  endTime: string
  jobType: string
  location?: string[]
}

// Generate 12-hour before shift reminder email template
export function generateVolunteerReminderEmailTemplate(
  details: VolunteerShiftDetails
): string {
  const firstName = getFirstName(details.volunteerName)
  const formattedDate = formatDate(details.shiftDate)
  const formattedTime = formatTimeRange(details.startTime, details.endTime)
  const formattedLocation = formatLocation(details.location)

  return `Hi ${firstName},

The 65th ICYPAA is sending you a reminder that you are volunteering!

Shift Details:
Date: ${formattedDate}
Time: ${formattedTime}
Position: ${details.jobType}
Location: ${formattedLocation}

Please arrive a few minutes early.

If you have any questions, please reach out to Cornell at (612) 807-4821.

Thank you for your service!

In love and service,
The 65th ICYPAA Host Committee`
}

// Generate 12-hour before shift reminder SMS template
export function generateVolunteerReminderSMSTemplate(
  details: VolunteerShiftDetails
): string {
  const firstName = getFirstName(details.volunteerName)
  const formattedDate = formatDate(details.shiftDate)
  const formattedTime = formatTimeRange(details.startTime, details.endTime)
  const formattedLocation = formatLocation(details.location)

  return `The 65th ICYPAA is sending you a reminder that you are volunteering ${formattedDate} at ${formattedTime} in ${formattedLocation}! If you have any questions reach out to Cornell (612) 807-4821`
}

// Generate urgent volunteer reminder (1 hour before)
export function generateUrgentVolunteerReminderSMSTemplate(
  details: VolunteerShiftDetails
): string {
  const firstName = getFirstName(details.volunteerName)
  const formattedTime = formatTime(details.startTime)
  const formattedLocation = formatLocation(details.location)

  return `${firstName}, your volunteer shift starts in 1 hour at ${formattedTime} in ${formattedLocation}. Please arrive a few minutes early. Thank you! - 65th ICYPAA`
}

// Generate volunteer shift confirmation email
export function generateVolunteerConfirmationEmailTemplate(
  details: VolunteerShiftDetails
): string {
  const firstName = getFirstName(details.volunteerName)
  const formattedDate = formatDate(details.shiftDate)
  const formattedTime = formatTimeRange(details.startTime, details.endTime)
  const formattedLocation = formatLocation(details.location)

  return `Hi ${firstName},

Thank you for signing up to volunteer at the 65th ICYPAA!

You have been scheduled for:
Date: ${formattedDate}
Time: ${formattedTime}
Position: ${details.jobType}
Location: ${formattedLocation}

We'll send you a reminder 12 hours before your shift.

If you need to make any changes or have questions, please contact Cornell at (612) 807-4821.

Looking forward to seeing you there!

In love and service,
The 65th ICYPAA Host Committee`
}

// Generate volunteer shift change notification
export function generateVolunteerShiftChangeEmailTemplate(
  oldDetails: VolunteerShiftDetails,
  newDetails: VolunteerShiftDetails
): string {
  const firstName = getFirstName(newDetails.volunteerName)
  const oldFormattedDate = formatDate(oldDetails.shiftDate)
  const oldFormattedTime = formatTimeRange(
    oldDetails.startTime,
    oldDetails.endTime
  )
  const newFormattedDate = formatDate(newDetails.shiftDate)
  const newFormattedTime = formatTimeRange(
    newDetails.startTime,
    newDetails.endTime
  )
  const newFormattedLocation = formatLocation(newDetails.location)

  return `Hi ${firstName},

Your volunteer shift has been updated.

Previous shift:
${oldFormattedDate} at ${oldFormattedTime}

New shift:
Date: ${newFormattedDate}
Time: ${newFormattedTime}
Position: ${newDetails.jobType}
Location: ${newFormattedLocation}

If you have any questions about this change, please contact Cornell at (612) 807-4821.

Thank you for your flexibility!

In love and service,
The 65th ICYPAA Host Committee`
}

// Helper function to convert 24-hour time to 12-hour time with AM/PM
export function formatTime(time24: string): string {
  if (!time24) return ""

  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? "PM" : "AM"
  const hours12 = hours % 12 || 12 // Convert 0 to 12 for 12 AM

  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`
}

// Get capitalized version of the day
export function capitalizeDay(day: string): string {
  if (!day || day === "not_required") return ""
  return day.charAt(0).toUpperCase() + day.slice(1)
}

// Process the message by replacing placeholders
export function processMessage(
  message: string,
  params: {
    day?: string
    time?: string
    where?: string
    reports_due?: string
  }
): string {
  let processedMessage = message

  if (params.day) {
    processedMessage = processedMessage.replace(/\$\{day\}/g, params.day)
  }

  if (params.where) {
    processedMessage = processedMessage.replace(/\$\{where\}/g, params.where)
  }

  if (params.time) {
    const formattedTime = formatTime(params.time)
    processedMessage = processedMessage.replace(/\$\{time\}/g, formattedTime)
  }

  if (params.reports_due && params.reports_due !== "not_required") {
    const capitalizedDay = capitalizeDay(params.reports_due)
    processedMessage = processedMessage.replace(/\$\{due\}/g, capitalizedDay)
  }

  return processedMessage
}

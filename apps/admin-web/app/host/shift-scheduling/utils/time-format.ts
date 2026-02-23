/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 */
export function formatTime12Hour(time24: string): string {
  const [hoursStr, minutes] = time24.split(':')
  const hours = parseInt(hoursStr)
  
  if (hours === 0) {
    return `12:${minutes} AM`
  } else if (hours < 12) {
    return `${hours}:${minutes} AM`
  } else if (hours === 12) {
    return `12:${minutes} PM`
  } else {
    return `${hours - 12}:${minutes} PM`
  }
}

/**
 * Get just the hour in 12-hour format
 */
export function formatHour12(hour: number): string {
  if (hour === 0) {
    return '12 AM'
  } else if (hour < 12) {
    return `${hour} AM`
  } else if (hour === 12) {
    return '12 PM'
  } else {
    return `${hour - 12} PM`
  }
}
import { createClient } from "@/utils/supabase/server"
import { addDays, addMonths } from "date-fns"
import { NextRequest } from "next/server"
import twilio from "twilio"

interface Person {
  name: string
  phone: string
}

interface OutreachReminder {
  id: number
  name: string
  details: string
  frequency: string
  reminder_buffer: string
  people: Person[]
  created_at: string
  updated_at: string
}

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "")

  // Handle different formats
  if (digits.length === 10) {
    // US number without country code: 1234567890 -> +11234567890
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code: 11234567890 -> +11234567890
    return `+${digits}`
  } else {
    // Return as-is if it doesn't match expected patterns
    return `+${digits}`
  }
}

function parseReminderBuffer(buffer: string): number {
  // Parse buffer like "1h", "2d", "30m" into minutes
  const match = buffer.match(/^(\d+)([hdm])$/)
  if (!match) return 0

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case "h":
      return value * 60 // hours to minutes
    case "d":
      return value * 24 * 60 // days to minutes
    case "m":
      return value // minutes
    default:
      return 0
  }
}

function parseFrequency(frequency: string): Date | null {
  // console.log("frequency", frequency)

  // First, try to parse as a specific date/time
  const specificDate = new Date(frequency)
  if (!isNaN(specificDate.getTime())) {
    return specificDate
  }

  // Handle recurring patterns
  const now = new Date()
  const frequencyLower = frequency.toLowerCase()

  // Determine if we're in DST (roughly March to November)
  const month = now.getUTCMonth() + 1 // getUTCMonth() is 0-based
  const isDST = month >= 3 && month <= 11 // Rough DST period

  // Central Time: CST is UTC-6, CDT is UTC-5
  const CENTRAL_OFFSET_MS = isDST ? 5 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000
  const nowCentral = new Date(now.getTime() - CENTRAL_OFFSET_MS)

  // console.log("Current UTC time:", now.toISOString())
  // console.log("Current Central time:", nowCentral.toISOString())
  // console.log("Is DST:", isDST, "Offset hours:", isDST ? 5 : 6)

  // Handle S-S pattern (Saturday-Sunday)
  if (frequencyLower.includes("s-s") || frequencyLower.includes("sat-sun")) {
    // Find the next Saturday or Sunday (whichever comes first)
    const currentCentralDay = nowCentral.getUTCDay()

    // Calculate days until Saturday (6) and Sunday (0)
    const daysUntilSaturday = (6 - currentCentralDay + 7) % 7
    const daysUntilSunday = (0 - currentCentralDay + 7) % 7

    // Choose the next occurrence (Saturday or Sunday)
    const nextWeekendDay = daysUntilSaturday <= daysUntilSunday ? 6 : 0
    let daysUntilTarget =
      nextWeekendDay === 6 ? daysUntilSaturday : daysUntilSunday

    // If it's 0 days (today), check if time has passed
    if (daysUntilTarget === 0) {
      let eventHour = 9 // default
      let eventMinute = 0 // default

      const timeMatch = frequency.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
      if (timeMatch) {
        eventHour = parseInt(timeMatch[1])
        eventMinute = parseInt(timeMatch[2] || "0")
        const ampm = timeMatch[3]?.toLowerCase()

        if (ampm === "pm" && eventHour !== 12) eventHour += 12
        if (ampm === "am" && eventHour === 12) eventHour = 0
      }

      const currentCentralHour = nowCentral.getUTCHours()
      const currentCentralMinute = nowCentral.getUTCMinutes()
      const currentTimeInMinutes =
        currentCentralHour * 60 + currentCentralMinute
      const eventTimeInMinutes = eventHour * 60 + eventMinute

      if (currentTimeInMinutes >= eventTimeInMinutes) {
        // Time has passed today, find next weekend day
        daysUntilTarget = nextWeekendDay === 6 ? 7 : 7 - daysUntilSunday
      }
    }

    // Continue with normal day processing logic
    let eventHour = 9 // default
    let eventMinute = 0 // default

    const timeMatch = frequency.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
    if (timeMatch) {
      eventHour = parseInt(timeMatch[1])
      eventMinute = parseInt(timeMatch[2] || "0")
      const ampm = timeMatch[3]?.toLowerCase()

      if (ampm === "pm" && eventHour !== 12) eventHour += 12
      if (ampm === "am" && eventHour === 12) eventHour = 0
    }

    let eventDateCentral = new Date(nowCentral)
    eventDateCentral = addDays(eventDateCentral, daysUntilTarget)
    eventDateCentral.setUTCHours(eventHour)
    eventDateCentral.setUTCMinutes(eventMinute)
    eventDateCentral.setUTCSeconds(0)
    eventDateCentral.setUTCMilliseconds(0)

    const eventDateUTC = new Date(
      eventDateCentral.getTime() + CENTRAL_OFFSET_MS
    )
    return eventDateUTC
  }

  // Handle specific date formats like "5/31 at 6:30 PM" or "6/5 at 8:30 PM"
  const dateMatch = frequency.match(
    /(\d{1,2})\/(\d{1,2})\s*at\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i
  )
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1 // JavaScript months are 0-based
    const day = parseInt(dateMatch[2])
    let eventHour = parseInt(dateMatch[3])
    const eventMinute = parseInt(dateMatch[4] || "0")
    const ampm = dateMatch[5]?.toLowerCase()

    // Convert to 24-hour format
    if (ampm === "pm" && eventHour !== 12) eventHour += 12
    if (ampm === "am" && eventHour === 12) eventHour = 0

    // Use current year, but if the date has already passed this year, use next year
    const year = nowCentral.getUTCFullYear()
    const eventDateCentral = new Date()
    eventDateCentral.setUTCFullYear(year)
    eventDateCentral.setUTCMonth(month)
    eventDateCentral.setUTCDate(day)
    eventDateCentral.setUTCHours(eventHour)
    eventDateCentral.setUTCMinutes(eventMinute)
    eventDateCentral.setUTCSeconds(0)
    eventDateCentral.setUTCMilliseconds(0)

    // If the date has already passed this year, use next year
    if (eventDateCentral.getTime() < nowCentral.getTime()) {
      eventDateCentral.setUTCFullYear(year + 1)
    }

    // Convert Central time to UTC
    const eventDateUTC = new Date(
      eventDateCentral.getTime() + CENTRAL_OFFSET_MS
    )
    return eventDateUTC
  }

  // Map day names to their numeric values (0 = Sunday, 1 = Monday, etc.)
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }

  // Find which day is mentioned in the frequency string
  let targetDay: number | null = null
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (frequencyLower.includes(dayName)) {
      targetDay = dayNum
      break
    }
  }

  if (targetDay !== null) {
    // Extract and parse time from frequency string
    let eventHour = 9 // default
    let eventMinute = 0 // default

    // Better regex to match time patterns like "11:10pm", "11:10 pm", "11pm"
    const timeMatch = frequency.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
    if (timeMatch) {
      eventHour = parseInt(timeMatch[1])
      eventMinute = parseInt(timeMatch[2] || "0")
      const ampm = timeMatch[3]?.toLowerCase()

      // Convert to 24-hour format
      if (ampm === "pm" && eventHour !== 12) {
        eventHour += 12
      } else if (ampm === "am" && eventHour === 12) {
        eventHour = 0
      }
    }

    // console.log("Parsed time:", `${eventHour}:${eventMinute}`)

    // Work with Central time to find the next occurrence
    const currentCentralDay = nowCentral.getUTCDay()
    let eventDateCentral = new Date(nowCentral)

    // console.log(
    //   "Current Central day:",
    //   currentCentralDay,
    //   "(0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)"
    // )
    // console.log("Target day:", targetDay)

    // Calculate days until target day
    let daysUntilTarget = (targetDay - currentCentralDay + 7) % 7
    // console.log("Days until target (before same-day check):", daysUntilTarget)

    // If it's the same day, check if the time has passed
    if (daysUntilTarget === 0) {
      const currentCentralHour = nowCentral.getUTCHours()
      const currentCentralMinute = nowCentral.getUTCMinutes()
      const currentTimeInMinutes =
        currentCentralHour * 60 + currentCentralMinute
      const eventTimeInMinutes = eventHour * 60 + eventMinute

      // console.log(
      //   "Same day check - current Central time:",
      //   `${currentCentralHour}:${currentCentralMinute}`
      // )
      // console.log(
      //   "Event time in minutes:",
      //   eventTimeInMinutes,
      //   "Current time in minutes:",
      //   currentTimeInMinutes
      //)

      if (currentTimeInMinutes >= eventTimeInMinutes) {
        // Time has passed today, schedule for next week
        daysUntilTarget = 7
        // console.log("Time has passed, scheduling for next week")
      }
    }

    // Set the event date in Central time
    eventDateCentral = addDays(eventDateCentral, daysUntilTarget)
    eventDateCentral.setUTCHours(eventHour)
    eventDateCentral.setUTCMinutes(eventMinute)
    eventDateCentral.setUTCSeconds(0)
    eventDateCentral.setUTCMilliseconds(0)

    // Convert Central time to UTC by adding the offset
    const eventDateUTC = new Date(
      eventDateCentral.getTime() + CENTRAL_OFFSET_MS
    )

    // console.log("Central event time:", eventDateCentral.toISOString())
    // console.log("UTC event time:", eventDateUTC.toISOString())

    return eventDateUTC
  }

  // Handle daily patterns
  if (frequencyLower.includes("daily")) {
    const eventDateCentral = addDays(nowCentral, 1)

    // Extract time or default to 9 AM
    let eventHour = 9
    let eventMinute = 0

    const timeMatch = frequency.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
    if (timeMatch) {
      eventHour = parseInt(timeMatch[1])
      eventMinute = parseInt(timeMatch[2] || "0")
      const ampm = timeMatch[3]?.toLowerCase()

      if (ampm === "pm" && eventHour !== 12) eventHour += 12
      if (ampm === "am" && eventHour === 12) eventHour = 0
    }

    eventDateCentral.setUTCHours(eventHour)
    eventDateCentral.setUTCMinutes(eventMinute)
    eventDateCentral.setUTCSeconds(0)
    eventDateCentral.setUTCMilliseconds(0)

    // Convert Central time to UTC
    const eventDateUTC = new Date(
      eventDateCentral.getTime() + CENTRAL_OFFSET_MS
    )
    return eventDateUTC
  }

  // Handle monthly patterns
  if (
    frequencyLower.includes("monthly") ||
    frequencyLower.includes("first") ||
    frequencyLower.includes("last")
  ) {
    const eventDateCentral = addMonths(nowCentral, 1)
    eventDateCentral.setUTCDate(1) // First day of next month
    eventDateCentral.setUTCHours(9)
    eventDateCentral.setUTCMinutes(0)
    eventDateCentral.setUTCSeconds(0)
    eventDateCentral.setUTCMilliseconds(0)

    // Convert Central time to UTC
    const eventDateUTC = new Date(
      eventDateCentral.getTime() + CENTRAL_OFFSET_MS
    )
    return eventDateUTC
  }

  console.log(`Unable to parse frequency: ${frequency}`)
  return null
}

function shouldSendReminder(
  frequency: string,
  reminderBuffer: string
): boolean {
  const eventTime = parseFrequency(frequency)
  // console.log("eventTime (UTC):", eventTime?.toISOString())
  if (!eventTime) return false

  const bufferMinutes = parseReminderBuffer(reminderBuffer)
  // console.log("bufferMinutes:", bufferMinutes)
  const reminderTime = new Date(eventTime.getTime() - bufferMinutes * 60 * 1000)
  // console.log("reminderTime (UTC):", reminderTime.toISOString())

  // Use UTC for consistent timezone comparison
  const now = new Date()
  // console.log("now (UTC):", now.toISOString())

  // Convert times to Central time for debugging
  // const nowCentral = new Date(now.getTime() - CENTRAL_OFFSET_MS_DEBUG)
  // const eventTimeCentral = new Date(
  //   eventTime.getTime() - CENTRAL_OFFSET_MS_DEBUG
  // )
  // const reminderTimeCentral = new Date(
  //   reminderTime.getTime() - CENTRAL_OFFSET_MS_DEBUG
  // )

  // console.log("now (Central):", nowCentral.toISOString())
  // console.log("eventTime (Central):", eventTimeCentral.toISOString())
  // console.log("reminderTime (Central):", reminderTimeCentral.toISOString())

  const timeDiff = Math.abs(now.getTime() - reminderTime.getTime())
  // console.log("timeDiff (ms):", timeDiff)
  // console.log("timeDiff (minutes):", timeDiff / (60 * 1000))

  // Send reminder if we're within 5 minutes of the reminder time
  const shouldSend = timeDiff <= 5 * 60 * 1000
  // console.log("should send reminder:", shouldSend)
  return shouldSend
}

async function sendSMS(to: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration")
    console.log("accountSid", accountSid)
    console.log("authToken", authToken)
    console.log("fromNumber", fromNumber)
    return false
  }

  const normalizedPhone = normalizePhoneNumber(to)

  try {
    const client = twilio(accountSid, authToken)

    await client.messages.create({
      from: fromNumber,
      to: normalizedPhone,
      body: message
    })

    console.log(`SMS sent successfully to ${normalizedPhone}`)
    return true
  } catch (error) {
    console.error(`Error sending SMS to ${normalizedPhone}:`, error)
    return false
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Fetch all outreach reminders
    const { data: reminders, error } = await supabase
      .from("outreach_reminders")
      .select("*")

    if (error) {
      console.error("Error fetching reminders:", error)
      return new Response("Error fetching reminders", { status: 500 })
    }

    let sentCount = 0
    let errorCount = 0

    for (const reminder of reminders as OutreachReminder[]) {
      if (shouldSendReminder(reminder.frequency, reminder.reminder_buffer)) {
        console.log("Sending reminder for", reminder.name)

        // Construct message based on reminder buffer
        let message = ""
        const buffer = reminder.reminder_buffer.toLowerCase()

        if (buffer === "1d") {
          // Extract time from frequency for "tomorrow" message
          let timeStr = ""
          const timeMatch = reminder.frequency.match(
            /(\d{1,2}):?(\d{2})?\s*(am|pm)/i
          )
          if (timeMatch) {
            const hour = timeMatch[1]
            const minute = timeMatch[2] || "00"
            const ampm = timeMatch[3]?.toLowerCase()
            timeStr = `${hour}:${minute} ${ampm.toUpperCase()}`
          } else {
            timeStr = "IDK" // default time
          }

          message = `ICYPAA Reminder: ${reminder.name} is tomorrow at ${timeStr}!${reminder.details ? ` - ${reminder.details}` : ""}`
        } else if (buffer === "1h") {
          message = `ICYPAA Reminder: ${reminder.name} is in 1 hour!${reminder.details ? ` - ${reminder.details}` : ""}`
        } else {
          message = `ICYPAA Reminder: ${reminder.name}${reminder.details ? ` - ${reminder.details}` : ""}`
        }

        for (const person of reminder.people) {
          const success = await sendSMS(person.phone, message)
          if (success) {
            sentCount++
          } else {
            errorCount++
          }
        }

        console.log(`Processed reminder: ${reminder.name}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${reminders.length} reminders. Sent ${sentCount} messages with ${errorCount} errors.`,
        sentCount,
        errorCount
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error("Error in outreach reminders cron:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

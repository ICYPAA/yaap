import { processMessage } from "@/app/host/reminders/components/reminder-utils"
import { createClient } from "@/utils/supabase/server"
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSunday,
  isToday,
  startOfMonth,
  subDays
} from "date-fns"
import type { NextRequest } from "next/server"

// Specific meeting dates for the next 5 meetings
const SPECIFIC_MEETINGS = [
  {
    date: new Date(2024, 6, 27), // July 27, 2024 (month is 0-indexed)
    time: "14:00", // 2pm in 24-hour format
    location: "Hilton Minneapolis"
  },
  {
    date: new Date(2024, 7, 3), // August 3, 2024
    time: "14:00",
    location: "Hilton Minneapolis"
  },
  {
    date: new Date(2024, 7, 10), // August 10, 2024
    time: "14:00",
    location: "Sahara Club"
  },
  {
    date: new Date(2024, 7, 17), // August 17, 2024
    time: "14:00",
    location: "Hilton Minneapolis"
  },
  {
    date: new Date(2024, 7, 24), // August 24, 2024
    time: "14:00",
    location: "Sahara Club"
  }
]

function getTodaysSpecificMeeting() {
  const today = new Date()

  // Check if today is the Friday before any of the specific meeting dates
  for (const meeting of SPECIFIC_MEETINGS) {
    const fridayBefore = subDays(meeting.date, 2) // 2 days before Sunday
    if (isToday(fridayBefore)) {
      return meeting
    }
  }

  return null
}

function isTodayFridayBeforeFourthSunday() {
  // Get today's date
  const today = new Date()

  // Get the current year and month
  const year = today.getFullYear()
  const month = today.getMonth() // 0-indexed (0 = January, 11 = December)

  // Get all Sundays of the month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })

  // Find all Sundays
  const sundays = daysInMonth.filter((day) => isSunday(day))

  if (sundays.length < 4) {
    return false
  }

  // Get the 4th Sunday
  const fourthSunday = sundays[3]

  // Subtract 2 days to get the Friday before the 4th Sunday
  const fridayBeforeFourthSunday = subDays(fourthSunday, 2)

  // Check if today is the Friday before the 4th Sunday
  return isToday(fridayBeforeFourthSunday)
}

function getFourthSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })

  const sundays = daysInMonth.filter((day) => isSunday(day))
  return sundays[3] // fourth Sunday
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401
    })
  }

  // First check if today is the Friday before one of the specific meetings
  const specificMeeting = getTodaysSpecificMeeting()

  if (!specificMeeting) {
    return new Response("Not the Friday before a scheduled meeting", {
      status: 200
    })
  }

  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  const DISCORD_MAIN_CHANNEL_ID = process.env.DISCORD_MAIN_CHANNEL_ID

  if (!DISCORD_BOT_TOKEN || !DISCORD_MAIN_CHANNEL_ID) {
    return new Response("Missing Discord bot token or channel ID", {
      status: 500
    })
  }

  try {
    // Get reminder content
    const supabase = await createClient()
    const { data: reminder } = await supabase
      .from("reminders")
      .select("*")
      .eq("type", "MAIN_MEETING")
      .single()

    const dateString = format(specificMeeting.date, "EEEE, MMM do")
    const meetingTime = specificMeeting.time
    const meetingLocation = specificMeeting.location

    // Generate content string
    let processedMessage = reminder?.message || ""

    if (reminder) {
      processedMessage = processMessage(reminder.message, {
        day: dateString,
        time: meetingTime,
        where: meetingLocation,
        reports_due: reminder.reports_due
      })
    }

    const content = reminder
      ? `@everyone ${processedMessage}`
      : '@everyone Reminder to please submit your committee reports!\nAny position that is a "chair" must submit a report.\n\nEmail your reports to:\n\nchair@icyhost.org\naltchair@icyhost.org\nsecretary@icyhost.org'

    const message = {
      content,
      allowed_mentions: {
        parse: ["everyone"]
      }
    }

    const response = await fetch(
      `https://discord.com/api/channels/${DISCORD_MAIN_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error sending message to Discord:", error)
      return new Response("Failed to send message to Discord", {
        status: response.status,
        statusText: response.statusText
      })
    }

    return Response.json({ success: true, message: "Message sent to Discord!" })
  } catch (error) {
    console.error("Unexpected error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}

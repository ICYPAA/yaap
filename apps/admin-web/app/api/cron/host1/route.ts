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

function isTodayFridayBeforeFirstSunday() {
  // Get today's date
  const today = new Date()

  // Get the current year and month
  const year = today.getFullYear()
  const month = today.getMonth()

  // Get all days of the current month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })

  // Find the first Sunday of the current month
  const firstSunday = daysInMonth.find((day) => isSunday(day))

  if (!firstSunday) {
    return false
  }

  // Subtract 2 days to get the Friday before the first Sunday
  let fridayBeforeFirstSunday = subDays(firstSunday, 2)

  // If today is after the first Sunday of the current month,
  // check if the first Sunday of the next month has a Friday in the current month.
  if (today > firstSunday) {
    const nextMonthFirstSunday = new Date(year, month + 1, 1)
    const daysInNextMonth = eachDayOfInterval({
      start: startOfMonth(nextMonthFirstSunday),
      end: endOfMonth(nextMonthFirstSunday)
    })

    const nextMonthFirstSundayDate = daysInNextMonth.find((day) =>
      isSunday(day)
    )

    if (nextMonthFirstSundayDate) {
      fridayBeforeFirstSunday = subDays(nextMonthFirstSundayDate, 2)
    }
  }

  return isToday(fridayBeforeFirstSunday)
}

function getFirstSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // If we're near the end of the month, get next month's first Sunday
  if (today.getDate() > 20) {
    const nextMonth = new Date(year, month + 1, 1)
    const daysInNextMonth = eachDayOfInterval({
      start: startOfMonth(nextMonth),
      end: endOfMonth(nextMonth)
    })
    return daysInNextMonth.find((day) => isSunday(day))!
  }

  // Otherwise get this month's first Sunday
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })
  return daysInMonth.find((day) => isSunday(day))!
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401
    })
  }

  if (!isTodayFridayBeforeFirstSunday()) {
    return new Response("Not the Friday before the first Sunday", {
      status: 200
    })
  }

  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  const DISCORD_HOST_1_CHANNEL_ID = process.env.DISCORD_HOST_1_CHANNEL_ID
  const DISCORD_HOST_1_ROLE_ID = process.env.DISCORD_HOST_1_ROLE_ID

  if (
    !DISCORD_BOT_TOKEN ||
    !DISCORD_HOST_1_CHANNEL_ID ||
    !DISCORD_HOST_1_ROLE_ID
  ) {
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
      .eq("type", "HOST_TEAM_1")
      .single()

    const firstSunday = getFirstSunday()
    const dateString = format(firstSunday, "EEEE, MMM do")

    // Generate content string
    let processedMessage = reminder?.message || ""

    if (reminder) {
      processedMessage = processMessage(reminder.message, {
        day: dateString,
        time: reminder.time,
        where: reminder.place,
        reports_due: reminder.reports_due
      })
    }

    const content = reminder
      ? `<@&${DISCORD_HOST_1_ROLE_ID}>\n\n${processedMessage}`
      : `No reminder found for HOST_TEAM_1`

    const message = {
      content,
      allowed_mentions: {
        parse: [], // Ensures only mentioned users/roles are pinged
        roles: [DISCORD_HOST_1_ROLE_ID]
      }
    }

    const response = await fetch(
      `https://discord.com/api/channels/${DISCORD_HOST_1_CHANNEL_ID}/messages`,
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

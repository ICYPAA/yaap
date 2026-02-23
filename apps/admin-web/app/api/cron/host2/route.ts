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

function isTodayFridayBeforeSecondSunday() {
  // Get today's date
  const today = new Date()

  // Get the current year and month
  const year = today.getFullYear()
  const month = today.getMonth()

  // Get all Sundays of the month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })

  // Find all Sundays
  const sundays = daysInMonth.filter((day) => isSunday(day))

  if (sundays.length < 2) {
    return false
  }

  // Get the 2nd Sunday
  const secondSunday = sundays[1]

  // Subtract 2 days to get the Friday before the 2nd Sunday
  const fridayBeforeSecondSunday = subDays(secondSunday, 2)

  // Check if today is the Friday before the 2nd Sunday
  return isToday(fridayBeforeSecondSunday)
}

function getSecondSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1))
  })

  const sundays = daysInMonth.filter((day) => isSunday(day))
  return sundays[1] // second Sunday
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401
    })
  }

  if (!isTodayFridayBeforeSecondSunday()) {
    return new Response("Not the Friday before the second Sunday", {
      status: 200
    })
  }

  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  const DISCORD_HOST_2_CHANNEL_ID = process.env.DISCORD_HOST_2_CHANNEL_ID
  const DISCORD_HOST_2_ROLE_ID = process.env.DISCORD_HOST_2_ROLE_ID

  if (
    !DISCORD_BOT_TOKEN ||
    !DISCORD_HOST_2_CHANNEL_ID ||
    !DISCORD_HOST_2_ROLE_ID
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
      .eq("type", "HOST_TEAM_2")
      .single()

    const secondSunday = getSecondSunday()
    const dateString = format(secondSunday, "EEEE, MMM do")

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
      ? `<@&${DISCORD_HOST_2_ROLE_ID}>\n\n${processedMessage}`
      : `No reminder found for HOST_TEAM_2`

    const message = {
      content,
      allowed_mentions: {
        parse: [], // Ensures only mentioned users/roles are pinged
        roles: [DISCORD_HOST_2_ROLE_ID]
      }
    }

    const response = await fetch(
      `https://discord.com/api/channels/${DISCORD_HOST_2_CHANNEL_ID}/messages`,
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

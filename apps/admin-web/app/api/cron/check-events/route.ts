import { createClient } from "@/utils/supabase/server"
import { getConferenceState } from "@/lib/conference-state"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic" // Ensure the route is always dynamic

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"

// Define interfaces matching your table structure
interface Event {
  id: string
  title: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM:SS (Assumed CST/CDT)
  event_category_id: number
  event_categories?: { title?: string } | { title?: string }[] | null
  // Add other event properties if needed
}

interface User {
  id: string
  expo_push_token: string | null
  settings: any | null // Kept as any per your modification
  schedule: any | null // Kept as any per your modification
}

// Helper function to get Date object adjusted for a specific UTC offset
function getDateInTimezone(offsetHours: number): Date {
  const now = new Date()
  const adjustedTime = now.getTime() + offsetHours * 60 * 60 * 1000
  return new Date(adjustedTime)
}

// Helper function to format a Date object to HH:MM:SS (based on its internal UTC values)
function formatTimeToHHMMSS(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, "0")
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")
  const seconds = date.getUTCSeconds().toString().padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

// Helper function to format a Date object to YYYY-MM-DD (based on its internal UTC values)
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear()
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0") // Month is 0-indexed
  const day = date.getUTCDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const conferenceState = await getConferenceState()
    const currentProgramId = conferenceState.current_program_id

    if (conferenceState.status !== "active" || !currentProgramId) {
      return NextResponse.json({
        message: "No active conference program configured."
      })
    }

    // --- Time Calculation ---
    const nowUTC = new Date() // Server time is likely UTC
    const cstOffsetHours = -5 // Assuming CDT (UTC-5). Adjust if standard time (UTC-6).

    // Calculate current time and target window in CST
    const nowCST = getDateInTimezone(cstOffsetHours)
    const fourMinutesFromNowCST = new Date(nowCST.getTime() + 4 * 60 * 1000)
    const fiveMinutesFromNowCST = new Date(nowCST.getTime() + 5 * 60 * 1000)

    // Get target date(s) in CST
    const targetDateCST = formatDateToYYYYMMDD(fourMinutesFromNowCST)
    const nextDateCST = formatDateToYYYYMMDD(
      new Date(nowCST.getTime() + 24 * 60 * 60 * 1000)
    ) // For events spanning midnight CST
    const relevantDatesCST = [targetDateCST]
    if (targetDateCST !== formatDateToYYYYMMDD(fiveMinutesFromNowCST)) {
      // If the 5-minute window crosses midnight in CST, include the next date
      relevantDatesCST.push(formatDateToYYYYMMDD(fiveMinutesFromNowCST))
    }
    // Ensure we cover potential midnight crossings where event date is tomorrow but time matches
    if (!relevantDatesCST.includes(nextDateCST)) {
      relevantDatesCST.push(nextDateCST)
    }

    // Get target time window in HH:MM:SS format (for DB query)
    const fourMinutesFromNowTime = formatTimeToHHMMSS(fourMinutesFromNowCST)
    const fiveMinutesFromNowTime = formatTimeToHHMMSS(fiveMinutesFromNowCST)

    console.log(`Cron job running at (UTC): ${nowUTC.toISOString()}`)
    console.log(
      `Current CST approx: ${nowCST.toISOString()} (using offset ${cstOffsetHours})`
    )
    console.log(
      `Checking for events on CST dates ${relevantDatesCST.join(" or ")} between CST times ${fourMinutesFromNowTime} and ${fiveMinutesFromNowTime}`
    )

    // --- Database Query ---
    // Fetch potentially relevant events based on CST date and time window
    const { data: potentialEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, title, date, start_time, event_category_id, event_categories(title)")
      .eq("program_id", currentProgramId)
      .in("date", relevantDatesCST) // Use CST date(s)
      .gte("start_time", fourMinutesFromNowTime) // Compare with HH:MM:SS CST time
      .lt("start_time", fiveMinutesFromNowTime) // Compare with HH:MM:SS CST time

    if (eventsError) {
      console.error("Error fetching potential events:", eventsError)
      return NextResponse.json(
        { error: "Failed to fetch events", details: eventsError.message },
        { status: 500 }
      )
    }

    const reminderCandidateEvents = ((potentialEvents || []) as Event[]).filter((event) => {
      const category = Array.isArray(event.event_categories)
        ? event.event_categories[0]
        : event.event_categories
      const categoryTitle = category?.title?.toLowerCase() || ""
      return !categoryTitle.includes("bid")
    })

    if (reminderCandidateEvents.length === 0) {
      console.log(
        "No potentially upcoming events found in the initial query based on CST time window."
      )
      return NextResponse.json({ message: "No upcoming events found." })
    }

    console.log(
      `Found ${reminderCandidateEvents.length} potentially relevant events based on CST time.`
    )

    // --- Precise Filtering ---
    // Calculate the original UTC time window for precise comparison
    const fourMinutesFromNowUTC = new Date(nowUTC.getTime() + 4 * 60 * 1000)
    const fiveMinutesFromNowUTC = new Date(nowUTC.getTime() + 5 * 60 * 1000)

    const cstOffsetString =
      cstOffsetHours <= 0
        ? `-${Math.abs(cstOffsetHours).toString().padStart(2, "0")}:00`
        : `+${cstOffsetHours.toString().padStart(2, "0")}:00`

    const events: Event[] = reminderCandidateEvents.filter((event) => {
      try {
        // Construct ISO-like string *assuming* start_time is local CST/CDT
        // Append the assumed CST/CDT offset to parse correctly relative to UTC
        const eventTimestampString = `${event.date}T${event.start_time}${cstOffsetString}`
        const eventStartTimestamp = new Date(eventTimestampString)

        // Check if the parsed timestamp (now absolute UTC) falls within the *original* UTC 4-5 minute window
        return (
          eventStartTimestamp >= fourMinutesFromNowUTC &&
          eventStartTimestamp < fiveMinutesFromNowUTC
        )
      } catch (parseError) {
        console.error(
          `Error parsing CST date/time for event ${event.id}: ${event.date} ${event.start_time}`,
          parseError
        )
        return false
      }
    })

    if (events.length === 0) {
      console.log(
        "No events starting exactly between 4 and 5 minutes from now after UTC comparison."
      )
      return NextResponse.json({ message: "No upcoming events found." })
    }

    console.log(
      `Found ${events.length} events starting exactly in the next 4-5 minutes (UTC).`
    )

    // --- Find Users (No Change) ---
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, expo_push_token, settings, schedule")
      .not("expo_push_token", "is", null)
      .eq("settings->>notifications", "true")
      .eq("settings->>event_notifications", "true")

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json(
        { error: "Failed to fetch users", details: usersError.message },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log("No users found with notifications enabled.")
      return NextResponse.json({ message: "No eligible users found." })
    }

    console.log(`Found ${users.length} potentially eligible users.`)

    // --- Prepare Notifications (No Change) ---
    const notifications = []
    let notificationCount = 0

    for (const event of events) {
      console.log(`Processing filtered event: ${event.title} (ID: ${event.id})`)
      const usersToNotify = users.filter((user: User) =>
        user.schedule?.saved_events?.includes(event.id)
      )

      console.log(`  Found ${usersToNotify.length} users who saved this event.`)

      for (const user of usersToNotify) {
        if (user.expo_push_token) {
          notifications.push({
            to: user.expo_push_token,
            sound: "default",
            title: `${event.title} starting soon!`,
            body: `${event.title} is starting in 5 minutes.`,
            data: { eventId: event.id }
          })
          notificationCount++
        }
      }
    }

    if (notifications.length === 0) {
      console.log("No notifications to send for the filtered events.")
      return NextResponse.json({ message: "No notifications generated." })
    }

    console.log(`Prepared ${notificationCount} notifications to send.`)

    // --- Send Notifications (No Change) ---
    const chunkSize = 100
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(chunk)
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(
            `Error sending notification chunk ${i / chunkSize + 1}:`,
            response.status,
            response.statusText,
            responseData
          )
        } else {
          console.log(
            `Successfully sent notification chunk ${i / chunkSize + 1}. Response:`,
            responseData
          )
        }
      } catch (fetchError) {
        console.error(
          `Fetch error sending notification chunk ${i / chunkSize + 1}:`,
          fetchError
        )
      }
    }

    return NextResponse.json({
          message: `Processed ${reminderCandidateEvents.length} potential events, found ${events.length} matching events, and sent ${notificationCount} notifications.`
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred"
    console.error("Cron job failed:", errorMessage)
    return NextResponse.json(
      { error: "Cron job failed", details: errorMessage },
      { status: 500 }
    )
  }
}

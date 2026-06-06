import { getConferenceState } from "@/lib/conference-state"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })
}

function formatTimeLabel(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":")
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

export async function GET() {
  try {
    // Use service role to bypass RLS
    const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)
    const conferenceState = await getConferenceState()
    const programId = conferenceState.current_program_id

    if (!programId) {
      return NextResponse.json({ counts: {} })
    }

    // Fetch all merch signups (only type and data fields, no sensitive info)
    const { data, error } = await supabase
      .from("volunteering_interest")
      .select("data")
      .eq("type", "merch")
      .eq("program_id", programId)

    if (error) {
      console.error("Error fetching merch signups:", error)
      return NextResponse.json(
        { error: "Failed to fetch merch counts" },
        { status: 500 }
      )
    }

    console.log(`Total merch signups: ${data.length}`)
    if (data.length > 0) {
      console.log("Sample record:", JSON.stringify(data[0], null, 2))
    }

    // Count signups for each day+time slot combination
    const counts: Record<string, number> = {}
    const debugInfo: any[] = []
    const { data: shifts } = await supabase
      .from("shifts")
      .select("date,start_time,end_time,shift_type")
      .eq("program_id", programId)
      .ilike("shift_type", "%merch%")

    const merchTimeSlots = new Map<string, string>()
    ;(shifts || []).forEach((shift: any) => {
      const day = formatDayLabel(shift.date)
      const start = formatTimeLabel(shift.start_time)
      const end = formatTimeLabel(shift.end_time)
      merchTimeSlots.set(`${day}|${start}`, `${day} - ${start} - ${end}`)
    })

    if (data) {
      data.forEach((record: any, index: number) => {
        if (record.data && record.data.day && record.data.time_slot) {
          const recordDay = record.data.day
          const recordTimeSlot = record.data.time_slot

          // Debug info
          if (index < 5) {
            debugInfo.push({ day: recordDay, time: recordTimeSlot })
          }

          // The time_slot in DB is just the start time (e.g., "8:00 AM", "10:00 AM", etc)
          // No need for mapping - just use the recorded time directly
          const normalizedTimeSlot = recordTimeSlot

          // Find the matching full slot for this day and time
          const fullSlot = merchTimeSlots.get(
            `${recordDay}|${normalizedTimeSlot}`
          )

          // If not matched, it might be in a different format
          if (fullSlot) {
            counts[fullSlot] = (counts[fullSlot] || 0) + 1
          } else {
            counts[`${recordDay} - ${recordTimeSlot}`] =
              (counts[`${recordDay} - ${recordTimeSlot}`] || 0) + 1
            console.log(`Unmatched record: day="${recordDay}", time="${recordTimeSlot}"`)
          }
        }
      })
    }

    console.log("Debug info (first 5 records):", debugInfo)
    console.log("Final counts:", counts)

    // Return counts (no sensitive data)
    return NextResponse.json({ counts })
  } catch (error) {
    console.error("Error in merch counts API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

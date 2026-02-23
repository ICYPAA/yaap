import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Use service role to bypass RLS
    const supabase = await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Fetch all merch signups (only type and data fields, no sensitive info)
    const { data, error } = await supabase
      .from("volunteering_interest")
      .select("data")
      .eq("type", "merch")

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

    if (data) {
      data.forEach((record: any, index: number) => {
        if (record.data && record.data.day && record.data.time_slot) {
          const recordDay = record.data.day
          const recordTimeSlot = record.data.time_slot

          // Debug info
          if (index < 5) {
            debugInfo.push({ day: recordDay, time: recordTimeSlot })
          }

          // Map time slots to full slot names - FROM ACTUAL timeSlotData.ts
          const merchTimeSlots: Record<string, string[]> = {
            "Aug 28": [
              "1:00 PM - 3:00 PM",
              "3:00 PM - 5:00 PM",
              "5:00 PM - 7:00 PM",
              "9:00 PM - 10:00 PM",
              "10:00 PM - 12:00 AM"
            ],
            "Aug 29": [
              "8:00 AM - 10:00 AM",
              "10:00 AM - 12:00 PM",
              "12:00 PM - 2:00 PM",
              "2:00 PM - 4:00 PM",
              "4:00 PM - 6:00 PM",
              "6:00 PM - 7:00 PM",
              "9:00 PM - 10:00 PM",
              "10:00 PM - 12:00 AM"
            ],
            "Aug 30": [
              "8:00 AM - 10:00 AM",
              "10:00 AM - 12:00 PM",
              "12:00 PM - 2:00 PM",
              "2:00 PM - 4:00 PM",
              "4:00 PM - 6:00 PM",
              "6:00 PM - 7:00 PM",
              "9:00 PM - 10:00 PM",
              "10:00 PM - 12:00 AM"
            ],
            "Aug 31": [
              "8:00 AM - 10:00 AM",
              "10:00 AM - 12:00 PM"
            ]
          }

          // The time_slot in DB is just the start time (e.g., "8:00 AM", "10:00 AM", etc)
          // No need for mapping - just use the recorded time directly
          const normalizedTimeSlot = recordTimeSlot

          // Find the matching full slot for this day and time
          let matched = false
          Object.entries(merchTimeSlots).forEach(([day, slots]) => {
            if (day === recordDay) {
              slots.forEach((slot) => {
                const startTime = slot.split(" - ")[0] // Extract "1:00 PM" from "1:00 PM - 3:00 PM"
                if (normalizedTimeSlot === startTime) {
                  const fullSlot = `${day} - ${slot}` // e.g., "Aug 28 - 1:00 PM - 3:00 PM"
                  counts[fullSlot] = (counts[fullSlot] || 0) + 1
                  matched = true
                }
              })
            }
          })

          // If not matched, it might be in a different format
          if (!matched) {
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

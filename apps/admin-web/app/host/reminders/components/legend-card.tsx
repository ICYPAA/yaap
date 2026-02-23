"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { format } from "date-fns"
import { InfoIcon, Loader2 } from "lucide-react"
import { useState } from "react"
import { processMessage } from "./reminder-utils"

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

// Get the next specific meeting date
function getNextSpecificMeeting() {
  const today = new Date()
  const upcomingMeetings = SPECIFIC_MEETINGS.filter(
    (meeting) => meeting.date >= today
  )
  return upcomingMeetings.length > 0 ? upcomingMeetings[0] : null
}

// Helper functions to get the current dates for testing
function getFourthSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // Get all days of the month
  const daysInMonth = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, i) => new Date(year, month, i + 1)
  )

  // Find all Sundays
  const sundays = daysInMonth.filter((day) => day.getDay() === 0)
  return sundays[3] || sundays[sundays.length - 1] // fourth Sunday or last Sunday if less than 4
}

function getFirstSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, i) => new Date(year, month, i + 1)
  )

  const sundays = daysInMonth.filter((day) => day.getDay() === 0)
  return sundays[0]
}

function getSecondSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, i) => new Date(year, month, i + 1)
  )

  const sundays = daysInMonth.filter((day) => day.getDay() === 0)
  return sundays[1] || sundays[sundays.length - 1]
}

function getThirdSunday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, i) => new Date(year, month, i + 1)
  )

  const sundays = daysInMonth.filter((day) => day.getDay() === 0)
  return sundays[2] || sundays[sundays.length - 1]
}

export function LegendCard() {
  const [processedMessage, setProcessedMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)

  const handlePreview = async (reminderType: string) => {
    setIsLoading(true)
    setActiveButton(reminderType)

    try {
      const supabase = createClient()
      const { data: reminder } = await supabase
        .from("reminders")
        .select("*")
        .eq("type", reminderType)
        .single()

      if (!reminder) {
        setProcessedMessage("No reminder found for this type")
        return
      }

      let dateString = ""
      let meetingTime = reminder.time
      let meetingLocation = reminder.place

      // Get the appropriate Sunday based on the reminder type
      switch (reminderType) {
        case "MAIN_MEETING":
          const specificMeeting = getNextSpecificMeeting()
          if (specificMeeting) {
            dateString = format(specificMeeting.date, "EEEE, MMM do")
            meetingTime = specificMeeting.time
            meetingLocation = specificMeeting.location
          } else {
            dateString = format(getFourthSunday(), "EEEE, MMM do")
          }
          break
        case "HOST_TEAM_1":
          dateString = format(getFirstSunday(), "EEEE, MMM do")
          break
        case "HOST_TEAM_2":
          dateString = format(getSecondSunday(), "EEEE, MMM do")
          break
        case "HOST_TEAM_3":
          dateString = format(getThirdSunday(), "EEEE, MMM do")
          break
      }

      const result = processMessage(reminder.message, {
        day: dateString,
        time: meetingTime,
        where: meetingLocation,
        reports_due: reminder.reports_due
      })

      setProcessedMessage(result)
    } catch (error) {
      console.error("Error fetching reminder:", error)
      setProcessedMessage("Error fetching reminder")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Reminder Placeholders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Available Placeholders</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <code className="font-mono bg-muted px-1 rounded">
                  {"${day}"}
                </code>{" "}
                : The predetermined day of the host meeting
              </li>
              <li>
                <code className="font-mono bg-muted px-1 rounded">
                  {"${time}"}
                </code>{" "}
                : The value in the Time input
              </li>
              <li>
                <code className="font-mono bg-muted px-1 rounded">
                  {"${where}"}
                </code>{" "}
                : The value in the Place input
              </li>
              <li>
                <code className="font-mono bg-muted px-1 rounded">
                  {"${due}"}
                </code>{" "}
                : The value in the Reports Due input, if set to not required it
                will be ignored
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium mb-2">
              Preview reminders with processed placeholders:
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handlePreview("MAIN_MEETING")}
                variant={
                  activeButton === "MAIN_MEETING" ? "default" : "outline"
                }
                disabled={isLoading}
              >
                {isLoading && activeButton === "MAIN_MEETING" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Main Meeting
              </Button>
              <Button
                onClick={() => handlePreview("HOST_TEAM_1")}
                variant={activeButton === "HOST_TEAM_1" ? "default" : "outline"}
                disabled={isLoading}
              >
                {isLoading && activeButton === "HOST_TEAM_1" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Host Team 1
              </Button>
              <Button
                onClick={() => handlePreview("HOST_TEAM_2")}
                variant={activeButton === "HOST_TEAM_2" ? "default" : "outline"}
                disabled={isLoading}
              >
                {isLoading && activeButton === "HOST_TEAM_2" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Host Team 2
              </Button>
              <Button
                onClick={() => handlePreview("HOST_TEAM_3")}
                variant={activeButton === "HOST_TEAM_3" ? "default" : "outline"}
                disabled={isLoading}
              >
                {isLoading && activeButton === "HOST_TEAM_3" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Host Team 3
              </Button>
            </div>
          </div>

          <div className="p-4 border rounded-md min-h-[100px] bg-muted">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Loading reminder...</span>
              </div>
            ) : processedMessage ? (
              <div className="whitespace-pre-wrap">{processedMessage}</div>
            ) : (
              <div className="text-muted-foreground">
                Click one of the buttons above to preview the processed reminder
                message
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

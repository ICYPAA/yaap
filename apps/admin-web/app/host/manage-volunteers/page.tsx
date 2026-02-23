"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { getEvents } from "./actions"
import ManageVolunteers from "./manage-volunteers"

function getReadableDate(dateString: string) {
  return new Date(dateString + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

function isPastEvent(date: string) {
  const eventDate = new Date(date + "T00:00:00Z")
  eventDate.setDate(eventDate.getDate() + 1) // Add one day to event date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return eventDate <= now
}

export default function ManageVolunteersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get("eventId")
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true)
        const eventData = await getEvents()
        setEvents(eventData || [])
      } catch (error) {
        console.error("Error loading events:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  const handleEventChange = (value: string) => {
    router.push(`/host/manage-volunteers?eventId=${value}`)
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Manage Volunteers</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Event</label>
            <Select value={eventId || ""} onValueChange={handleEventChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {eventId
                    ? (() => {
                        const event = events.find((e) => e.id === eventId)
                        return event
                          ? `${event.title} - ${getReadableDate(event.date)}`
                          : "Choose an event"
                      })()
                    : "Choose an event"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => {
                  const past = isPastEvent(event.date)
                  return (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} - {getReadableDate(event.date)}
                      {past && " (Past)"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      ) : (
        <>
          {eventId ? (
            <ManageVolunteers eventId={eventId} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {events.length > 0
                ? "Please select an event to manage volunteers"
                : "No ICYPAA events found. Create an ICYPAA event to manage volunteers."}
            </div>
          )}
        </>
      )}
    </div>
  )
}

"use server"

import { createClient } from "@/utils/supabase/server"
import { put } from "@vercel/blob"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { createVolunteeringData } from "../manage-volunteers/actions"

export async function createEvent(formData: FormData) {
  try {
    const supabase = await createClient()

    // Handle image upload
    let imageUrl = ""
    const file = formData.get("image") as File
    if (file.size > 0) {
      const blob = await put(file.name, file, { access: "public" })
      imageUrl = blob.url
    }

    const isIcypaaEvent = formData.get("is_icypaa_event") === "true"

    const event = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      time: formData.get("time") as string,
      location: formData.get("location") as string,
      image_url: imageUrl,
      is_icypaa_event: isIcypaaEvent
    }

    const { data, error } = await supabase
      .from("pre-conf-events")
      .insert([event])
      .select()
      .single()

    if (error) {
      console.error("Error inserting event:", error)
      return NextResponse.json(
        { error: "Failed to save event" },
        { status: 500 }
      )
    }

    // Create activity log entry
    await supabase.from("activity").insert([
      {
        action: `created event ${event.title}`,
        metadata: { eventId: data.id }
      }
    ])

    // If it's an ICYPAA event, create a default volunteering entry
    if (isIcypaaEvent) {
      try {
        const { error: volunteeringError } = await createVolunteeringData(
          data.id
        )

        if (volunteeringError) {
          console.error("Error creating volunteering entry:", volunteeringError)
          // Continue execution even if there's an error with volunteering
        }
      } catch (volunteeringError) {
        console.error(
          "Exception creating volunteering entry:",
          volunteeringError
        )
        // Continue execution even if there's an exception with volunteering
      }
    }

    revalidatePath("/events")
    return {
      success: true,
      message: "Event created successfully",
      eventId: data.id
    }
  } catch (error) {
    console.error("Error creating event:", error)
    return { success: false, message: "Failed to create event" }
  }
}

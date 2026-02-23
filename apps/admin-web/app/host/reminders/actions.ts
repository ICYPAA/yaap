"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateReminder(formData: FormData) {
  const supabase = await createClient()
  const type = formData.get("type") as string
  const time = formData.get("time") as string
  const place = formData.get("place") as string
  const message = formData.get("message") as string
  const reports_due = formData.get("reports_due") as string

  // Store the raw message without any processing - placeholder replacement will happen in the cron routes
  const { data: reminder } = await supabase
    .from("reminders")
    .upsert(
      {
        type,
        time,
        place,
        message,
        reports_due
      },
      {
        onConflict: "type"
      }
    )
    .select()
    .single()

  await supabase.from("activity").insert([
    {
      action: `updated ${type.toLowerCase().replace("_", " ")} reminder`,
      metadata: { reminder_id: reminder.id }
    }
  ])

  revalidatePath("/host/reminders")
}

interface Person {
  name: string
  phone: string
}

interface OutreachReminderData {
  id?: number
  name: string
  details: string
  frequency: string
  reminder_buffer: string
  people: Person[]
}

export async function createOutreachReminder(data: OutreachReminderData) {
  try {
    const supabase = await createClient()

    const { data: reminder, error } = await supabase
      .from("outreach_reminders")
      .insert({
        name: data.name,
        details: data.details,
        frequency: data.frequency,
        reminder_buffer: data.reminder_buffer,
        people: data.people.map((p) => ({ name: p.name, phone: p.phone }))
      })
      .select()
      .single()

    if (error) throw error

    await supabase.from("activity").insert([
      {
        action: `created outreach reminder: ${data.name}`,
        metadata: { reminder_id: reminder.id }
      }
    ])

    revalidatePath("/host/reminders")
    return { success: true, data: reminder }
  } catch (error) {
    console.error("Error creating outreach reminder:", error)
    return { success: false, error: "Failed to create reminder" }
  }
}

export async function updateOutreachReminder(data: OutreachReminderData) {
  try {
    const supabase = await createClient()

    if (!data.id) {
      throw new Error("Reminder ID is required for updates")
    }

    const { data: reminder, error } = await supabase
      .from("outreach_reminders")
      .update({
        name: data.name,
        details: data.details,
        frequency: data.frequency,
        reminder_buffer: data.reminder_buffer,
        people: data.people.map((p) => ({ name: p.name, phone: p.phone })),
        updated_at: new Date().toISOString()
      })
      .eq("id", data.id)
      .select()
      .single()

    if (error) throw error

    await supabase.from("activity").insert([
      {
        action: `updated outreach reminder: ${data.name}`,
        metadata: { reminder_id: reminder.id }
      }
    ])

    revalidatePath("/host/reminders")
    return { success: true, data: reminder }
  } catch (error) {
    console.error("Error updating outreach reminder:", error)
    return { success: false, error: "Failed to update reminder" }
  }
}

export async function deleteOutreachReminder(id: number) {
  try {
    const supabase = await createClient()

    // Get reminder name for activity log
    const { data: reminder } = await supabase
      .from("outreach_reminders")
      .select("name")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("outreach_reminders")
      .delete()
      .eq("id", id)

    if (error) throw error

    await supabase.from("activity").insert([
      {
        action: `deleted outreach reminder: ${reminder?.name || "Unknown"}`,
        metadata: { reminder_id: id }
      }
    ])

    revalidatePath("/host/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error deleting outreach reminder:", error)
    return { success: false, error: "Failed to delete reminder" }
  }
}

export async function bulkCreateOutreachReminders(
  reminders: OutreachReminderData[]
) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("outreach_reminders")
      .insert(
        reminders.map((reminder) => ({
          name: reminder.name,
          details: reminder.details,
          frequency: reminder.frequency,
          reminder_buffer: reminder.reminder_buffer,
          people: reminder.people.map((p) => ({ name: p.name, phone: p.phone }))
        }))
      )
      .select()

    if (error) throw error

    await supabase.from("activity").insert([
      {
        action: `bulk created ${reminders.length} outreach reminders`,
        metadata: { count: reminders.length }
      }
    ])

    revalidatePath("/host/reminders")
    return { success: true, data }
  } catch (error) {
    console.error("Error bulk creating outreach reminders:", error)
    return { success: false, error: "Failed to create reminders" }
  }
}

export async function bulkUpsertOutreachReminders(
  reminders: OutreachReminderData[]
) {
  try {
    const supabase = await createClient()

    // Get all existing reminders to check for duplicates
    const { data: existingReminders, error: fetchError } = await supabase
      .from("outreach_reminders")
      .select("id, name, details, reminder_buffer")

    if (fetchError) throw fetchError

    const existingMap = new Map<string, number>()
    existingReminders?.forEach((reminder) => {
      // Use name, details (address), and reminder_buffer as unique key
      const key = `${reminder.name}|${reminder.details}|${reminder.reminder_buffer}`
      existingMap.set(key, reminder.id)
    })

    const toUpdate: (OutreachReminderData & { id: number })[] = []
    const toInsert: OutreachReminderData[] = []

    // Categorize reminders into updates vs inserts
    reminders.forEach((reminder) => {
      // Use name, details (address), and reminder_buffer as unique key
      const key = `${reminder.name}|${reminder.details}|${reminder.reminder_buffer}`
      const existingId = existingMap.get(key)

      if (existingId) {
        toUpdate.push({ ...reminder, id: existingId })
      } else {
        toInsert.push(reminder)
      }
    })

    let updatedCount = 0
    let insertedCount = 0

    // Handle updates
    if (toUpdate.length > 0) {
      for (const reminder of toUpdate) {
        const { error: updateError } = await supabase
          .from("outreach_reminders")
          .update({
            name: reminder.name,
            details: reminder.details,
            frequency: reminder.frequency,
            reminder_buffer: reminder.reminder_buffer,
            people: reminder.people.map((p) => ({
              name: p.name,
              phone: p.phone
            })),
            updated_at: new Date().toISOString()
          })
          .eq("id", reminder.id)

        if (updateError) throw updateError
        updatedCount++
      }
    }

    // Handle inserts
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("outreach_reminders")
        .insert(
          toInsert.map((reminder) => ({
            name: reminder.name,
            details: reminder.details,
            frequency: reminder.frequency,
            reminder_buffer: reminder.reminder_buffer,
            people: reminder.people.map((p) => ({
              name: p.name,
              phone: p.phone
            }))
          }))
        )

      if (insertError) throw insertError
      insertedCount = toInsert.length
    }

    // Log activity
    const actions = []
    if (updatedCount > 0) {
      actions.push(`updated ${updatedCount} existing reminders`)
    }
    if (insertedCount > 0) {
      actions.push(`created ${insertedCount} new reminders`)
    }

    if (actions.length > 0) {
      await supabase.from("activity").insert([
        {
          action: `bulk import: ${actions.join(", ")}`,
          metadata: {
            updated: updatedCount,
            inserted: insertedCount,
            total: reminders.length
          }
        }
      ])
    }

    revalidatePath("/host/reminders")
    return {
      success: true,
      data: {
        updated: updatedCount,
        inserted: insertedCount,
        total: reminders.length
      }
    }
  } catch (error) {
    console.error("Error bulk upserting outreach reminders:", error)
    return { success: false, error: "Failed to import reminders" }
  }
}
